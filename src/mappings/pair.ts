import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { Token } from '../types/schema';
import { Sync, Transfer } from '../types/templates/DeltaSwapPair/DeltaSwapPair';
import { ERC20 } from '../types/templates/DeltaSwapPair/ERC20';
import { DeltaSwapPair, GammaPool } from '../types/schema';
import { getPriceFromReserves, updatePoolStats, updateTokenPrices } from '../helpers/utils';
import { ADDRESS_ZERO, THROTTLE_SECONDS, THROTTLE_THRESHOLD } from "../helpers/constants";

export function handleSync(event: Sync): void {
  log.warning("Sync Event: {}", [event.address.toHexString()]);
  const id = event.address.toHexString();
  const pair = DeltaSwapPair.load(id);
  if (pair == null) {
    log.error("DeltaSwap Pair Unavailable: {}", [event.address.toHexString()]);
    return;
  }

  const throttleThreshold = BigInt.fromString(THROTTLE_THRESHOLD || "0");
  const throttleSeconds = BigInt.fromString(THROTTLE_SECONDS);

  const _100 = BigInt.fromString("100");
  const hiNum = _100.plus(throttleThreshold);
  const loNum = throttleThreshold.gt(_100) ? BigInt.zero() : _100.minus(throttleThreshold);
  const upperBound0 = pair.reserve0.times(hiNum).div(_100);
  const upperBound1 = pair.reserve1.times(hiNum).div(_100);
  const lowerBound0 = pair.reserve0.times(loNum).div(_100);
  const lowerBound1 = pair.reserve1.times(loNum).div(_100);
  const ignoreThrottle = event.params.reserve0.lt(lowerBound0) || event.params.reserve1.lt(lowerBound1) ||
      event.params.reserve0.gt(upperBound0) || event.params.reserve1.gt(upperBound1)

  // throttle Non DS Pairs
  if(pair.protocol != BigInt.fromString('3') && (pair.timestamp.gt(event.block.timestamp.minus(throttleSeconds))
    && !ignoreThrottle)) {
    return;
  }

  pair.timestamp = event.block.timestamp;

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
    token0.dsBalanceBN = token0.dsBalanceBN.minus(pair.reserve0).plus(event.params.reserve0);
    token1.dsBalanceBN = token1.dsBalanceBN.minus(pair.reserve1).plus(event.params.reserve1);
  }

  if(pair.totalSupply.equals(BigInt.zero())) {
    const pairContract = ERC20.bind(Address.fromString(id));
    pair.totalSupply = pairContract.totalSupply();
    pair.startBlock = event.block.number;
  }

  const pool = GammaPool.load(pair.pool);
  const hasFloat = pair.totalSupply.gt(BigInt.zero());
  if (pool != null && hasFloat) {
    const poolReserve0 = pool.lpBalance.times(event.params.reserve0).div(pair.totalSupply);
    const poolReserve1 = pool.lpBalance.times(event.params.reserve1).div(pair.totalSupply);

    token0.lpBalanceBN = token0.lpBalanceBN.minus(pool.lpReserve0).plus(poolReserve0);
    token1.lpBalanceBN = token1.lpBalanceBN.minus(pool.lpReserve1).plus(poolReserve1);

    // Sync events update the pool lpReserves without a PoolUpdate event.
    // So still need to go through here for protocol 3
    // Sync events are always emitted with PoolUpdate events
    pool.lpReserve0 = poolReserve0;
    pool.lpReserve1 = poolReserve1;
    pool.save();
  }

  pair.reserve0 = event.params.reserve0;
  pair.reserve1 = event.params.reserve1;
  pair.save();

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

export function handleTransfer(event: Transfer): void {
  log.warning("Transfer Event: {}", [event.address.toHexString()]);
  const id = event.address.toHexString();
  const pair = DeltaSwapPair.load(event.address.toHexString());
  if (pair == null) {
    log.error("DeltaSwap Pair Unavailable: {}", [event.address.toHexString()]);
    return;
  }

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

  if(event.block.number.gt(pair.startBlock) && pair.totalSupply.gt(BigInt.zero())) {
    const from = event.params.from.toHexString();
    const to = event.params.to.toHexString();
    if(from == ADDRESS_ZERO) { // from zero is always a mint
      pair.totalSupply = pair.totalSupply.plus(event.params.value);
      pair.save();
    } else if(to == ADDRESS_ZERO && from == id){ // from pair to zero is always burn
      pair.totalSupply = pair.totalSupply.minus(event.params.value);
      pair.save();
    }
  }
}