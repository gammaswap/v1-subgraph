import { log } from '@graphprotocol/graph-ts';
import { Token } from '../types/schema';
import { Sync } from '../types/templates/DeltaSwapPair/DeltaSwapPair';
import { DeltaSwapPair } from '../types/schema';
import { isGapPeriod, getPriceFromDSPair, updateTokenPrices } from '../helpers/utils';

export function handleSync(event: Sync): void {
  log.warning("Sync Event: {}", [event.address.toHexString()]);
  const pair = DeltaSwapPair.load(event.address.toHexString());
  if (pair == null) {
    log.error("DeltaSwap Pair Unavailable: {}", [event.address.toHexString()]);
    return;
  }

  if(isGapPeriod(event.block.number)) { // to ignore v1-core@1.2.1 interface conflict (IPoolViewer & IGammaPool) in arbsepolia
    log.warning("Is Gap Period: {}", [event.block.number.toString()]);
    return;
  }

  const token0 = Token.load(pair.token0);
  const token1 = Token.load(pair.token1);

  if (token0 == null || token1 == null) {
    log.error("DeltaSwap Sync: Tokens Unavailable", []);
    return;
  }

  pair.reserve0 = event.params.reserve0;
  pair.reserve1 = event.params.reserve1;
  pair.save();

  const price = getPriceFromDSPair(pair);

  updateTokenPrices(token0, token1, price);
}
