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

export function oneEthInUsd(): BigInt {
  let token0Address = ADDRESS_ZERO;
  let token1Address = ADDRESS_ZERO;
  let reserve0 = BigInt.fromI32(0);
  let reserve1 = BigInt.fromI32(0);
  let tryUniPair = true;

  const zero = BigInt.zero();
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

    if (reserve0 == BigInt.zero() || reserve1 == BigInt.zero()) return zero;

    token0Address = pairContract.token0().toHexString();
    token1Address = pairContract.token1().toHexString();
  }

  if(token0Address == ADDRESS_ZERO || token1Address == ADDRESS_ZERO || reserve0 == BigInt.zero() || reserve1 == BigInt.zero()) return zero;

  const token0 = tryUniPair ? loadOrCreateToken(token0Address) : Token.load(token0Address);
  const token1 = tryUniPair ? loadOrCreateToken(token1Address) : Token.load(token1Address);

  if (token0 == null || token1 == null || !isTokenValid(token0) || !isTokenValid(token1)) return zero;

  let price = getPriceFromReserves(token0, token1, reserve0, reserve1);

  if(token0.symbol.indexOf('USD') >= 0 && price.gt(zero)) {
    const one = BigInt.fromI32(10).pow(18);
    price = one.times(one).div(price); // ensure price is always in terms of USD
  }

  return price;
}

export function adjustBigInt(amount: BigInt, decimals: number) : BigInt {
  if(decimals < 18) {
    const adjDecimals = 18 - decimals;
    const factor = BigInt.fromI32(10).pow(<u8>adjDecimals);
    return amount.times(factor);
  }
  return amount;
}

