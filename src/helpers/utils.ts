import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts';
import { DeltaSwapPair, GammaPool, Loan, Token, About } from '../types/schema';
import { DeltaSwapPair as Pair } from '../types/templates/DeltaSwapPair/DeltaSwapPair';
import {
  WETH_USDC_PAIR,
  USDC,
  USDT,
  WETH,
  WEETH,
  ARBITRUM_BRIDGE_USDC_TOKEN,
  NETWORK,
  ADDRESS_ZERO,
  WETH_USDC_UNI_PAIR,
  TRACKED_TOKENS,
  THROTTLE_THRESHOLD,
  THROTTLE_SECONDS,
  TRACKED_THROTTLE_THRESHOLD,
  TRACKED_THROTTLE_SECONDS
} from './constants';
import { loadOrCreateAbout, loadOrCreateToken } from "./loader";
import { ERC20 } from "../types/templates/DeltaSwapPair/ERC20";

export function convertToBigDecimal(value: BigInt, decimals: number = 18): BigDecimal {
  const precision = BigInt.fromI32(10).pow(<u8>decimals).toBigDecimal();

  return value.divDecimal(precision);
}

export function isTokenValid(token: Token): boolean {
  return token.decimals.ge(BigInt.fromString("6")) && token.decimals.le(BigInt.fromString("18"))
      && token.decimals.mod(BigInt.fromString("2")).equals(BigInt.zero());
}

export function oneEthInUsd(): BigDecimal {
  let token0Address = ADDRESS_ZERO;
  let token1Address = ADDRESS_ZERO;
  let reserve0 = BigInt.fromI32(0);
  let reserve1 = BigInt.fromI32(0);
  let tryUniPair = true;

  const pair = DeltaSwapPair.load(WETH_USDC_PAIR);
  if(pair != null) {
    reserve0 = pair.reserve0;
    reserve1 = pair.reserve1;
    token0Address = pair.token0;
    token1Address = pair.token1;
    tryUniPair = false;
  } else if(WETH_USDC_UNI_PAIR != ADDRESS_ZERO) {
    const pairContract = Pair.bind(Address.fromString(WETH_USDC_UNI_PAIR)); // assumes an UniV2 style pool exists before GammaPoolFactory

    const reserves = pairContract.getReserves();
    reserve0 = reserves.getReserve0();
    reserve1 = reserves.getReserve1();

    if (reserve0 == BigInt.zero() || reserve1 == BigInt.zero()) return BigDecimal.fromString('0');

    token0Address = pairContract.token0().toHexString();
    token1Address = pairContract.token1().toHexString();
  }

  if(token0Address == ADDRESS_ZERO || token1Address == ADDRESS_ZERO || reserve0 == BigInt.zero() || reserve1 == BigInt.zero()) return BigDecimal.fromString('0');

  const token0 = tryUniPair ? loadOrCreateToken(token0Address) : Token.load(token0Address);
  const token1 = tryUniPair ? loadOrCreateToken(token1Address) : Token.load(token1Address);

  if (token0 == null || token1 == null || !isTokenValid(token0) || !isTokenValid(token1)) return BigDecimal.fromString('0');

  let price = getPriceFromReserves(token0, token1, reserve0, reserve1);

  if(token0.symbol.indexOf('USD') >= 0 && price.gt(BigDecimal.zero())) {
    price = BigDecimal.fromString("1").div(price); // ensure price is always in terms of USD
  }

  return price;
}

export function getPriceFromReserves(token0: Token, token1: Token, reserve0:BigInt, reserve1: BigInt) : BigDecimal {
  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32()).toBigDecimal();
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32()).toBigDecimal();

  const _reserve0 = reserve0.toBigDecimal().div(precision0);
  const _reserve1 = reserve1.toBigDecimal().div(precision1);

  let price = BigDecimal.fromString('0');
  if (_reserve0.gt(BigDecimal.zero())) {
    price = _reserve1.div(_reserve0);
  }

  return price;
}

