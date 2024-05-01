import { DeltaSwapPair as DeltaSwapPairSource } from '../types/templates';
import { PairCreated, GammaPoolSet } from '../types/DeltaswapFactory/DeltaSwapFactory';
import { createPair } from '../helpers/loader';
import { DeltaSwapPair } from "../types/schema";

export function handlePairCreated(event: PairCreated): void {
  createPair(event, '3');

  DeltaSwapPairSource.create(event.params.pair);
}

export function handleGammaPoolSet(event: GammaPoolSet): void {
  let pair = DeltaSwapPair.load(event.params.pair.toHexString());
  if (pair != null) {
    pair.pool = event.params.gammaPool.toHexString();
    pair.save();
  }
}