export function getPriceFromReserves(token0: Token, token1: Token, reserve0:BigInt, reserve1: BigInt) : BigInt {
  const _reserve0 = adjustBigInt(reserve0, token0.decimals.toI32());
  const _reserve1 = adjustBigInt(reserve1, token1.decimals.toI32());

  let price = BigInt.zero();
  if (_reserve0.gt(price)) {
    const factor = BigInt.fromI32(10).pow(18);
    price = _reserve1.times(factor).div(_reserve0);
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

export function updateTokenPrices(token0: Token, token1: Token, pairPrice: BigInt): void {
  log.warning("Update token prices from deltaswap: {}, {}, {}", [token0.id, token1.id, pairPrice.toString()]);

  const about = loadOrCreateAbout();

  decreaseAboutTotals(about, token0, token1);

  const ethToUsd = oneEthInUsd();

  token0.balanceBN = token0.gsBalanceBN.plus(token0.lpBalanceBN);
  token1.balanceBN = token1.gsBalanceBN.plus(token1.lpBalanceBN);

  const precision0BN = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const precision1BN = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());

  const precision0 = precision0BN.toBigDecimal();
  const precision1 = precision1BN.toBigDecimal();

  const ONE_BN = BigInt.fromI32(10).pow(18);
  const ONE = ONE_BN.toBigDecimal();

  // There needs to be a market against WETH or a USD token to get the value of a token
  if (token0.id.toLowerCase() == WETH) {
    token0.priceETH = BigDecimal.fromString('1');
    const priceUSDBN0 = ethToUsd;
    token0.priceUSD = priceUSDBN0.divDecimal(ONE).truncate(6);
    let priceETHBN1 = BigInt.zero();
    let priceUSDBN1 = BigInt.zero();
    if(pairPrice.gt(BigInt.zero())) {
      priceETHBN1 = ONE_BN.times(ONE_BN).div(pairPrice);
      token1.priceETH = priceETHBN1.divDecimal(ONE).truncate(18);
      priceUSDBN1 = priceETHBN1.times(ethToUsd).div(ONE_BN);
      token1.priceUSD = priceUSDBN1.divDecimal(ONE).truncate(6);
    } else {
      priceETHBN1 = BigInt.fromString(token1.priceETH.times(ONE).truncate(0).toString());
      priceUSDBN1 = BigInt.fromString(token1.priceUSD.times(ONE).truncate(0).toString());
    }

    token0.balanceETH = token0.balanceBN.divDecimal(precision0).truncate(18);
    token0.balanceUSD = token0.balanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token1.balanceETH = token1.balanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.balanceUSD = token1.balanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

    token0.dsBalanceETH = token0.dsBalanceBN.divDecimal(precision0).truncate(18);
    token0.dsBalanceUSD = token0.dsBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token1.dsBalanceETH = token1.dsBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.dsBalanceUSD = token1.dsBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

    token0.lpBalanceETH = token0.lpBalanceBN.divDecimal(precision0).truncate(18);
    token0.lpBalanceUSD = token0.lpBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token1.lpBalanceETH = token1.lpBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.lpBalanceUSD = token1.lpBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

    token0.gsBalanceETH = token0.gsBalanceBN.divDecimal(precision0).truncate(18);
    token0.gsBalanceUSD = token0.gsBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token1.gsBalanceETH = token1.gsBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.gsBalanceUSD = token1.gsBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

    token0.borrowedBalanceETH = token0.borrowedBalanceBN.divDecimal(precision0).truncate(18);
    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token1.borrowedBalanceETH = token1.borrowedBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
  } else if (token1.id.toLowerCase() == WETH) {
    token1.priceETH = BigDecimal.fromString('1');
    const priceUSDBN1 = ethToUsd;
    token1.priceUSD = priceUSDBN1.divDecimal(ONE).truncate(6);
    let priceETHBN0 = BigInt.zero();
    let priceUSDBN0 = BigInt.zero();
    if(pairPrice.gt(BigInt.zero())) {
      priceETHBN0 = pairPrice;
      token0.priceETH = priceETHBN0.divDecimal(ONE).truncate(18);
      priceUSDBN0 = priceETHBN0.times(priceUSDBN1).div(ONE_BN);
      token0.priceUSD = priceUSDBN0.divDecimal(ONE).truncate(6);
    } else {
      priceETHBN0 = BigInt.fromString(token0.priceETH.times(ONE).truncate(0).toString());
      priceUSDBN0 = BigInt.fromString(token0.priceUSD.times(ONE).truncate(0).toString());
    }

    token1.balanceETH = token1.balanceBN.divDecimal(precision1).truncate(18);
    token1.balanceUSD = token1.balanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token0.balanceETH = token0.balanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.balanceUSD = token0.balanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

    token1.dsBalanceETH = token1.dsBalanceBN.divDecimal(precision1).truncate(18);
    token1.dsBalanceUSD = token1.dsBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token0.dsBalanceETH = token0.dsBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.dsBalanceUSD = token0.dsBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

    token1.lpBalanceETH = token1.lpBalanceBN.divDecimal(precision1).truncate(18);
    token1.lpBalanceUSD = token1.lpBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token0.lpBalanceETH = token0.lpBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.lpBalanceUSD = token0.lpBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

    token1.gsBalanceETH = token1.gsBalanceBN.divDecimal(precision1).truncate(18);
    token1.gsBalanceUSD = token1.gsBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token0.gsBalanceETH = token0.gsBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.gsBalanceUSD = token0.gsBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

    token1.borrowedBalanceETH = token1.borrowedBalanceBN.divDecimal(precision1).truncate(18);
    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token0.borrowedBalanceETH = token0.borrowedBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
  } else if(isStableToken(token0)) {
    token0.priceUSD = BigDecimal.fromString('1');
    let priceUSDBN1 = BigInt.zero();
    let priceETHBN1 = BigInt.zero();
    const priceETHBN0 = ONE_BN.times(ONE_BN).div(ethToUsd);
    token0.priceETH = priceETHBN0.divDecimal(ONE).truncate(18);
    if(pairPrice.gt(BigInt.zero())) {
      priceUSDBN1 = ONE_BN.times(ONE_BN).div(pairPrice);
      token1.priceUSD = priceUSDBN1.divDecimal(ONE).truncate(6);
      priceETHBN1 = priceUSDBN1.times(ONE_BN).div(ethToUsd);
      token1.priceETH = priceETHBN1.divDecimal(ONE).truncate(18);
    } else {
      priceUSDBN1 = BigInt.fromString(token1.priceUSD.times(ONE).truncate(0).toString());
      priceETHBN1 = BigInt.fromString(token1.priceETH.times(ONE).truncate(0).toString());
    }

    token0.balanceUSD = token0.balanceBN.divDecimal(precision0).truncate(6);
    token0.balanceETH = token0.balanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token1.balanceUSD = token1.balanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token1.balanceETH = token1.balanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);

    token0.dsBalanceUSD = token0.dsBalanceBN.divDecimal(precision0).truncate(6);
    token0.dsBalanceETH = token0.dsBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token1.dsBalanceUSD = token1.dsBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token1.dsBalanceETH = token1.dsBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);

    token0.lpBalanceUSD = token0.lpBalanceBN.divDecimal(precision0).truncate(6);
    token0.lpBalanceETH = token0.lpBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token1.lpBalanceUSD = token1.lpBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token1.lpBalanceETH = token1.lpBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);

    token0.gsBalanceUSD = token0.gsBalanceBN.divDecimal(precision0).truncate(6);
    token0.gsBalanceETH = token0.gsBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token1.gsBalanceUSD = token1.gsBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token1.gsBalanceETH = token1.gsBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);

    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.divDecimal(precision0).truncate(6);
    token0.borrowedBalanceETH = token0.borrowedBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
    token1.borrowedBalanceETH = token1.borrowedBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
  } else if(isStableToken(token1)) {
    token1.priceUSD = BigDecimal.fromString('1');
    let priceUSDBN0 = BigInt.zero();
    let priceETHBN0 = BigInt.zero();
    const priceETHBN1 = ONE_BN.times(ONE_BN).div(ethToUsd);
    token1.priceETH = priceETHBN1.divDecimal(ONE).truncate(18);
    if(pairPrice.gt(BigInt.zero())) {
      priceUSDBN0 = pairPrice;
      token0.priceUSD = priceUSDBN0.divDecimal(ONE).truncate(6);
      priceETHBN0 = priceUSDBN0.times(ONE_BN).div(ethToUsd);
      token0.priceETH = priceETHBN0.divDecimal(ONE).truncate(18);
    } else {
      priceETHBN0 = BigInt.fromString(token0.priceETH.times(ONE).truncate(0).toString());
      priceUSDBN0 = BigInt.fromString(token0.priceUSD.times(ONE).truncate(0).toString());
    }

    token1.balanceUSD = token1.balanceBN.divDecimal(precision1).truncate(6);
    token1.balanceETH = token1.balanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token0.balanceUSD = token0.balanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token0.balanceETH = token0.balanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);

    token1.dsBalanceUSD = token1.dsBalanceBN.divDecimal(precision1).truncate(6);
    token1.dsBalanceETH = token1.dsBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token0.dsBalanceUSD = token0.dsBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token0.dsBalanceETH = token0.dsBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);

    token1.lpBalanceUSD = token1.lpBalanceBN.divDecimal(precision1).truncate(6);
    token1.lpBalanceETH = token1.lpBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token0.lpBalanceUSD = token0.lpBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token0.lpBalanceETH = token0.lpBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);

    token1.gsBalanceUSD = token1.gsBalanceBN.divDecimal(precision1).truncate(6);
    token1.gsBalanceETH = token1.gsBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token0.gsBalanceUSD = token0.gsBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token0.gsBalanceETH = token0.gsBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);

    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.divDecimal(precision1).truncate(6);
    token1.borrowedBalanceETH = token1.borrowedBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
    token0.borrowedBalanceETH = token0.borrowedBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
  } else if (token0.id.toLowerCase() == WEETH) {
    let priceUSDBN1 = BigInt.zero();
    let priceETHBN1 = BigInt.zero();
    if(pairPrice.gt(BigInt.zero())) {
      priceETHBN1 = BigInt.fromString(token0.priceETH.times(ONE).truncate(0).toString()).times(ONE_BN).div(pairPrice);
      token1.priceETH = priceETHBN1.divDecimal(ONE).truncate(18);
      priceUSDBN1 = priceETHBN1.times(ethToUsd).div(ONE_BN);
      token1.priceUSD = priceUSDBN1.divDecimal(ONE).truncate(6);
    } else {
      priceETHBN1 = BigInt.fromString(token1.priceETH.times(ONE).truncate(0).toString());
      priceUSDBN1 = BigInt.fromString(token1.priceUSD.times(ONE).truncate(0).toString());
    }

    token1.balanceETH = token1.balanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.balanceUSD = token1.balanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

    token1.dsBalanceETH = token1.dsBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.dsBalanceUSD = token1.dsBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

    token1.lpBalanceETH = token1.lpBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.lpBalanceUSD = token1.lpBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

    token1.gsBalanceETH = token1.gsBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.gsBalanceUSD = token1.gsBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

    token1.borrowedBalanceETH = token1.borrowedBalanceBN.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
    token1.borrowedBalanceUSD = token1.borrowedBalanceBN.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
  } else if (token1.id.toLowerCase() == WEETH) {
    let priceUSDBN0 = BigInt.zero();
    let priceETHBN0 = BigInt.zero();
    if(pairPrice.gt(BigInt.zero())) {
      priceETHBN0 = BigInt.fromString(token1.priceETH.times(ONE).truncate(0).toString()).times(pairPrice).div(ONE_BN);
      token0.priceETH = priceETHBN0.divDecimal(ONE).truncate(18);
      priceUSDBN0 = priceETHBN0.times(ethToUsd).div(ONE_BN);
      token0.priceUSD = priceUSDBN0.divDecimal(ONE).truncate(6);
    } else {
      priceETHBN0 = BigInt.fromString(token0.priceETH.times(ONE).truncate(0).toString());
      priceUSDBN0 = BigInt.fromString(token0.priceUSD.times(ONE).truncate(0).toString());
    }

    token0.balanceETH = token0.balanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.balanceUSD = token0.balanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

    token0.dsBalanceETH = token0.dsBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.dsBalanceUSD = token0.dsBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

    token0.lpBalanceETH = token0.lpBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.lpBalanceUSD = token0.lpBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

    token0.gsBalanceETH = token0.gsBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.gsBalanceUSD = token0.gsBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

    token0.borrowedBalanceETH = token0.borrowedBalanceBN.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
    token0.borrowedBalanceUSD = token0.borrowedBalanceBN.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
  }

  increaseAboutTotals(about, token0, token1);

  about.save();
}

