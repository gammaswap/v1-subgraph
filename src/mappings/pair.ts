import { Address, BigInt, log } from '@graphprotocol/graph-ts';
import { Token } from '../types/schema';
import { Sync, Transfer } from '../types/templates/DeltaSwapPair/DeltaSwapPair';
import { ERC20 } from '../types/templates/DeltaSwapPair/ERC20';
import { DeltaSwapPair, GammaPool } from '../types/schema';
import { getPriceFromReserves, updateTokenPrices } from '../helpers/utils';
import { ADDRESS_ZERO } from "../helpers/constants";

export function handleSync(event: Sync): void {
  log.warning("Sync Event: {}", [event.address.toHexString()]);
  const id = event.address.toHexString();
  const pair = DeltaSwapPair.load(id);
  if (pair == null) {
    log.error("DeltaSwap Pair Unavailable: {}", [event.address.toHexString()]);
    return;
  }

  const token0 = Token.load(pair.token0);
  const token1 = Token.load(pair.token1);

  if (token0 == null || token1 == null) {
    log.error("DeltaSwap Sync: Tokens Unavailable", []);
    return;
  }

  if(pair.protocol == BigInt.fromString('3')) {
    token0.dsBalanceBN = token0.dsBalanceBN.minus(pair.reserve0).plus(event.params.reserve0);
    token1.dsBalanceBN = token1.dsBalanceBN.minus(pair.reserve1).plus(event.params.reserve1);
    token0.lpBalanceBN = token0.lpBalanceBN.minus(pair.reserve0).plus(event.params.reserve0);
    token1.lpBalanceBN = token1.lpBalanceBN.minus(pair.reserve1).plus(event.params.reserve1);
  }

  if(pair.totalSupply.equals(BigInt.zero())) {
    const pairContract = ERC20.bind(Address.fromString(id));
    pair.totalSupply = pairContract.totalSupply();
  }

  const pool = GammaPool.load(pair.pool);
  if (pool != null && pair.totalSupply.gt(BigInt.zero())) {
    const poolReserve0 = pool.lpBalance.times(event.params.reserve0).div(pair.totalSupply);
    const poolReserve1 = pool.lpBalance.times(event.params.reserve1).div(pair.totalSupply);

    if(pair.protocol != BigInt.fromString('3')) {
      token0.lpBalanceBN = token0.lpBalanceBN.minus(pool.lpReserve0).plus(poolReserve0);
      token1.lpBalanceBN = token1.lpBalanceBN.minus(pool.lpReserve1).plus(poolReserve1);
    }

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

  updateTokenPrices(token0, token1, price);

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
    log.error("DeltaSwap Sync: Tokens Unavailable", []);
    return;
  }

  if(pair.totalSupply.gt(BigInt.zero())) {
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