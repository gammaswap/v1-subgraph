import { PoolCreated } from '../types/GammaFactory/Factory';
import { GammaPool as GammaPoolDataSource } from '../types/templates';
import { createPool, createPoolTracer } from '../helpers/loader';
import { loadOrCreateAbout } from '../helpers/loader';
import { BigInt, log } from '@graphprotocol/graph-ts';

export function handlePoolCreate(event: PoolCreated): void {
  const id = event.params.pool.toHexString();
  const poolCreated = createPool(id, event);
  if(!poolCreated) {
    log.error("Failed to create pool {}", [id]);
    return;
  }

  createPoolTracer(id);

  GammaPoolDataSource.create(event.params.pool);

  const about = loadOrCreateAbout();
  about.totalPools = about.totalPools.plus(BigInt.fromI32(1));
  about.save();
}
