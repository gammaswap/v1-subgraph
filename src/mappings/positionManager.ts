import { CreateLoan } from '../types/PositionManager/PositionManager';
import { transferLoanOwner } from '../helpers/loader';

export function handleLoanCreateFromPositionManager(event: CreateLoan): void {
  const loanId = event.params.pool.toHexString() + '-' + event.params.tokenId.toString();
  const owner = event.params.owner.toHexString();

  transferLoanOwner(loanId, owner);
}