export function decreaseAboutTotals(about: About, token0: Token, token1: Token): void {
  if((!TRACKED_TOKENS || TRACKED_TOKENS.length == 0) || TRACKED_TOKENS.includes(token0.id)) {
    about.totalTvlETH = about.totalTvlETH.minus(token0.balanceETH);
    about.totalTvlUSD = about.totalTvlUSD.minus(token0.balanceUSD);

    about.totalLPBalanceUSD = about.totalLPBalanceUSD.minus(token0.lpBalanceUSD);
    about.totalLPBalanceETH = about.totalLPBalanceETH.minus(token0.lpBalanceETH);

    about.totalDSBalanceUSD = about.totalDSBalanceUSD.minus(token0.dsBalanceUSD);
    about.totalDSBalanceETH = about.totalDSBalanceETH.minus(token0.dsBalanceETH);

    about.totalGSBalanceUSD = about.totalGSBalanceUSD.minus(token0.gsBalanceUSD);
    about.totalGSBalanceETH = about.totalGSBalanceETH.minus(token0.gsBalanceETH);

    about.totalBorrowedUSD = about.totalBorrowedUSD.minus(token0.borrowedBalanceUSD);
    about.totalBorrowedETH = about.totalBorrowedETH.minus(token0.borrowedBalanceETH);
  }

  if((!TRACKED_TOKENS || TRACKED_TOKENS.length == 0) || TRACKED_TOKENS.includes(token1.id)) {
    about.totalTvlETH = about.totalTvlETH.minus(token1.balanceETH);
    about.totalTvlUSD = about.totalTvlUSD.minus(token1.balanceUSD);

    about.totalLPBalanceUSD = about.totalLPBalanceUSD.minus(token1.lpBalanceUSD);
    about.totalLPBalanceETH = about.totalLPBalanceETH.minus(token1.lpBalanceETH);

    about.totalDSBalanceUSD = about.totalDSBalanceUSD.minus(token1.dsBalanceUSD);
    about.totalDSBalanceETH = about.totalDSBalanceETH.minus(token1.dsBalanceETH);

    about.totalGSBalanceUSD = about.totalGSBalanceUSD.minus(token1.gsBalanceUSD);
    about.totalGSBalanceETH = about.totalGSBalanceETH.minus(token1.gsBalanceETH);

    about.totalBorrowedUSD = about.totalBorrowedUSD.minus(token1.borrowedBalanceUSD);
    about.totalBorrowedETH = about.totalBorrowedETH.minus(token1.borrowedBalanceETH);
  }
}

export function increaseAboutTotals(about: About, token0: Token, token1: Token): void {
  if((!TRACKED_TOKENS || TRACKED_TOKENS.length == 0) || TRACKED_TOKENS.includes(token0.id)) {
    about.totalLPBalanceUSD = about.totalLPBalanceUSD.plus(token0.lpBalanceUSD);
    about.totalLPBalanceETH = about.totalLPBalanceETH.plus(token0.lpBalanceETH);

    about.totalDSBalanceUSD = about.totalDSBalanceUSD.plus(token0.dsBalanceUSD);
    about.totalDSBalanceETH = about.totalDSBalanceETH.plus(token0.dsBalanceETH);

    about.totalGSBalanceUSD = about.totalGSBalanceUSD.plus(token0.gsBalanceUSD);
    about.totalGSBalanceETH = about.totalGSBalanceETH.plus(token0.gsBalanceETH);

    about.totalBorrowedUSD = about.totalBorrowedUSD.plus(token0.borrowedBalanceUSD);
    about.totalBorrowedETH = about.totalBorrowedETH.plus(token0.borrowedBalanceETH);

    about.totalTvlETH = about.totalTvlETH.plus(token0.balanceETH);
    about.totalTvlUSD = about.totalTvlUSD.plus(token0.balanceUSD);
  }

  if((!TRACKED_TOKENS || TRACKED_TOKENS.length == 0) || TRACKED_TOKENS.includes(token1.id)) {
    about.totalLPBalanceUSD = about.totalLPBalanceUSD.plus(token1.lpBalanceUSD);
    about.totalLPBalanceETH = about.totalLPBalanceETH.plus(token1.lpBalanceETH);

    about.totalDSBalanceUSD = about.totalDSBalanceUSD.plus(token1.dsBalanceUSD);
    about.totalDSBalanceETH = about.totalDSBalanceETH.plus(token1.dsBalanceETH);

    about.totalGSBalanceUSD = about.totalGSBalanceUSD.plus(token1.gsBalanceUSD);
    about.totalGSBalanceETH = about.totalGSBalanceETH.plus(token1.gsBalanceETH);

    about.totalBorrowedUSD = about.totalBorrowedUSD.plus(token1.borrowedBalanceUSD);
    about.totalBorrowedETH = about.totalBorrowedETH.plus(token1.borrowedBalanceETH);

    about.totalTvlETH = about.totalTvlETH.plus(token1.balanceETH);
    about.totalTvlUSD = about.totalTvlUSD.plus(token1.balanceUSD);
  }
}

