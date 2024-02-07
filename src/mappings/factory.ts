import { PoolCreated } from '../types/GammaFactory/Factory';
import { GammaPool as GammaPoolDataSource } from '../types/templates';
import { createPool, createPoolTracer } from '../helpers/loader';
import { loadOrCreateAbout } from '../helpers/loader';
import { BigInt } from '@graphprotocol/graph-ts';

export function handlePoolCreate(event: PoolCreated): void {
  createPool(event.params.pool.toHexString(), event);
  createPoolTracer(event.params.pool.toHexString());

  GammaPoolDataSource.create(event.params.pool);

  const about = loadOrCreateAbout();
  about.totalPools = about.totalPools.plus(BigInt.fromI32(1));
  about.save();
}