export function updatePoolStats(token0: Token, token1: Token, pool: GammaPool, pair: DeltaSwapPair): void {
  const decimals0 = token0.decimals.toI32();
  const decimals1 = token1.decimals.toI32();
  const precision0BN = BigInt.fromI32(10).pow(<u8>decimals0);
  const precision1BN = BigInt.fromI32(10).pow(<u8>decimals1);
  const precision0 = precision0BN.toBigDecimal();
  const precision1 = precision1BN.toBigDecimal();
  const reserve0BN = pair.reserve0;
  const reserve1BN = pair.reserve1;

  const lastCfmmInvariantBN = reserve0BN.times(reserve1BN).sqrt();
  const lastCfmmTotalSupplyBN = pair.totalSupply;

  const lpBalanceInToken1BN = pool.lpBalance.times(BigInt.fromI32(2)).times(reserve1BN).div(lastCfmmTotalSupplyBN);
  const lpBalanceInToken0BN = lpBalanceInToken1BN.times(reserve0BN).div(reserve1BN);

  pool.lpBalanceInToken1 = lpBalanceInToken1BN.divDecimal(precision1).truncate(decimals1);
  pool.lpBalanceInToken0 = lpBalanceInToken0BN.divDecimal(precision0).truncate(decimals0);

  const ONE_BN = BigInt.fromI32(10).pow(18);
  const ONE = ONE_BN.toBigDecimal();

  const priceETHBN0 = BigInt.fromString(token0.priceETH.times(ONE).truncate(0).toString());
  const priceUSDBN0 = BigInt.fromString(token0.priceUSD.times(ONE).truncate(0).toString());

  const lpBalanceETH = lpBalanceInToken0BN.times(priceETHBN0).div(precision0BN);
  const lpBalanceUSD = lpBalanceInToken0BN.times(priceUSDBN0).div(precision0BN);
  pool.lpBalanceETH = lpBalanceETH.divDecimal(ONE).truncate(18);
  pool.lpBalanceUSD = lpBalanceUSD.divDecimal(ONE).truncate(6);

  const lastCfmmInToken0 = BigInt.fromI32(2).times(reserve0BN);
  const lastCfmmInToken1 = BigInt.fromI32(2).times(reserve1BN);
  const lpBorrowedBalanceInToken1BN = pool.lpBorrowedBalance.times(lastCfmmInToken1).div(lastCfmmTotalSupplyBN);
  const lpBorrowedBalanceInToken0BN = lpBorrowedBalanceInToken1BN.times(reserve0BN).div(reserve1BN);
  pool.lpBorrowedBalanceInToken1 = lpBorrowedBalanceInToken1BN.divDecimal(precision1).truncate(decimals1);
  pool.lpBorrowedBalanceInToken0 = lpBorrowedBalanceInToken0BN.divDecimal(precision0).truncate(decimals0);

  const lpBorrowedBalanceETH = lpBorrowedBalanceInToken0BN.times(priceETHBN0).div(precision0BN);
  const lpBorrowedBalanceUSD = lpBorrowedBalanceInToken0BN.times(priceUSDBN0).div(precision0BN);
  pool.lpBorrowedBalanceETH = lpBorrowedBalanceETH.divDecimal(ONE).truncate(18);
  pool.lpBorrowedBalanceUSD = lpBorrowedBalanceUSD.divDecimal(ONE).truncate(6);

  const lpBorrowedBalancePlusInterestInToken1BN = pool.lpBorrowedInvariant.times(lastCfmmInToken1).div(lastCfmmInvariantBN);
  const lpBorrowedBalancePlusInterestInToken0BN = lpBorrowedBalancePlusInterestInToken1BN.times(reserve0BN).div(reserve1BN);
  pool.lpBorrowedBalancePlusInterestInToken1 = lpBorrowedBalancePlusInterestInToken1BN.divDecimal(precision1).truncate(decimals1);
  pool.lpBorrowedBalancePlusInterestInToken0 = lpBorrowedBalancePlusInterestInToken0BN.divDecimal(precision0).truncate(decimals0);

  const lpBorrowedBalancePlusInterestETH = lpBorrowedBalancePlusInterestInToken0BN.times(priceETHBN0).div(precision0BN);
  const lpBorrowedBalancePlusInterestUSD = lpBorrowedBalancePlusInterestInToken0BN.times(priceUSDBN0).div(precision0BN);
  pool.lpBorrowedBalancePlusInterestETH = lpBorrowedBalancePlusInterestETH.divDecimal(ONE).truncate(18);
  pool.lpBorrowedBalancePlusInterestUSD = lpBorrowedBalancePlusInterestUSD.divDecimal(ONE).truncate(6);

  const token0Balance = pool.token0Balance;
  const token1Balance = pool.token1Balance;
  const allTokensInToken0 = token0Balance.plus(token1Balance.times(reserve0BN).div(reserve1BN));
  const tokensInETH = allTokensInToken0.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
  const tokensInUSD = allTokensInToken0.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);

  pool.tvlETH = pool.lpBalanceETH.plus(tokensInETH);
  pool.tvlUSD = pool.lpBalanceUSD.plus(tokensInUSD);

  pool.lastCfmmInToken0 = lastCfmmInToken0.divDecimal(precision0).truncate(decimals0);
  pool.lastCfmmInToken1 = lastCfmmInToken1.divDecimal(precision1).truncate(decimals1);

  pool.lastCfmmETH = lastCfmmInToken0.times(priceETHBN0).div(precision0BN).divDecimal(ONE).truncate(18);
  pool.lastCfmmUSD = lastCfmmInToken0.times(priceUSDBN0).div(precision0BN).divDecimal(ONE).truncate(6);
}

