import { log, Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { Pool } from '../types/templates/GammaPool/Pool';
import { PoolViewer } from '../types/templates/GammaPool/PoolViewer';
import { DeltaSwapPair, GammaPool, Loan, Token } from '../types/schema';
import { WETH_USDC_POOL, POOL_VIEWER, POOL_VIEWER2, POOL_VIEWER_UPDATE_BLOCK, GAP_START_BLOCK, GAP_END_BLOCK, WETH_USDC_PAIR, DEFAULT_PROTOCOL_ID } from './constants';
import { loadOrCreateAbout } from './loader';

export function convertToBigDecimal(value: BigInt, decimals: number = 18): BigDecimal {
  const precision = BigInt.fromI32(10).pow(<u8>decimals).toBigDecimal();

  return value.divDecimal(precision);
}

export function isGapPeriod(blockNumber: BigInt) : boolean {
  const gapStartBlock = BigInt.fromString(GAP_START_BLOCK);
  const gapEndBlock = BigInt.fromString(GAP_END_BLOCK);
  return gapStartBlock.gt(BigInt.zero()) && gapEndBlock.gt(BigInt.zero()) &&
      blockNumber.ge(gapStartBlock) && blockNumber.lt(gapEndBlock); // GammaPool 1.2.1 interface break in arbitrumSepolia
}

export function getPoolViewer(blockNumber: BigInt) : PoolViewer {
  const updateBlock = BigInt.fromString(POOL_VIEWER_UPDATE_BLOCK);
  if(updateBlock.gt(BigInt.zero()) && blockNumber.ge(updateBlock)) {
    return PoolViewer.bind(Address.fromString(POOL_VIEWER2));// GammaPool 1.2.2
  } /*else if(blockNumber.equals(updateBlock)) {
    const poolContract = Pool.bind(Address.fromString(WETH_USDC_POOL)); // Get PoolViewer from GammaPool
    return PoolViewer.bind(poolContract.viewer());
  }/**/
  return PoolViewer.bind(Address.fromString(POOL_VIEWER));// GammaPool 1.1.0
}

export function oneEthInUsd(): BigDecimal {
  const pair = DeltaSwapPair.load(WETH_USDC_PAIR);
  if (pair == null) return BigDecimal.fromString('0');

  const token0 = Token.load(pair.token0);

  if (token0 == null) return BigDecimal.fromString('0');

  let price = getPriceFromDSPair(pair);

  if(token0.symbol == 'USDC' && price.gt(BigDecimal.zero())) {
      price = BigDecimal.fromString("1").div(price);
  }

  return price;
}

export function getPriceFromDSPair(pair: DeltaSwapPair) : BigDecimal {
  const token0 = Token.load(pair.token0);
  const token1 = Token.load(pair.token1);

  if (token0 == null || token1 == null) return BigDecimal.fromString('0');

  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32()).toBigDecimal();
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32()).toBigDecimal();

  const reserve0 = pair.reserve0.toBigDecimal().div(precision0);
  const reserve1 = pair.reserve1.toBigDecimal().div(precision1);

  if (reserve0.equals(BigDecimal.zero())) return BigDecimal.fromString('0');

  return reserve1.div(reserve0);
}

export function updatePrices(pool: GammaPool): void {
  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (token0 == null || token1 == null) return;

  let poolPrice = BigDecimal.fromString('0');

  const precision = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32()).toBigDecimal();

  if (pool.protocolId.equals(BigInt.fromI32(DEFAULT_PROTOCOL_ID))) {
    const pair = DeltaSwapPair.load(pool.cfmm.toHexString());

    if (pair == null) return;

    poolPrice = getPriceFromDSPair(pair);
    pool.lastPrice = BigInt.fromString(poolPrice.times(precision).truncate(0).toString())
  } else {
    const poolContract = Pool.bind(Address.fromBytes(pool.address));
    pool.lastPrice = poolContract.getLastCFMMPrice();
    poolPrice = pool.lastPrice.divDecimal(precision);
  }

  if(poolPrice.gt(BigDecimal.zero())) {
    updateTokenPrices(token0, token1, poolPrice);
  }

  pool.save();
}

export function updateTokenPrices(token0: Token, token1: Token, pairPrice: BigDecimal): void {
  log.warning("Update token prices from deltaswap: {}, {}, {}", [token0.id, token1.id, pairPrice.toString()]);
  const ethToUsd = oneEthInUsd();

  if (token0.symbol == 'WETH') {
    token0.priceETH = BigDecimal.fromString('1');
    token0.priceUSD = ethToUsd.truncate(6);
    token1.priceETH = BigDecimal.fromString('1').div(pairPrice).truncate(18);
    token1.priceUSD = token1.priceETH.times(ethToUsd).truncate(6);
  } else if (token1.symbol == 'WETH') {
    token1.priceETH = BigDecimal.fromString('1');
    token1.priceUSD = ethToUsd.truncate(6);
    token0.priceETH = pairPrice.truncate(18);
    token0.priceUSD = token0.priceETH.times(ethToUsd).truncate(6);
  }

  token0.save();
  token1.save();
}

