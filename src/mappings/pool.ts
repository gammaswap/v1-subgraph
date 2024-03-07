import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { Pool, PoolUpdated, LoanCreated, LoanUpdated, Liquidation, Transfer } from '../types/templates/GammaPool/Pool';
import { GammaPool, Loan, PoolBalance } from '../types/schema';
import { createLoan, createLiquidation, loadOrCreateAccount, createFiveMinPoolSnapshot, createHourlyPoolSnapshot, createDailyPoolSnapshot, createLoanSnapshot, loadOrCreateAbout } from '../helpers/loader';
import { ADDRESS_ZERO } from '../helpers/constants';
import { updatePoolStats, updateLoanStats, updatePrices } from '../helpers/utils';
import { PoolViewer } from "../types/templates/GammaPool/PoolViewer";

export function handlePoolUpdate(event: PoolUpdated): void {
  const poolAddress = event.address;
  const pool = GammaPool.load(poolAddress.toHexString());

  if (pool == null) {
    log.error("POOL NOT AVAILABLE: {}", [poolAddress.toHexString()]);
    return;
  }

  const poolContract = Pool.bind(event.address);
  const viewerAddress = poolContract.viewer(); // Get PoolViewer from GammaPool
  const poolViewer = PoolViewer.bind(viewerAddress);

  updatePrices(pool);

  const poolData = poolViewer.getLatestPoolData(poolAddress);
  pool.shortStrategy = poolData.shortStrategy;
  pool.borrowStrategy = poolData.borrowStrategy;
  pool.repayStrategy = poolData.repayStrategy;
  pool.rebalanceStrategy = poolData.rebalanceStrategy;
  pool.singleLiquidationStrategy = poolData.singleLiquidationStrategy;
  pool.batchLiquidationStrategy = poolData.batchLiquidationStrategy;

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
  pool.emaUtilRate = poolData.emaUtilRate;
  pool.emaMultiplier = poolData.emaMultiplier;
  pool.minUtilRate1 = poolData.minUtilRate1;
  pool.minUtilRate2 = poolData.minUtilRate2;
  pool.feeDivisor = poolData.feeDivisor;
  pool.origFee = poolData.origFee;
  pool.ltvThreshold = BigInt.fromI32(poolData.ltvThreshold);
  pool.liquidationFee = BigInt.fromI32(poolData.liquidationFee);

  pool.block = event.block.number;
  pool.timestamp = event.block.timestamp;

  updatePoolStats(pool);

  pool.save();

  // Historical data
  createFiveMinPoolSnapshot(event, poolData);
  createHourlyPoolSnapshot(event, poolData);
  createDailyPoolSnapshot(event, poolData);
}

export function handleLoanCreate(event: LoanCreated): void {
  const loanId = event.address.toHexString() + '-' + event.params.tokenId.toString();
  createLoan(loanId, event);

  const about = loadOrCreateAbout();
  about.totalLoans = about.totalLoans.plus(BigInt.fromI32(1));
  about.save();
}

export function handleLoanUpdate(event: LoanUpdated): void {
  const loanId = event.address.toHexString() + '-' + event.params.tokenId.toString();
  const loan = Loan.load(loanId);

  if (loan == null) {
    log.error("LOAN NOT AVAILABLE: {}", [loanId]);
    return;
  }

  const about = loadOrCreateAbout();

  const poolContract = Pool.bind(event.address);
  const loanData = poolContract.getLoanData(event.params.tokenId);
  loan.rateIndex = loanData.rateIndex;
  loan.initLiquidity = loanData.initLiquidity;
  loan.liquidity = loanData.liquidity;
  loan.lpTokens = loanData.lpTokens;
  loan.collateral0 = loanData.tokensHeld[0];
  loan.collateral1 = loanData.tokensHeld[1];
  if (loan.entryPrice == BigInt.fromI32(0)) {
    loan.entryPrice = loanData.px;
  }
  
  if (event.params.txType == 7) { // 7 -> BORROW_LIQUIDITY
    loan.status = 'OPEN';
    loan.openedAtBlock = event.block.number;
    loan.openedAtTxhash = event.transaction.hash.toHexString();
    loan.openedAtTimestamp = event.block.timestamp;
    about.totalActiveLoans = about.totalActiveLoans.plus(BigInt.fromI32(1));
  } else if ([8, 9, 10].includes(event.params.txType)) { // 8 -> REPAY_LIQUIDITY, 9 -> REPAY_LIQUIDITY_SET_RATIO, 10 -> REPAY_LIQUIDITY_WITH_LP
    if (loan.initLiquidity == BigInt.zero()) {
      loan.status = 'CLOSED';
      loan.closedAtBlock = event.block.number;
      loan.closedAtTxhash = event.transaction.hash.toHexString();
      loan.closedAtTimestamp = event.block.timestamp;
      if (about.totalActiveLoans.gt(BigInt.fromI32(0))) {
        about.totalActiveLoans = about.totalActiveLoans.minus(BigInt.fromI32(1));
      }
    }
  } else if ([11, 12, 13].includes(event.params.txType)) {  // 11 -> LIQUIDATE, 12 -> LIQUIDATE_WITH_LP, 13 -> BATCH_LIQUIDATION
    loan.status = 'LIQUIDATED';
    loan.closedAtBlock = event.block.number;
    loan.closedAtTxhash = event.transaction.hash.toHexString();
    loan.closedAtTimestamp = event.block.timestamp;
    if (about.totalActiveLoans.gt(BigInt.fromI32(0))) {
      about.totalActiveLoans = about.totalActiveLoans.minus(BigInt.fromI32(1));
    }
  }

  loan.save();

  about.save();

  updateLoanStats(loan);

  createLoanSnapshot(loan, event);
}