export function updateLoanStats(loan: Loan, pair: DeltaSwapPair, token1: Token): void {
  const reserve1BalanceBN = pair.reserve1;
  const lastCfmmInvariantBN = pair.reserve1.times(pair.reserve0).sqrt();
  const precision1BN = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());

  const ONE = BigInt.fromI32(10).pow(18).toBigDecimal(); // 10^18
  const priceETHBN1 = BigInt.fromString(token1.priceETH.times(ONE).truncate(0).toString());
  const priceUSDBN1 = BigInt.fromString(token1.priceUSD.times(ONE).truncate(0).toString());

  const initLiquidityInToken1 = BigInt.fromI32(2).times(loan.initLiquidity).times(reserve1BalanceBN).div(lastCfmmInvariantBN);
  loan.initLiquidityETH = initLiquidityInToken1.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
  loan.initLiquidityUSD = initLiquidityInToken1.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);

  const liquidityInToken1 = BigInt.fromI32(2).times(loan.liquidity).times(reserve1BalanceBN).div(lastCfmmInvariantBN);
  loan.liquidityETH = liquidityInToken1.times(priceETHBN1).div(precision1BN).divDecimal(ONE).truncate(18);
  loan.liquidityUSD = liquidityInToken1.times(priceUSDBN1).div(precision1BN).divDecimal(ONE).truncate(6);
}