export function isStableToken(token: Token): boolean {
  const tokenAddress = token.id.toLowerCase();
  if(NETWORK == 'arbitrum-one' && tokenAddress == ARBITRUM_BRIDGE_USDC_TOKEN) {
    return true;
  }
  return tokenAddress == USDC || tokenAddress == USDT;
}

export function updateTokenPrices(token0: Token, token1: Token, pairPrice: BigDecimal): void {
  log.warning("Update token prices from deltaswap: {}, {}, {}", [token0.id, token1.id, pairPrice.toString()]);

  const about = loadOrCreateAbout();

  decreaseAboutTotals(about, token0, token1);

  const ethToUsd = oneEthInUsd();

  token0.balanceBN = token0.gsBalanceBN.plus(token0.lpBalanceBN);
  token1.balanceBN = token1.gsBalanceBN.plus(token1.lpBalanceBN);

  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32()).toBigDecimal();
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32()).toBigDecimal();

  // There needs to be a market against WETH or a USD token to get the value of a token
  if (token0.id.toLowerCase() == WETH) {
    token0.priceETH = BigDecimal.fromString('1');
    token0.priceUSD = ethToUsd.truncate(6);
    if(pairPrice.gt(BigDecimal.zero())) {
      token1.priceETH = BigDecimal.fromString('1').div(pairPrice).truncate(18);
      token1.priceUSD = token1.priceETH.times(ethToUsd).truncate(6);
    }
    token0.balanceETH = token0.balanceBN.toBigDecimal().div(precision0).truncate(18);
    token0.balanceUSD = token0.balanceETH.times(token0.priceUSD).truncate(6);
    token1.balanceETH = token1.balanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.balanceUSD = token1.balanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);

    token0.dsBalanceETH = token0.dsBalanceBN.toBigDecimal().div(precision0.truncate(18));
    token0.dsBalanceUSD = token0.dsBalanceETH.times(token0.priceUSD).truncate(6);
    token1.dsBalanceETH = token1.dsBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.dsBalanceUSD = token1.dsBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);

    token0.lpBalanceETH = token0.lpBalanceBN.toBigDecimal().div(precision0.truncate(18));
    token0.lpBalanceUSD = token0.lpBalanceETH.times(token0.priceUSD).truncate(6);
    token1.lpBalanceETH = token1.lpBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.lpBalanceUSD = token1.lpBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);

    token0.gsBalanceETH = token0.gsBalanceBN.toBigDecimal().div(precision0).truncate(18);
    token0.gsBalanceUSD = token0.gsBalanceETH.times(token0.priceUSD).truncate(6);
    token1.gsBalanceETH = token1.gsBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.gsBalanceUSD = token1.gsBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);

    token0.borrowedBalanceETH = token0.borrowedBalanceBN.toBigDecimal().div(precision0).truncate(18);
    token0.borrowedBalanceUSD = token0.borrowedBalanceETH.times(token0.priceUSD).truncate(6);
    token1.borrowedBalanceETH = token1.borrowedBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);
  } else if (token1.id.toLowerCase() == WETH) {
    token1.priceETH = BigDecimal.fromString('1');
    token1.priceUSD = ethToUsd.truncate(6);
    if(pairPrice.gt(BigDecimal.zero())) {
      token0.priceETH = pairPrice.truncate(18);
      token0.priceUSD = token0.priceETH.times(ethToUsd).truncate(6);
    }
    token1.balanceETH = token1.balanceBN.toBigDecimal().div(precision1).truncate(18);
    token1.balanceUSD = token1.balanceETH.times(token1.priceUSD).truncate(6);
    token0.balanceETH = token0.balanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.balanceUSD = token0.balanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);

    token1.dsBalanceETH = token1.dsBalanceBN.toBigDecimal().div(precision1).truncate(18);
    token1.dsBalanceUSD = token1.dsBalanceETH.times(token1.priceUSD).truncate(6);
    token0.dsBalanceETH = token0.dsBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.dsBalanceUSD = token0.dsBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);

    token1.lpBalanceETH = token1.lpBalanceBN.toBigDecimal().div(precision1).truncate(18);
    token1.lpBalanceUSD = token1.lpBalanceETH.times(token1.priceUSD).truncate(6);
    token0.lpBalanceETH = token0.lpBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.lpBalanceUSD = token0.lpBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);

    token1.gsBalanceETH = token1.gsBalanceBN.toBigDecimal().div(precision1).truncate(18);
    token1.gsBalanceUSD = token1.gsBalanceETH.times(token1.priceUSD).truncate(6);
    token0.gsBalanceETH = token0.gsBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.gsBalanceUSD = token0.gsBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);

    token1.borrowedBalanceETH = token1.borrowedBalanceBN.toBigDecimal().div(precision1).truncate(18);
    token1.borrowedBalanceUSD = token1.borrowedBalanceETH.times(token1.priceUSD).truncate(6);
    token0.borrowedBalanceETH = token0.borrowedBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);
  } else if(isStableToken(token0)) {
    token0.priceUSD = BigDecimal.fromString('1');
    token0.priceETH = token0.priceUSD.div(ethToUsd).truncate(18);
    if(pairPrice.gt(BigDecimal.zero())) {
      token1.priceUSD = BigDecimal.fromString('1').div(pairPrice).truncate(6);
      token1.priceETH = token1.priceUSD.div(ethToUsd).truncate(18);
    }
    token0.balanceUSD = token0.balanceBN.toBigDecimal().div(precision0).truncate(6);
    token0.balanceETH = token0.balanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token1.balanceUSD = token1.balanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);
    token1.balanceETH = token1.balanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);

    token0.dsBalanceUSD = token0.dsBalanceBN.toBigDecimal().div(precision0).truncate(6);
    token0.dsBalanceETH = token0.dsBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token1.dsBalanceUSD = token1.dsBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);
    token1.dsBalanceETH = token1.dsBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);

    token0.lpBalanceUSD = token0.lpBalanceBN.toBigDecimal().div(precision0).truncate(6);
    token0.lpBalanceETH = token0.lpBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token1.lpBalanceUSD = token1.lpBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);
    token1.lpBalanceETH = token1.lpBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);

    token0.gsBalanceUSD = token0.gsBalanceBN.toBigDecimal().div(precision0).truncate(6);
    token0.gsBalanceETH = token0.gsBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token1.gsBalanceUSD = token1.gsBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);
    token1.gsBalanceETH = token1.gsBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);

    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.toBigDecimal().div(precision0).truncate(6);
    token0.borrowedBalanceETH = token0.borrowedBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);
    token1.borrowedBalanceETH = token1.borrowedBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
  } else if(isStableToken(token1)) {
    token1.priceUSD = BigDecimal.fromString('1');
    token1.priceETH = token1.priceUSD.div(ethToUsd).truncate(18);
    if(pairPrice.gt(BigDecimal.zero())) {
      token0.priceUSD = pairPrice.truncate(6);
      token0.priceETH = token0.priceUSD.div(ethToUsd).truncate(18);
    }
    token1.balanceUSD = token1.balanceBN.toBigDecimal().div(precision1).truncate(6);
    token1.balanceETH = token1.balanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token0.balanceUSD = token0.balanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);
    token0.balanceETH = token0.balanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);

    token1.dsBalanceUSD = token1.dsBalanceBN.toBigDecimal().div(precision1).truncate(6);
    token1.dsBalanceETH = token1.dsBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token0.dsBalanceUSD = token0.dsBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);
    token0.dsBalanceETH = token0.dsBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);

    token1.lpBalanceUSD = token1.lpBalanceBN.toBigDecimal().div(precision1).truncate(6);
    token1.lpBalanceETH = token1.lpBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token0.lpBalanceUSD = token0.lpBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);
    token0.lpBalanceETH = token0.lpBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);

    token1.gsBalanceUSD = token1.gsBalanceBN.toBigDecimal().div(precision1).truncate(6);
    token1.gsBalanceETH = token1.gsBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token0.gsBalanceUSD = token0.gsBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);
    token0.gsBalanceETH = token0.gsBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);

    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.toBigDecimal().div(precision1).truncate(6);
    token1.borrowedBalanceETH = token1.borrowedBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);
    token0.borrowedBalanceETH = token0.borrowedBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
  } else if (token0.id.toLowerCase() == WEETH) {
    if(pairPrice.gt(BigDecimal.zero())) {
      token1.priceETH = token0.priceETH.div(pairPrice).truncate(18);
      token1.priceUSD = token1.priceETH.times(ethToUsd).truncate(6);
    }
    token1.balanceETH = token1.balanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.balanceUSD = token1.balanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);

    token1.dsBalanceETH = token1.dsBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.dsBalanceUSD = token1.dsBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);

    token1.lpBalanceETH = token1.lpBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.lpBalanceUSD = token1.lpBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);

    token1.gsBalanceETH = token1.gsBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.gsBalanceUSD = token1.gsBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);

    token1.borrowedBalanceETH = token1.borrowedBalanceBN.toBigDecimal().times(token1.priceETH).div(precision1).truncate(18);
    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.toBigDecimal().times(token1.priceUSD).div(precision1).truncate(6);
  } else if (token1.id.toLowerCase() == WEETH) {
    if(pairPrice.gt(BigDecimal.zero())) {
      token0.priceETH = pairPrice.times(token1.priceETH).truncate(18);
      token0.priceUSD = token0.priceETH.times(ethToUsd).truncate(6);
    }
    token0.balanceETH = token0.balanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.balanceUSD = token0.balanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);

    token0.dsBalanceETH = token0.dsBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.dsBalanceUSD = token0.dsBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);

    token0.lpBalanceETH = token0.lpBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.lpBalanceUSD = token0.lpBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);

    token0.gsBalanceETH = token0.gsBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.gsBalanceUSD = token0.gsBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);

    token0.borrowedBalanceETH = token0.borrowedBalanceBN.toBigDecimal().times(token0.priceETH).div(precision0).truncate(18);
    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.toBigDecimal().times(token0.priceUSD).div(precision0).truncate(6);
  }

  increaseAboutTotals(about, token0, token1);

  about.save();
}

