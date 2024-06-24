import { DeltaSwapPair as DeltaSwapPairSource } from '../types/templates';
import { PairCreated, GammaPoolSet } from '../types/DeltaswapFactory/DeltaSwapFactory';
import { createPair } from '../helpers/loader';
import { DeltaSwapPair } from "../types/schema";
import { log } from "@graphprotocol/graph-ts";

export function handlePairCreated(event: PairCreated): void {
  const pairCreated = createPair(event, '3');
  if(!pairCreated) {
    log.error("Failed to create pair {}",[event.params.pair.toHexString()]);
    return;
  }

  DeltaSwapPairSource.create(event.params.pair);
}

export function handleGammaPoolSet(event: GammaPoolSet): void {
  let pair = DeltaSwapPair.load(event.params.pair.toHexString());
  if (pair != null) {
    pair.pool = event.params.gammaPool.toHexString();
    pair.save();
  }
}