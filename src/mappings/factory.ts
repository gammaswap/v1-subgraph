import { PoolCreated } from '../types/GammaFactory/Factory';
import { GammaPool as GammaPoolDataSource } from '../types/templates';
import { GammaPool } from '../types/schema';
import { createPool, createPoolTracer } from '../helpers/loader';

export function handlePoolCreate(event: PoolCreated): void {
  createPool(event.params.pool.toHexString(), event);
  createPoolTracer(event.params.pool.toHexString());

  GammaPoolDataSource.create(event.params.pool);
}
