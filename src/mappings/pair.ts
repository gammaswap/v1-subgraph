import {log, BigInt, Address} from '@graphprotocol/graph-ts';
import { Token } from '../types/schema';
import { Sync } from '../types/templates/DeltaSwapPair/DeltaSwapPair';
import { DeltaSwapPair } from '../types/schema';
import { updatePrices2, getPoolViewerAddress } from '../helpers/utils';
import { PoolViewer } from "../types/templates/GammaPool/PoolViewer";

export function handleSync(event: Sync): void {
  log.warning("Sync Event: {}", [event.address.toHexString()]);
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

  const ratio = event.params.reserve1
    .times(BigInt.fromI32(10).pow(<u8>token0.decimals.toI32()))
    .div(event.params.reserve0);

  const poolViewerAddress = getPoolViewerAddress(event.block.number);
  const poolViewer = PoolViewer.bind(poolViewerAddress);
  updatePrices2(token0, token1, ratio, poolViewer);
}
