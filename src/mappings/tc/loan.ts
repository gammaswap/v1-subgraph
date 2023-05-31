import { Address, BigInt, log } from '@graphprotocol/graph-ts';
import { LoanStatus } from '../../types/tc/schema';
import { Transfer, RepayLiquidity } from '../../types/tc/PositionManager/PositionManager';

export function handleLoanTransfer(event: Transfer): void {
  const tokenId = event.params.tokenId;
  let loan = LoanStatus.load(tokenId.toString());
  if (loan == null) {
    loan = new LoanStatus(tokenId.toString());
    loan.creator = Address.zero();
    loan.owner = Address.zero();
    loan.tokenId = tokenId;
    loan.pool = Address.zero();
    loan.repaidLiquidity = BigInt.fromI32(0);
  }

  loan.owner = event.params.to;
  if (event.params.from == Address.zero()) {  // Mint
    loan.creator = event.params.to;
  }

  loan.save();
}

export function handleLoanRepay(event: RepayLiquidity): void {
  const tokenId = event.params.tokenId;
  let loan = LoanStatus.load(tokenId.toString());
  if (loan == null) {
    log.error("LOANSTATUS NOT AVAILABLE: {}", [tokenId.toString()]);
    return;
  }

  loan.pool = event.params.pool;
  loan.repaidLiquidity = loan.repaidLiquidity.plus(event.params.liquidityPaid);
  loan.save();
}