export function updatePoolStats(pool: GammaPool): void {
  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (token0 == null || token1 == null) return;

  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const invariantPrecision = BigInt.fromI32(10).pow(<u8>token0.decimals.plus(token1.decimals).toI32()).sqrt().toBigDecimal();
  const sqrtPriceWithPrecision = pool.lastPrice.times(precision1).sqrt().toBigDecimal();
  const sqrtPrice = sqrtPriceWithPrecision.div(invariantPrecision).div(precision1.toBigDecimal());

  pool.lpBalanceInToken1 = BigDecimal.fromString('2').times(pool.lpInvariant.toBigDecimal()).times(sqrtPrice).truncate(token1.decimals.toI32());
  pool.lpBalanceInToken0 = pool.lpBalanceInToken1.div(pool.lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBalanceETH = pool.lpBalanceInToken0.times(token0.priceETH);
  pool.lpBalanceUSD = pool.lpBalanceInToken0.times(token0.priceUSD).truncate(2);

  const prevBorrowedETH = pool.lpBorrowedBalanceETH;
  const prevBorrowedUSD = pool.lpBorrowedBalanceUSD;

  const borrowedInvariant = pool.lpBorrowedBalance.times(pool.lastCfmmInvariant).div(pool.lastCfmmTotalSupply).toBigDecimal();
  pool.lpBorrowedBalanceInToken1 = BigDecimal.fromString('2').times(borrowedInvariant).times(sqrtPrice).truncate(token1.decimals.toI32());
  pool.lpBorrowedBalanceInToken0 = pool.lpBorrowedBalanceInToken1.div(pool.lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBorrowedBalanceETH = pool.lpBorrowedBalanceInToken0.times(token0.priceETH);
  pool.lpBorrowedBalanceUSD = pool.lpBorrowedBalanceInToken0.times(token0.priceUSD).truncate(2);

  pool.lpBorrowedBalancePlusInterestInToken1 = BigDecimal.fromString('2').times(pool.lpBorrowedInvariant.toBigDecimal()).times(sqrtPrice).truncate(token1.decimals.toI32());
  pool.lpBorrowedBalancePlusInterestInToken0 = pool.lpBorrowedBalancePlusInterestInToken1.div(pool.lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBorrowedBalancePlusInterestETH = pool.lpBorrowedBalancePlusInterestInToken0.times(token0.priceETH);
  pool.lpBorrowedBalancePlusInterestUSD = pool.lpBorrowedBalancePlusInterestInToken0.times(token0.priceUSD).truncate(2);

  const token0InToken1 = pool.token0Balance.times(pool.lastPrice).div(precision0).div(precision1).toBigDecimal();
  const allTokensInToken1 = token0InToken1.plus(pool.token1Balance.div(precision1).toBigDecimal());
  const tokensInETH = allTokensInToken1.times(token1.priceETH).truncate(2);
  const tokensInUSD = allTokensInToken1.times(token1.priceUSD).truncate(2);

  const prevTvlETH = pool.tvlETH;
  const prevTvlUSD = pool.tvlUSD;

  pool.tvlETH = pool.lpBalanceETH.plus(tokensInETH);
  pool.tvlUSD = pool.lpBalanceUSD.plus(tokensInUSD);

  const about = loadOrCreateAbout();
  about.totalTvlETH = about.totalTvlETH.plus(pool.tvlETH).minus(prevTvlETH);
  about.totalTvlUSD = about.totalTvlUSD.plus(pool.tvlUSD).minus(prevTvlUSD);
  about.totalBorrowedETH = about.totalBorrowedETH.plus(pool.lpBorrowedBalanceETH).minus(prevBorrowedETH);
  about.totalBorrowedUSD = about.totalBorrowedUSD.plus(pool.lpBorrowedBalanceUSD).minus(prevBorrowedUSD);
  about.save();

  pool.lastCfmmInToken1 = BigDecimal.fromString('2').times(pool.lastCfmmInvariant.toBigDecimal()).times(sqrtPrice).truncate(token1.decimals.toI32());
  pool.lastCfmmInToken0 = pool.lastCfmmInToken1.div(pool.lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lastCfmmETH = pool.lastCfmmInToken0.times(token0.priceETH);
  pool.lastCfmmUSD = pool.lastCfmmInToken0.times(token0.priceUSD).truncate(2);

  pool.save();
}

export function updateLoanStats(loan: Loan): void {
  const pool = GammaPool.load(loan.pool);
  if (pool == null) return;

  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (token0 == null || token1 == null) return;

  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const invariantPrecision = BigInt.fromI32(10).pow(<u8>token0.decimals.plus(token1.decimals).toI32()).sqrt().toBigDecimal();
  const sqrtPrice = pool.lastPrice.times(precision1).sqrt().toBigDecimal();
  const priceInToken1 = sqrtPrice.div(invariantPrecision).div(precision1.toBigDecimal());

  const initLiquidityInToken1 = BigDecimal.fromString('2').times(loan.initLiquidity.toBigDecimal()).times(priceInToken1).truncate(token1.decimals.toI32());
  loan.initLiquidityETH = initLiquidityInToken1.times(token1.priceETH);
  loan.initLiquidityUSD = initLiquidityInToken1.times(token1.priceUSD);

  const liquidityInToken1 = BigDecimal.fromString('2').times(loan.liquidity.toBigDecimal()).times(priceInToken1).truncate(token1.decimals.toI32());
  loan.liquidityETH = liquidityInToken1.times(token1.priceETH);
  loan.liquidityUSD = liquidityInToken1.times(token1.priceUSD);

  loan.save();
}

export function getEthUsdValue(token0: Token, token1: Token, invariant: BigInt, price: BigInt, asEth: boolean): BigDecimal {
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const invariantPrecision = BigInt.fromI32(10).pow(<u8>token0.decimals.plus(token1.decimals).toI32()).sqrt().toBigDecimal();
  const sqrtPrice = price.times(precision1).sqrt().toBigDecimal();
  const invariantInToken1 = BigDecimal.fromString('2').times(invariant.toBigDecimal()).times(sqrtPrice).div(invariantPrecision).div(precision1.toBigDecimal());
  if (asEth) {
    return invariantInToken1.times(token1.priceETH);
  }
  return invariantInToken1.times(token1.priceUSD).truncate(2);
}