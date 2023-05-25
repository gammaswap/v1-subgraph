import { CreateLoan } from '../types/PositionManager/PositionManager';
import { createLoanPositionManager } from '../helpers/loader';

export function handleLoanCreateFromPositionManager(event: CreateLoan): void {
  createLoanPositionManager(event);
}
