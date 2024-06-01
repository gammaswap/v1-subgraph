import {Address, BigDecimal, BigInt, log} from '@graphprotocol/graph-ts';
import { Pool, PoolUpdated, LoanCreated, LoanUpdated, Liquidation, Transfer } from '../types/templates/GammaPool/Pool';
import { GammaPool, Loan, PoolBalance, Token, DeltaSwapPair, PoolAndStakedBalance, RewardTracker } from '../types/schema';
import {
  createLoan,
  createLiquidation,
  loadOrCreateAccount,
  createFiveMinPoolSnapshot,
  createHourlyPoolSnapshot,
  createDailyPoolSnapshot,
  createLoanSnapshot,
  loadOrCreateAbout,
  loadOrCreateCollateralToken,
  loadOrCreateTotalCollateralToken
} from '../helpers/loader';
import { ADDRESS_ZERO, POOL_VIEWER, NETWORK } from '../helpers/constants';
import { updatePoolStats, updateLoanStats, updateTokenPrices } from '../helpers/utils';
import { PoolViewer } from "../types/templates/GammaPool/PoolViewer";

export function handlePoolUpdate(event: PoolUpdated): void {
  const poolAddress = event.address;
  const pool = GammaPool.load(poolAddress.toHexString());

  if (pool == null) {
    log.error("POOL NOT AVAILABLE: {}", [poolAddress.toHexString()]);
    return;
  }

  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);

  if (token0 == null || token1 == null || token0.decimals == BigInt.zero() || token1.decimals == BigInt.zero()) return;

  const poolContract = Pool.bind(event.address);
  const viewerAddress = poolContract.viewer(); // Get PoolViewer from GammaPool
  let poolViewer = PoolViewer.bind(viewerAddress);

  if(NETWORK == "mainnet") {
    poolViewer = PoolViewer.bind(Address.fromString(POOL_VIEWER));
  }

  const poolDataResult = poolViewer.try_getLatestPoolData(poolAddress);
  if(!poolDataResult.reverted) {
    const poolData = poolDataResult.value;

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

    token0.gsBalanceBN = token0.gsBalanceBN.minus(pool.token0Balance).plus(poolData.TOKEN_BALANCE[0]);
    token1.gsBalanceBN = token1.gsBalanceBN.minus(pool.token1Balance).plus(poolData.TOKEN_BALANCE[1]);
    pool.token0Balance = poolData.TOKEN_BALANCE[0];
    pool.token1Balance = poolData.TOKEN_BALANCE[1];

    // Since the Sync events come before PoolUpdate events, Sync events will update with an incorrect lpBalance value
    // Therefore this will correct the lpReserve0 and lpReserve1 using the correct lpBalance value
    // Protocol 3 will always be right so no need to update the token lpBalanceBN here for protocol 3
    const pair = DeltaSwapPair.load(pool.cfmm.toHexString());
    if (pair != null && pair.totalSupply.gt(BigInt.zero())) {
      const borrowedBalance0 = pool.lpBorrowedBalance.times(pool.reserve0Balance).div(pool.lastCfmmTotalSupply);
      const borrowedBalance1 = pool.lpBorrowedBalance.times(pool.reserve1Balance).div(pool.lastCfmmTotalSupply);
      token0.borrowedBalanceBN = token0.borrowedBalanceBN.minus(pool.borrowedBalance0).plus(borrowedBalance0);
      token1.borrowedBalanceBN = token1.borrowedBalanceBN.minus(pool.borrowedBalance1).plus(borrowedBalance1);
      pool.borrowedBalance0 = borrowedBalance0;
      pool.borrowedBalance1 = borrowedBalance1;

      const poolReserve0 = pool.lpBalance.times(pair.reserve0).div(pair.totalSupply);
      const poolReserve1 = pool.lpBalance.times(pair.reserve1).div(pair.totalSupply);

      if(pair.protocol != BigInt.fromString('3')) {
        token0.lpBalanceBN = token0.lpBalanceBN.minus(pool.lpReserve0).plus(poolReserve0);
        token1.lpBalanceBN = token1.lpBalanceBN.minus(pool.lpReserve1).plus(poolReserve1);
      }

      pool.lpReserve0 = poolReserve0;
      pool.lpReserve1 = poolReserve1;
    }

    const precision = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32()).toBigDecimal();
    let poolPrice = pool.lastPrice.divDecimal(precision);

    updateTokenPrices(token0, token1, poolPrice);

    if(pair != null && pair.totalSupply.gt(BigInt.zero())) {
      updatePoolStats(token0, token1, pool, pair);
    }

    pool.save();
    token0.save();
    token1.save();

    // Historical data
    createFiveMinPoolSnapshot(event, poolData);
    createHourlyPoolSnapshot(event, poolData);
    createDailyPoolSnapshot(event, poolData);

  } else {
    log.error("Failed to get Latest Pool Data for pool {}", [poolAddress.toHexString()]);
  }
}