export function convertInvariantToToken(invariant: BigInt, reserve: BigInt, lastCfmmInvariant: BigInt): BigInt {
  return invariant.times(reserve.times(BigInt.fromI32(2))).div(lastCfmmInvariant);
}

export function updatePairStats(token0: Token, token1: Token, pair: DeltaSwapPair): void {
  const precision0BN = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const precision1BN = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());

  const ONE = BigInt.fromI32(10).pow(18).toBigDecimal(); // 10^18
  const priceETHBN0 = BigInt.fromString(token0.priceETH.times(ONE).truncate(0).toString());
  const priceUSDBN0 = BigInt.fromString(token0.priceUSD.times(ONE).truncate(0).toString());
  const priceETHBN1 = BigInt.fromString(token1.priceETH.times(ONE).truncate(0).toString());
  const priceUSDBN1 = BigInt.fromString(token1.priceUSD.times(ONE).truncate(0).toString());

  const reserve0 = pair.reserve0;
  const reserve1 = pair.reserve1;

  const zero = BigInt.zero();

  if(priceUSDBN0.gt(zero) && priceUSDBN1.gt(zero)) {
    const reserve0USD = reserve0.times(priceUSDBN0).div(precision0BN);
    const reserve1USD = reserve1.times(priceUSDBN1).div(precision1BN);
    pair.liquidityUSD = reserve0USD.plus(reserve1USD).divDecimal(ONE).truncate(6);
  }

  if(priceETHBN0.gt(zero) && priceETHBN1.gt(zero)) {
    const reserve0ETH = reserve0.times(priceETHBN0).div(precision0BN);
    const reserve1ETH = reserve1.times(priceETHBN1).div(precision1BN);
    pair.liquidityETH = reserve0ETH.plus(reserve1ETH).divDecimal(ONE).truncate(18);
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

  const price = decodePriceBN(pair.sqrtPriceX96, pair.decimals0, pair.decimals1);
  const newPrice = decodePriceBN(newSqrtPriceX96, pair.decimals0, pair.decimals1);

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

  const hasPrice = price.gt(BigInt.zero());
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

  const zero = BigInt.zero();
  let price = zero;

  if(sqrtPriceX96.gt(zero)) {
    price = decodePrice(sqrtPriceX96, token0, token1);
  }

  if(price.equals(zero)) {
    price = getPriceFromReserves(token0, token1, pair.reserve0, pair.reserve1);
  }

  updateTokenPrices(token0, token1, price);
  updatePairStats(token0, token1, pair);

  pair.save();
  token0.save();
  token1.save();
}

