import { log } from '@graphprotocol/graph-ts';
import { Token } from '../types/schema';
import { Sync } from '../types/templates/DeltaSwapPair/DeltaSwapPair';
import { DeltaSwapPair } from '../types/schema';
import { getPriceFromReserves, updateTokenPrices } from '../helpers/utils';

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

  token0.dsBalance = token0.dsBalance.minus(pair.reserve0).plus(event.params.reserve0);
  token1.dsBalance = token1.dsBalance.minus(pair.reserve1).plus(event.params.reserve1);

  pair.reserve0 = event.params.reserve0;
  pair.reserve1 = event.params.reserve1;
  pair.save();

  let price = getPriceFromReserves(token0, token1, pair.reserve0, pair.reserve1);

  updateTokenPrices(token0, token1, price);

  token0.save();
  token1.save();
}
