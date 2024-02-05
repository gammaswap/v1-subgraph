import { DeltaSwapPair as DeltaSwapPairSource } from '../types/templates';
import { PairCreated } from '../types/DeltaswapFactory/DeltaSwapFactory';
import { createPair } from '../helpers/loader';

export function handlePairCreated(event: PairCreated): void {
  createPair(event);

  DeltaSwapPairSource.create(event.params.pair);
}