export function updatePoolStats(token0: Token, token1: Token, pool: GammaPool, pair: DeltaSwapPair): void {
  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const invariantPrecision = BigInt.fromI32(10).pow(<u8>token0.decimals.plus(token1.decimals).toI32()).sqrt().toBigDecimal();
  const lastPrice = pair.reserve1.times(precision0).div(pair.reserve0);
  const sqrtPriceWithPrecision = lastPrice.times(precision1).sqrt().toBigDecimal();
  const sqrtPrice = sqrtPriceWithPrecision.div(invariantPrecision).div(precision1.toBigDecimal());
  const lastCfmmInvariant = pair.reserve1.times(pair.reserve0).sqrt();
  const lastCfmmTotalSupply = pair.totalSupply;

  pool.lpBalanceInToken1 = BigDecimal.fromString('2').times(pool.lpInvariant.toBigDecimal()).times(sqrtPrice).truncate(token1.decimals.toI32());
  pool.lpBalanceInToken0 = pool.lpBalanceInToken1.div(lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBalanceETH = pool.lpBalanceInToken0.times(token0.priceETH);
  pool.lpBalanceUSD = pool.lpBalanceInToken0.times(token0.priceUSD).truncate(2);

  const borrowedInvariant = pool.lpBorrowedBalance.times(lastCfmmInvariant).div(lastCfmmTotalSupply).toBigDecimal();
  pool.lpBorrowedBalanceInToken1 = BigDecimal.fromString('2').times(borrowedInvariant).times(sqrtPrice).truncate(token1.decimals.toI32());
  pool.lpBorrowedBalanceInToken0 = pool.lpBorrowedBalanceInToken1.div(lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBorrowedBalanceETH = pool.lpBorrowedBalanceInToken0.times(token0.priceETH);
  pool.lpBorrowedBalanceUSD = pool.lpBorrowedBalanceInToken0.times(token0.priceUSD).truncate(2);

  pool.lpBorrowedBalancePlusInterestInToken1 = BigDecimal.fromString('2').times(pool.lpBorrowedInvariant.toBigDecimal()).times(sqrtPrice).truncate(token1.decimals.toI32());
  pool.lpBorrowedBalancePlusInterestInToken0 = pool.lpBorrowedBalancePlusInterestInToken1.div(lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lpBorrowedBalancePlusInterestETH = pool.lpBorrowedBalancePlusInterestInToken0.times(token0.priceETH);
  pool.lpBorrowedBalancePlusInterestUSD = pool.lpBorrowedBalancePlusInterestInToken0.times(token0.priceUSD).truncate(2);

  const token0InToken1 = pool.token0Balance.times(lastPrice).div(precision0).div(precision1).toBigDecimal();
  const allTokensInToken1 = token0InToken1.plus(pool.token1Balance.div(precision1).toBigDecimal());
  const tokensInETH = allTokensInToken1.times(token1.priceETH).truncate(2);
  const tokensInUSD = allTokensInToken1.times(token1.priceUSD).truncate(2);

  pool.tvlETH = pool.lpBalanceETH.plus(tokensInETH);
  pool.tvlUSD = pool.lpBalanceUSD.plus(tokensInUSD);

  pool.lastCfmmInToken1 = BigDecimal.fromString('2').times(lastCfmmInvariant.toBigDecimal()).times(sqrtPrice).truncate(token1.decimals.toI32());
  pool.lastCfmmInToken0 = pool.lastCfmmInToken1.div(lastPrice.toBigDecimal()).times(precision1.toBigDecimal()).truncate(token0.decimals.toI32());
  pool.lastCfmmETH = pool.lastCfmmInToken0.times(token0.priceETH);
  pool.lastCfmmUSD = pool.lastCfmmInToken0.times(token0.priceUSD).truncate(2)
}

export function updateLoanStats(loan: Loan): void {
  const pool = GammaPool.load(loan.pool);
  if (pool == null) return;

  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (token0 == null || token1 == null || !isTokenValid(token0) || !isTokenValid(token1)) return;

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

export function updatePairStats(token0: Token, token1: Token, pair: DeltaSwapPair): void {
  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32()).toBigDecimal();
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32()).toBigDecimal();

  const reserve0Decimal = pair.reserve0.toBigDecimal().div(precision0);
  const reserve1Decimal = pair.reserve1.toBigDecimal().div(precision1);

  const zero = BigDecimal.zero();

  if(token0.priceUSD.gt(zero) && token1.priceUSD.gt(zero)) {
    const reserve0USD = reserve0Decimal.times(token0.priceUSD).truncate(6);
    const reserve1USD = reserve1Decimal.times(token1.priceUSD).truncate(6);
    pair.liquidityUSD = reserve0USD.plus(reserve1USD);
  }

  if(token0.priceETH.gt(zero) && token1.priceETH.gt(zero)) {
    const reserve0ETH = reserve0Decimal.times(token0.priceETH).truncate(18);
    const reserve1ETH = reserve1Decimal.times(token1.priceETH).truncate(18);
    pair.liquidityETH = reserve0ETH.plus(reserve1ETH);
  }
}

export function shouldUpdate(hasPool: boolean, isTracked: boolean, timestamp: BigInt, reserve0: BigInt, reserve1: BigInt, newTimestamp: BigInt, newReserve0: BigInt, newReserve1: BigInt): boolean {
  if(!hasPool && !isTracked) {
    return false;
  }

  const throttleThreshold = BigInt.fromString((isTracked ? TRACKED_THROTTLE_THRESHOLD : THROTTLE_THRESHOLD) || "0");
  const throttleSeconds = BigInt.fromString((isTracked ? TRACKED_THROTTLE_SECONDS : THROTTLE_SECONDS) || "0");

  const _100 = BigInt.fromString("100");
  const hiNum = _100.plus(throttleThreshold);
  const loNum = throttleThreshold.gt(_100) ? BigInt.zero() : _100.minus(throttleThreshold);
  const upperBound0 = reserve0.times(hiNum).div(_100);
  const upperBound1 = reserve1.times(hiNum).div(_100);
  const lowerBound0 = reserve0.times(loNum).div(_100);
  const lowerBound1 = reserve1.times(loNum).div(_100);
  const ignoreThrottle = newReserve0.lt(lowerBound0) || newReserve1.lt(lowerBound1) ||
      newReserve0.gt(upperBound0) || newReserve1.gt(upperBound1)

  return timestamp.le(newTimestamp.minus(throttleSeconds)) || ignoreThrottle;
}

export function shouldUpdateV3(pair: DeltaSwapPair, newTimestamp: BigInt, newLiquidity: BigInt, newSqrtPriceX96: BigInt): boolean {
  if(!pair.isTracked) {
    return false;
  }

  const throttleThreshold = BigInt.fromString(TRACKED_THROTTLE_THRESHOLD || "0");
  const throttleSeconds = BigInt.fromString(TRACKED_THROTTLE_SECONDS || "0");

  const precision0 = BigInt.fromI32(10).pow(<u8>pair.decimals0.toI32());

  const x96 = BigInt.fromI32(2).pow(<u8>BigInt.fromI32(96).toI32());
  const precision0Sqrt = precision0.sqrt();

  const sqrtPrice = pair.sqrtPriceX96.times(precision0Sqrt).div(x96);
  const price = sqrtPrice.times(sqrtPrice);

  const newSqrtPrice = newSqrtPriceX96.times(precision0Sqrt).div(x96);
  const newPrice = newSqrtPrice.times(newSqrtPrice);

  const _100 = BigInt.fromString("100");
  const hiNum = _100.plus(throttleThreshold);
  const loNum = throttleThreshold.gt(_100) ? BigInt.zero() : _100.minus(throttleThreshold);
  const liqUpperBound = pair.liquidity.times(hiNum).div(_100);
  const liqLowerBound = pair.liquidity.times(loNum).div(_100);
  const priceUpperBound = price.times(hiNum).div(_100);
  const priceLowerBound = price.times(loNum).div(_100);
  const ignoreThrottle = newLiquidity.lt(liqLowerBound) || newLiquidity.gt(liqUpperBound) ||
      newPrice.lt(priceLowerBound) || newPrice.gt(priceUpperBound)

  return pair.timestamp.le(newTimestamp.minus(throttleSeconds)) || ignoreThrottle;
}

export function updatePairFromSync(id: string, timestamp: BigInt, blockNumber: BigInt, reserve0: BigInt, reserve1: BigInt) : void {
  const pair = DeltaSwapPair.load(id);
  if (pair == null) {
    log.error("DeltaSwap Pair Unavailable: {}", [id]);
    return;
  }

  const hasPool = pair.pool != ADDRESS_ZERO;

  if(pair.protocol != BigInt.fromString('3')) {
    if(!shouldUpdate(hasPool, pair.isTracked, pair.timestamp, pair.reserve0, pair.reserve1, timestamp, reserve0, reserve1)) {
      return;
    }
  }

  pair.timestamp = timestamp;

  const token0 = Token.load(pair.token0);
  const token1 = Token.load(pair.token1);

  if (token0 == null || token1 == null) {
    log.error("DeltaSwap Sync: Tokens Unavailable for pair {}", [id]);
    return;
  }

  if (token0.decimals == BigInt.zero() || token1.decimals == BigInt.zero()) {
    log.error("DeltaSwap Sync: Tokens Decimals are Zero for pair {}", [id]);
    return;
  }

  if(pair.protocol == BigInt.fromString('3')) {
    token0.dsBalanceBN = token0.dsBalanceBN.minus(pair.reserve0).plus(reserve0);
    token1.dsBalanceBN = token1.dsBalanceBN.minus(pair.reserve1).plus(reserve1);
  }

  if(pair.totalSupply.equals(BigInt.zero())) {
    const pairContract = ERC20.bind(Address.fromString(id));
    pair.totalSupply = pairContract.totalSupply();
    pair.startBlock = blockNumber;
  }

  const pool = GammaPool.load(pair.pool);
  const hasFloat = pair.totalSupply.gt(BigInt.zero());
  if (pool != null && hasFloat) {
    const poolReserve0 = pool.lpBalance.times(reserve0).div(pair.totalSupply);
    const poolReserve1 = pool.lpBalance.times(reserve1).div(pair.totalSupply);

    token0.lpBalanceBN = token0.lpBalanceBN.minus(pool.lpReserve0).plus(poolReserve0);
    token1.lpBalanceBN = token1.lpBalanceBN.minus(pool.lpReserve1).plus(poolReserve1);

    // Sync events update the pool lpReserves without a PoolUpdate event.
    // So still need to go through here for protocol 3
    // Sync events are always emitted with PoolUpdate events
    pool.lpReserve0 = poolReserve0;
    pool.lpReserve1 = poolReserve1;
    pool.save();
  }

  pair.reserve0 = reserve0;
  pair.reserve1 = reserve1;

  let price = getPriceFromReserves(token0, token1, pair.reserve0, pair.reserve1);

  if(pool!=null && hasFloat) {
    const borrowedBalance0 = pool.lpBorrowedBalance.times(pair.reserve0).div(pair.totalSupply);
    const borrowedBalance1 = pool.lpBorrowedBalance.times(pair.reserve1).div(pair.totalSupply);
    token0.borrowedBalanceBN = token0.borrowedBalanceBN.minus(pool.borrowedBalance0).plus(borrowedBalance0);
    token1.borrowedBalanceBN = token1.borrowedBalanceBN.minus(pool.borrowedBalance1).plus(borrowedBalance1);
    pool.borrowedBalance0 = borrowedBalance0;
    pool.borrowedBalance1 = borrowedBalance1;
  }

  updateTokenPrices(token0, token1, price);
  updatePairStats(token0, token1, pair);

  pair.save();

  const hasPrice = price.gt(BigDecimal.zero());
  if(pool != null && hasPrice && hasFloat) {
    updatePoolStats(token0, token1, pool, pair);
  }

  if(pool != null) {
    pool.save();
  }

  token0.save();
  token1.save();
}

export function updatePairFromV3Swap(id: string, timestamp: BigInt, liquidity: BigInt, sqrtPriceX96: BigInt) : void {
  const pair = DeltaSwapPair.load(id);
  if (pair == null) {
    log.error("UniswapV3 Pair Unavailable: {}", [id]);
    return;
  }
  if(!shouldUpdateV3(pair, timestamp, liquidity, sqrtPriceX96)) {
    return;
  }

  pair.timestamp = timestamp;

  const token0 = Token.load(pair.token0);
  const token1 = Token.load(pair.token1);

  if (token0 == null || token1 == null) {
    log.error("UniswapV3 Sync: Tokens Unavailable for pair {}", [id]);
    return;
  }

  if (token0.decimals == BigInt.zero() || token1.decimals == BigInt.zero()) {
    log.error("UniswapV3 Sync: Tokens Decimals are Zero for pair {}", [id]);
    return;
  }

  const token0Address = Address.fromString(pair.token0);
  const token0Contract = ERC20.bind(token0Address);
  const token1Address = Address.fromString(pair.token1);
  const token1Contract = ERC20.bind(token1Address);
  const ammAddress = Address.fromString(id);

  const newReserves0 = token0Contract.try_balanceOf(ammAddress);
  if(newReserves0.reverted) {
    log.error("0 Failed to get balance of token {} in pair {}", [pair.token0, id]);
    return;
  }

  const newReserves1 = token1Contract.try_balanceOf(ammAddress);
  if(newReserves1.reverted) {
    log.error("1 Failed to get balance of token {} in pair {}", [pair.token1, id]);
    return;
  }

  pair.liquidity = liquidity;
  pair.sqrtPriceX96 = sqrtPriceX96;

  updateTokenAndPairReserves(pair, token0, token1, newReserves0.value, newReserves1.value, sqrtPriceX96);
}

export function updateTokenAndPairReserves(pair: DeltaSwapPair, token0: Token, token1: Token, newReserves0: BigInt, newReserves1: BigInt, sqrtPriceX96: BigInt) : void {
  pair.reserve0 = newReserves0;
  pair.reserve1 = newReserves1;

  let price = BigDecimal.zero();

  if(sqrtPriceX96.gt(BigInt.zero())) {
    price = decodePrice(sqrtPriceX96, token0, token1);
  }

  if(price.equals(BigDecimal.zero())) {
    price = getPriceFromReserves(token0, token1, pair.reserve0, pair.reserve1);
  }

  updateTokenPrices(token0, token1, price);
  updatePairStats(token0, token1, pair);

  pair.save();
  token0.save();
  token1.save();
}

export function decodePrice(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigDecimal {
  const x96 = BigInt.fromI32(2).pow(96);
  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const sqrtPrice = sqrtPriceX96.times(precision0.sqrt()).div(x96);
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32()).toBigDecimal();
  return sqrtPrice.times(sqrtPrice).toBigDecimal().div(precision1);
}