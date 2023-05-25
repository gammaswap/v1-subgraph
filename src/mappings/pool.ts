import { BigInt, log } from '@graphprotocol/graph-ts';
import { Pool, PoolUpdated, LoanCreated, LoanUpdated, Liquidation, Transfer } from '../types/templates/GammaPool/Pool';
import { GammaPool, Loan, VaultBalance, Account } from '../types/schema';
import { createLoan, createLiquidation, loadOrCreateAccount } from '../helpers/loader';
import { POSITION_MANAGER, ADDRESS_ZERO } from '../helpers/constants';

export function handlePoolUpdate(event: PoolUpdated): void {
  const poolAddress = event.address;
  const poolContract = Pool.bind(poolAddress);
  const pool = GammaPool.load(poolAddress.toHexString());
  
  if (pool == null) {
    log.error("POOL NOT AVAILABLE: {}", [poolAddress.toHexString()]);
    return;
  }

  const tokenMetadata = poolContract.getTokensMetaData();
  if (pool.token0Symbol == "" || pool.token1Symbol == "") {
    pool.token0Symbol = tokenMetadata.get_symbols()[0];
    pool.token0Decimals = BigInt.fromI32(tokenMetadata.get_decimals()[0]);
    pool.token1Symbol = tokenMetadata.get_symbols()[1];
    pool.token1Decimals = BigInt.fromI32(tokenMetadata.get_decimals()[1]);
  }
  const poolData = poolContract.getLatestPoolData();
  pool.lpBalance = poolData.LP_TOKEN_BALANCE;
  pool.lpBorrowedBalance = poolData.LP_TOKEN_BORROWED;
  pool.lpBorrowedBalancePlusInterest = poolData.LP_TOKEN_BORROWED_PLUS_INTEREST;
  pool.lpInvariant = poolData.LP_INVARIANT;
  pool.lpBorrowedInvariant = poolData.BORROWED_INVARIANT;

  pool.accFeeIndex = poolData.accFeeIndex;
  pool.lastCfmmFeeIndex = poolData.lastCFMMFeeIndex;
  pool.lastCfmmInvariant = poolData.lastCFMMInvariant;
  pool.lastCfmmTotalSupply = poolData.lastCFMMTotalSupply;
  pool.lastFeeIndex = poolData.lastFeeIndex;
  pool.lastPrice = poolData.lastPrice;

  pool.totalSupply = poolData.totalSupply;
  pool.token0Balance = poolData.TOKEN_BALANCE[0];
  pool.token1Balance = poolData.TOKEN_BALANCE[1];
  pool.reserve0Balance = poolData.CFMM_RESERVES[0];
  pool.reserve1Balance = poolData.CFMM_RESERVES[1];
  pool.borrowRate = poolData.borrowRate;
  pool.supplyRate = poolData.supplyRate;
  pool.utilizationRate = poolData.utilizationRate;
  pool.ltvThreshold = poolData.ltvThreshold;
  pool.liquidationFee = poolData.liquidationFee;

  pool.block = event.block.number;
  pool.timestamp = event.block.timestamp;

  pool.save();
}

export function handleLoanCreate(event: LoanCreated): void {
  const caller = event.params.caller.toHexString();
  /**
   * If position manager is the caller,
   * use `handleLoanCreateFromPositionManager`
   */
  if (caller == POSITION_MANAGER) return;

  const loanId = event.address.toHexString() + '-' + event.params.tokenId.toHexString();
  createLoan(loanId, event);
}

export function handleLoanUpdate(event: LoanUpdated): void {
  const loanId = event.address.toHexString() + '-' + event.params.tokenId.toHexString();
  const loan = Loan.load(loanId);

  if (loan == null) {
    log.error("LOAN NOT AVAILABLE: {}", [loanId]);
    return;
  }

  const pool = GammaPool.load(loan.pool)!;
  const poolContract = Pool.bind(event.address);
  const loanData = poolContract.loan(event.params.tokenId);
  loan.rateIndex = loanData.rateIndex;
  loan.initLiquidity = loanData.initLiquidity;
  loan.liquidity = loanData.liquidity;
  loan.lpTokens = loanData.lpTokens;
  loan.token0Held = loanData.tokensHeld[0];
  loan.token1Held = loanData.tokensHeld[1];
  loan.price = loanData.px;
  if (event.params.txType == 8) { // 8 -> REPAY_LIQUIDITY
    loan.status = 'CLOSED';
    loan.closedBlock = event.block.number;
    loan.closedTimestamp = event.block.timestamp;
  } else if (event.params.txType == 9) {  // 9 -> LIQUIDATE
    loan.status = 'LIQUIDATED_FULL';
    loan.closedBlock = event.block.number;
    loan.closedTimestamp = event.block.timestamp;
  } else if (event.params.txType == 10) { // 10 -> LIQUIDATE_WITH_LP
    if (event.params.liquidity == BigInt.fromI32(0) || event.params.rateIndex == BigInt.fromI32(0)) {
      loan.status = 'LIQUIDATED_FULL';
      loan.closedBlock = event.block.number;
      loan.closedTimestamp = event.block.timestamp;
    } else {
      loan.status = 'LIQUIDATED_PARTIAL';
    }
  }

  loan.save();
}

export function handleLiquidation(event: Liquidation): void {
  const poolAddress = event.address;
  const pool = GammaPool.load(poolAddress.toHexString());

  if (pool) {
    if (event.params.tokenId.gt(BigInt.fromI32(0))) { // For single liquidation
      const loanId = poolAddress.toHexString() + '-' + event.params.tokenId.toHexString();
      const loan = Loan.load(loanId);
      if (loan == null) {
        log.error("LIQUIDATION: LOAN NOT AVAILABLE: {}", [loanId]);
        return;
      }
      const liquidations = pool.liquidations;
      const sequence = liquidations ? liquidations.length : 0;
      const liquidationId = loanId + '-' + sequence.toString();
      createLiquidation(liquidationId, event);
    } else if (event.params.tokenIds.length > 0) {
      // TODO Batch liquidations
    }
  }
}

export function handleVaultTokenTransfer(event: Transfer): void {
  const pool = GammaPool.load(event.address.toHexString());
  if (pool == null) {
    log.error("POOL NOT AVAILABLE: {}", [event.address.toHexString()]);
    return;
  }
  const fromAccount = loadOrCreateAccount(event.params.from.toHexString());
  const toAccount = loadOrCreateAccount(event.params.to.toHexString());
  const id1 = pool.id + '-' + fromAccount.id;
  const id2 = pool.id + '-' + toAccount.id;

  let vaultBalanceFrom = VaultBalance.load(id1);
  if (vaultBalanceFrom && fromAccount.id != ADDRESS_ZERO) {
    vaultBalanceFrom.balance = vaultBalanceFrom.balance.minus(event.params.amount);
    vaultBalanceFrom.save();
  }

  let vaultBalanceTo = VaultBalance.load(id2);
  if (toAccount.id != ADDRESS_ZERO) {
    if (vaultBalanceTo == null) {
      vaultBalanceTo = new VaultBalance(id2);
      vaultBalanceTo.pool = pool.id;
      vaultBalanceTo.account = toAccount.id;
      vaultBalanceTo.balance = BigInt.fromI32(0);
    }
    vaultBalanceTo.balance = vaultBalanceTo.balance.plus(event.params.amount);
    vaultBalanceTo.save();
  }
}
