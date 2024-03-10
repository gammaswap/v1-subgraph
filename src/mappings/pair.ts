import { log } from '@graphprotocol/graph-ts';
import { Token } from '../types/schema';
import { Sync } from '../types/templates/DeltaSwapPair/DeltaSwapPair';
import { DeltaSwapPair } from '../types/schema';
import { getPriceFromReserves, updateTokenPrices } from '../helpers/utils';
import { loadOrCreateAbout } from "../helpers/loader";

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

  const about = loadOrCreateAbout();
  about.totalTvlETH = about.totalTvlETH.minus(token0.balanceETH);
  about.totalTvlUSD = about.totalTvlUSD.minus(token1.balanceUSD);
  about.totalDSBalanceUSD = about.totalDSBalanceUSD.minus(token0.dsBalanceUSD);
  about.totalDSBalanceUSD = about.totalDSBalanceUSD.minus(token1.dsBalanceUSD);
  about.totalDSBalanceETH = about.totalDSBalanceETH.minus(token0.dsBalanceETH);
  about.totalDSBalanceETH = about.totalDSBalanceETH.minus(token1.dsBalanceETH);

  // subtract dsBalance from about
  token0.dsBalance = token0.dsBalance.minus(pair.reserve0).plus(event.params.reserve0);
  token1.dsBalance = token1.dsBalance.minus(pair.reserve1).plus(event.params.reserve1);

  // add dsBalance to about
  pair.reserve0 = event.params.reserve0;
  pair.reserve1 = event.params.reserve1;

  pair.save();

  let price = getPriceFromReserves(token0, token1, pair.reserve0, pair.reserve1);

  updateTokenPrices(token0, token1, price);

  about.totalDSBalanceUSD = about.totalDSBalanceUSD.plus(token0.dsBalanceUSD);
  about.totalDSBalanceUSD = about.totalDSBalanceUSD.plus(token1.dsBalanceUSD);
  about.totalDSBalanceETH = about.totalDSBalanceETH.plus(token0.dsBalanceETH);
  about.totalDSBalanceETH = about.totalDSBalanceETH.plus(token1.dsBalanceETH);

  about.totalTvlETH = about.totalTvlETH.plus(token0.balanceETH);
  about.totalTvlUSD = about.totalTvlUSD.plus(token1.balanceUSD);

  about.save();
  token0.save();
  token1.save();
}
