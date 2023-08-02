import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { Pool } from '../types/templates/GammaPool/Pool';
import { GammaPool, Token } from '../types/schema';
import { WETH_USDC_POOL } from './constants';

export function convertToBigDecimal(value: BigInt, decimals: number = 18): BigDecimal {
  const precision = BigInt.fromI32(10).pow(<u8>decimals).toBigDecimal();

  return value.divDecimal(precision);
}

export function oneUsdInEth(): BigDecimal {
  const poolContract = Pool.bind(Address.fromString(WETH_USDC_POOL));
  const pool = GammaPool.load(WETH_USDC_POOL);

  if (poolContract == null || pool == null) return BigDecimal.fromString('0');

  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);
  if (token0 == null || token1 == null) return BigDecimal.fromString('0');

  const usdcToken = token0.symbol == 'USDC' ? token0 : token1;

  const poolData = poolContract.getPoolData();
  const precision = BigInt.fromI32(10).pow(<u8>usdcToken.decimals.toI32()).toBigDecimal();
  return poolData.lastPrice.toBigDecimal().div(precision).truncate(18);
}

export function updatePrices(poolAddress: Address): void {
  const poolContract = Pool.bind(poolAddress);
  const pool = GammaPool.load(poolAddress.toHexString());

  if (poolContract == null || pool == null) return;

  const usdToEth = oneUsdInEth();
  pool.lastPrice = poolContract.getLastCFMMPrice();

  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (token0 == null || token1 == null) return;

  const precision = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32()).toBigDecimal();
  const poolPrice = pool.lastPrice.divDecimal(precision);

  if (token0.symbol == 'WETH') {
    token0.priceETH = BigDecimal.fromString('1');
    token0.priceUSD = token0.priceETH.div(usdToEth).truncate(18);
    token1.priceETH = BigDecimal.fromString('1').div(poolPrice).truncate(18);
    token1.priceUSD = token1.priceETH.div(usdToEth).truncate(18);
  } else if (token1.symbol == 'WETH') {
    token1.priceETH = BigDecimal.fromString('1');
    token1.priceUSD = token1.priceETH.div(usdToEth).truncate(18);
    token0.priceETH = poolPrice.truncate(18);
    token0.priceUSD = token0.priceETH.div(usdToEth).truncate(18);
  }

  token0.save();
  token1.save();

  pool.save();
}

export function updatePoolStats(pool: GammaPool): void {
  const poolContract = Pool.bind(Address.fromString(pool.id));
  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (poolContract == null || token0 == null || token1 == null) return;

  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const invariantPrecision = BigInt.fromI32(10).pow(<u8>token0.decimals.plus(token1.decimals).toI32()).sqrt().toBigDecimal();
  const sqrtPrice = pool.lastPrice.times(precision1).sqrt().toBigDecimal();

  pool.lpBalanceInToken1 = BigDecimal.fromString('2').times(pool.lpInvariant.toBigDecimal()).times(sqrtPrice).div(invariantPrecision).div(precision1.toBigDecimal()).truncate(token1.decimals.toI32());
  pool.lpBalanceInToken0 = pool.lpBalanceInToken1.div(pool.lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBalanceETH = pool.lpBalanceInToken0.times(token0.priceETH);
  pool.lpBalanceUSD = pool.lpBalanceInToken0.times(token0.priceUSD).truncate(2);

  const borrowedInvariant = pool.lpBorrowedBalance.times(pool.lastCfmmInvariant).div(pool.lastCfmmTotalSupply).divDecimal(invariantPrecision);
  pool.lpBorrowedBalanceInToken1 = BigDecimal.fromString('2').times(borrowedInvariant).times(sqrtPrice).div(precision1.toBigDecimal()).truncate(token1.decimals.toI32());
  pool.lpBorrowedBalanceInToken0 = pool.lpBorrowedBalanceInToken1.div(pool.lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBorrowedBalanceETH = pool.lpBorrowedBalancePlusInterestInToken0.times(token0.priceETH);
  pool.lpBorrowedBalanceUSD = pool.lpBorrowedBalancePlusInterestInToken0.times(token0.priceUSD).truncate(2);

  pool.lpBorrowedBalancePlusInterestInToken1 = BigDecimal.fromString('2').times(pool.lpBorrowedInvariant.toBigDecimal()).times(sqrtPrice).div(invariantPrecision).div(precision1.toBigDecimal()).truncate(token1.decimals.toI32());
  pool.lpBorrowedBalancePlusInterestInToken0 = pool.lpBorrowedBalancePlusInterestInToken1.div(pool.lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBorrowedBalancePlusInterestETH = pool.lpBorrowedBalancePlusInterestInToken0.times(token0.priceETH);
  pool.lpBorrowedBalancePlusInterestUSD = pool.lpBorrowedBalancePlusInterestInToken0.times(token0.priceUSD).truncate(2);

  pool.tvlETH = pool.lpBalanceETH.plus(pool.lpBorrowedBalancePlusInterestETH);
  pool.tvlUSD = pool.lpBalanceUSD.plus(pool.lpBorrowedBalancePlusInterestUSD);

  const lastCfmmInvariant = pool.lastCfmmInvariant.divDecimal(invariantPrecision);
  pool.lastCfmmInToken1 = BigDecimal.fromString('2').times(lastCfmmInvariant).times(sqrtPrice).div(precision1.toBigDecimal()).truncate(token1.decimals.toI32());
  pool.lastCfmmInToken0 = pool.lastCfmmInToken1.div(pool.lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lastCfmmETH = pool.lastCfmmInToken0.times(token0.priceETH);
  pool.lastCfmmUSD = pool.lastCfmmInToken0.times(token0.priceUSD).truncate(2);

  pool.save();
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