export function handleLoanCreate(event: LoanCreated): void {
  const loanId = event.params.tokenId.toString();
  createLoan(loanId, event);

  const about = loadOrCreateAbout();
  about.totalLoans = about.totalLoans.plus(BigInt.fromI32(1));
  about.save();
}

export function handleLoanUpdate(event: LoanUpdated): void {
  const loanId = event.params.tokenId.toString();
  const loan = Loan.load(loanId);

  if (loan == null) {
    log.error("LOAN NOT AVAILABLE: {}", [loanId]);
    return;
  }

  const about = loadOrCreateAbout();

  const poolContract = Pool.bind(event.address);
  const loanData = poolContract.getLoanData(event.params.tokenId);

  const collateralToken0 = loadOrCreateCollateralToken(loan.pool, loan.token0, loan.account);
  const collateralToken1 = loadOrCreateCollateralToken(loan.pool, loan.token1, loan.account);
  const totalCollateralToken0 = loadOrCreateTotalCollateralToken(loan.token0, loan.account);
  const totalCollateralToken1 = loadOrCreateTotalCollateralToken(loan.token1, loan.account);

  // This might be a problem when it's a loan with a positive balance transferred to a new collateralToken
  collateralToken0.balance = collateralToken0.balance.minus(loan.collateral0).plus(loanData.tokensHeld[0]);
  collateralToken1.balance = collateralToken1.balance.minus(loan.collateral1).plus(loanData.tokensHeld[1]);
  totalCollateralToken0.balance = totalCollateralToken0.balance.minus(loan.collateral0).plus(loanData.tokensHeld[0]);
  totalCollateralToken1.balance = totalCollateralToken1.balance.minus(loan.collateral1).plus(loanData.tokensHeld[1]);
  collateralToken0.save();
  collateralToken1.save();
  totalCollateralToken0.save();
  totalCollateralToken1.save();

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
  if (event.params.tokenId.gt(BigInt.fromI32(0))) { // For single liquidation
    const loanId = event.params.tokenId.toString();
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

  if (fromAccount.id != ADDRESS_ZERO) {
    let poolBalanceFrom = PoolBalance.load(id1);
    if (poolBalanceFrom) {
      poolBalanceFrom.balance = poolBalanceFrom.balance.minus(event.params.amount);
      if (pool.totalSupply == BigInt.fromI32(0)) {
        poolBalanceFrom.balanceETH = BigDecimal.fromString('0');
        poolBalanceFrom.balanceUSD = BigDecimal.fromString('0');
      } else {
        poolBalanceFrom.balanceETH = pool.lpBalanceETH.plus(pool.lpBorrowedBalanceETH).times(poolBalanceFrom.balance.toBigDecimal()).div(pool.totalSupply.toBigDecimal());
        poolBalanceFrom.balanceUSD = pool.lpBalanceUSD.plus(pool.lpBorrowedBalanceUSD).times(poolBalanceFrom.balance.toBigDecimal()).div(pool.totalSupply.toBigDecimal());
      }
      poolBalanceFrom.save();
    }

    let poolAndStakeBalanceFrom = PoolAndStakedBalance.load(id1);
    if (poolAndStakeBalanceFrom) {
      poolAndStakeBalanceFrom.balance = poolAndStakeBalanceFrom.balance.minus(event.params.amount);
      poolAndStakeBalanceFrom.save();
    }
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
      poolBalanceTo.isRewardTracker = RewardTracker.load(toAccount.id) != null;
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

    let poolAndStakeBalanceTo = PoolAndStakedBalance.load(id2);
    if (poolAndStakeBalanceTo == null) {
      poolAndStakeBalanceTo = new PoolAndStakedBalance(id2);
      poolAndStakeBalanceTo.pool = pool.id;
      poolAndStakeBalanceTo.account = toAccount.id;
      poolAndStakeBalanceTo.balance = BigInt.fromI32(0);
      poolAndStakeBalanceTo.isRewardTracker = poolBalanceTo.isRewardTracker;
    }
    poolAndStakeBalanceTo.balance = poolAndStakeBalanceTo.balance.plus(event.params.amount);
    poolAndStakeBalanceTo.save();
  }
}
