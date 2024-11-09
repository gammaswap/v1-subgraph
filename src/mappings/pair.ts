import { BigInt, log } from '@graphprotocol/graph-ts';
import { Token } from '../types/schema';
import { Sync, Transfer } from '../types/templates/DeltaSwapPair/DeltaSwapPair';
import { Sync as AeroSync } from '../types/templates/AeroPool/AeroPool';
import { Swap as AeroCLSwap } from '../types/templates/AeroCLPool/AeroCLPool';
import { Swap as UniV3Swap } from '../types/templates/UniswapV3Pool/UniswapV3Pool';
import { DeltaSwapPair } from '../types/schema';
import { updatePairFromSync, updatePairFromV3Swap } from '../helpers/utils';
import { ADDRESS_ZERO } from "../helpers/constants";

export function handleSync(event: Sync): void {
  const id = event.address.toHexString();
  log.warning("Sync Event: {}", [id]);
  updatePairFromSync(id, event.block.timestamp, event.block.number, event.params.reserve0, event.params.reserve1);
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

export function handleAeroSync(event: AeroSync): void {
  const id = event.address.toHexString();
  log.warning("Sync Event: {}", [id]);

  const timestamp = event.block.timestamp;
  const blockNumber = event.block.number;
  const newReserve0 = event.params.reserve0;
  const newReserve1 = event.params.reserve1;

  updatePairFromSync(id, timestamp, blockNumber, newReserve0, newReserve1);
}

export function handleAeroCLSwap(event: AeroCLSwap): void {
  const id = event.address.toHexString();
  log.warning("Sync Event: {}", [id]);
  updatePairFromV3Swap(id, event.block.timestamp, event.params.liquidity, event.params.sqrtPriceX96);
}

export function handleUniV3Swap(event: UniV3Swap): void {
  const id = event.address.toHexString();
  log.warning("Sync Event: {}", [id]);
  updatePairFromV3Swap(id, event.block.timestamp, event.params.liquidity, event.params.sqrtPriceX96);
}