export function decodePrice(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigInt {
  const decimals0 = token0.decimals;
  const decimals1 = token1.decimals;

  return decodePriceBN(sqrtPriceX96, decimals0, decimals1);
}

export function decodePriceBN(sqrtPriceX96: BigInt, decimals0: BigInt, decimals1: BigInt): BigInt {
  const decimals0Num = decimals0.toI32();
  const decimals1Num = decimals1.toI32();
  const ONE = BigInt.fromI32(10).pow(18);

  if(decimals0Num > decimals1Num) {
    const decimalsDiff = decimals0Num - decimals1Num;
    const precisionDiffSqrt = BigInt.fromI32(10).pow(<u8>decimalsDiff).sqrt();
    sqrtPriceX96 = sqrtPriceX96.div(precisionDiffSqrt);
  } else if(decimals1Num > decimals0Num) {
    const decimalsDiff = decimals1Num - decimals0Num;
    const precisionDiffSqrt = BigInt.fromI32(10).pow(<u8>decimalsDiff).sqrt();
    sqrtPriceX96 = sqrtPriceX96.times(precisionDiffSqrt);
  }

  return _decodePriceBN(sqrtPriceX96, ONE);
}

function _decodePriceBN(sqrtPriceX96: BigInt, decimals: BigInt): BigInt {
  const sqrtPrice = _decodeSqrtPrice(sqrtPriceX96, decimals);
  return sqrtPrice.times(sqrtPrice);
}

function _decodeSqrtPrice(sqrtPriceX96: BigInt, decimals: BigInt): BigInt {
  const x96 = BigInt.fromI32(2).pow(<u8>BigInt.fromI32(96).toI32());
  return sqrtPriceX96.times(decimals.sqrt()).div(x96);
}