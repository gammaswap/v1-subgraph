import { BigInt, log } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../types/GammaFactory/Factory';
import { GammaPool as GammaPoolDataSource } from '../types/templates';
import { GammaPool } from '../types/schema';
import { loadOrCreatePool } from '../helpers/loader';

export function handlePoolCreate(event: PoolCreated): void {
  log.info("==============POOL CREATED: {}================", [event.params.pool.toHexString()]);
  const pool = loadOrCreatePool(event.params.pool.toHexString(), event);

  GammaPoolDataSource.create(event.params.pool);
}
