import { CreateLoan, Transfer } from '../types/PositionManager/PositionManager';
import { transferLoanOwner } from '../helpers/loader';

export function handleLoanCreateFromPositionManager(event: CreateLoan): void {
  const loanId = event.params.tokenId.toString();
  const owner = event.params.owner.toHexString();

  transferLoanOwner(loanId, owner, true, event.address);
}

export function handleLoanTransferFromPositionManager(event: Transfer): void {
  const loanId = event.params.tokenId.toString();
  const to = event.params.to.toHexString();

  transferLoanOwner(loanId, to, false, event.address);
}