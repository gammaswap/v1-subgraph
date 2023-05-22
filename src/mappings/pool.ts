import { dataSource, BigInt, log } from '@graphprotocol/graph-ts';
import { Pool, PoolUpdated, LoanCreated, LoanUpdated } from '../types/templates/GammaPool/Pool';
import { GammaPool, Loan, Position, Account } from '../types/schema';

export function handlePoolUpdate(event: PoolUpdated): void {
  const poolContract = Pool.bind(dataSource.address());
  log.info("==============POOL UPDATED: {}, {}================", [dataSource.address().toHexString(), poolContract._address.toHexString()]);
}

export function handleLoanCreate(event: LoanCreated): void {
  log.info("==============LOAN CREATED: {}================", [event.params.caller.toHexString()]);
}

export function handleLoanUpdate(event: LoanUpdated): void {
  log.info("==============POOL UPDATED: {}================", [event.params.tokenId.toHexString()]);
}