export function handleLiquidation(event: Liquidation): void {
  const poolAddress = event.address;
  const pool = GammaPool.load(poolAddress.toHexString());

  if (pool) {
    if (event.params.tokenId.gt(BigInt.fromI32(0))) { // For single liquidation
      const loanId = poolAddress.toHexString() + '-' + event.params.tokenId.toString();
      const loan = Loan.load(loanId);
      if (loan == null) {
        log.error("LIQUIDATION: LOAN NOT AVAILABLE: {}", [loanId]);
        return;
      }
      // const liquidations = pool.liquidations;
      // const sequence = liquidations ? liquidations.load().length : 0;
      // const liquidationId = loanId + '-' + sequence.toString();
      createLiquidation(loanId, event);
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

  let poolBalanceFrom = PoolBalance.load(id1);
  if (poolBalanceFrom && fromAccount.id != ADDRESS_ZERO) {
    poolBalanceFrom.balance = poolBalanceFrom.balance.minus(event.params.amount);
    if (pool.totalSupply == BigInt.fromI32(0)) {
      poolBalanceFrom.balanceETH = BigDecimal.fromString('0');
      poolBalanceFrom.balanceUSD = BigDecimal.fromString('0');
    } else {
      poolBalanceFrom.balanceETH = pool.lpBalanceETH.plus(pool.lpBorrowedBalanceETH).times(poolBalanceFrom.balance.toBigDecimal()).div(pool.totalSupply.toBigDecimal());
      poolBalanceFrom.balanceUSD = pool.lpBalanceETH.plus(pool.lpBorrowedBalanceETH).times(poolBalanceFrom.balance.toBigDecimal()).div(pool.totalSupply.toBigDecimal());
    }
    poolBalanceFrom.save();
  }

  let poolBalanceTo = PoolBalance.load(id2);
  if (toAccount.id != ADDRESS_ZERO) {
    if (poolBalanceTo == null) {
      poolBalanceTo = new PoolBalance(id2);
      poolBalanceTo.pool = pool.id;
      poolBalanceTo.protocol = pool.protocolId.toString();
      poolBalanceTo.account = toAccount.id;
      poolBalanceTo.balance = BigInt.fromI32(0);
      poolBalanceTo.balanceETH = BigDecimal.fromString('0');
      poolBalanceTo.balanceUSD = BigDecimal.fromString('0');
      poolBalanceTo.initialBlock = event.block.number;
      poolBalanceTo.initialTimestamp = event.block.timestamp;
    }
    poolBalanceTo.balance = poolBalanceTo.balance.plus(event.params.amount);
    if (pool.totalSupply == BigInt.fromI32(0)) {
      poolBalanceTo.balanceETH = BigDecimal.fromString('0');
      poolBalanceTo.balanceUSD = BigDecimal.fromString('0');
    } else {
      poolBalanceTo.balanceETH = pool.lpBalanceETH.plus(pool.lpBorrowedBalanceETH).times(poolBalanceTo.balance.toBigDecimal()).div(pool.totalSupply.toBigDecimal());
      poolBalanceTo.balanceUSD = pool.lpBalanceUSD.plus(pool.lpBorrowedBalanceUSD).times(poolBalanceTo.balance.toBigDecimal()).div(pool.totalSupply.toBigDecimal());
    }
    poolBalanceTo.save();
  }
}
