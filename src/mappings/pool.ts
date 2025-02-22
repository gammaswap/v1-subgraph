import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
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
import { ADDRESS_ZERO } from '../helpers/constants';
import {
  updatePoolStats,
  updateLoanStats,
  updateTokenPrices,
  isTokenValid,
  getPriceFromReserves
} from '../helpers/utils';
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

  if(token0 == null || token1 == null || !isTokenValid(token0) || !isTokenValid(token1)) return;

  const poolContract = Pool.bind(event.address);
  const viewerAddress = poolContract.viewer(); // Get PoolViewer from GammaPool
  let poolViewer = PoolViewer.bind(viewerAddress);

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
    // Protocol 3 lpBalanceBN is updated in pair.ts so no need to update the token lpBalanceBN here for protocol 3
    const pair = DeltaSwapPair.load(pool.cfmm.toHexString());
    if (pair != null && pair.totalSupply.gt(BigInt.zero())) {
      // PoolUpdated events come after a sync function call, so reserveBalance should match cfmm's getReserves()
      const borrowedBalance0 = pool.lpBorrowedBalance.times(pool.reserve0Balance).div(pool.lastCfmmTotalSupply);
      const borrowedBalance1 = pool.lpBorrowedBalance.times(pool.reserve1Balance).div(pool.lastCfmmTotalSupply);
      token0.borrowedBalanceBN = token0.borrowedBalanceBN.minus(pool.borrowedBalance0).plus(borrowedBalance0);
      token1.borrowedBalanceBN = token1.borrowedBalanceBN.minus(pool.borrowedBalance1).plus(borrowedBalance1);
      pool.borrowedBalance0 = borrowedBalance0;
      pool.borrowedBalance1 = borrowedBalance1;

      const poolReserve0 = pool.lpBalance.times(pair.reserve0).div(pair.totalSupply);
      const poolReserve1 = pool.lpBalance.times(pair.reserve1).div(pair.totalSupply);

      token0.lpBalanceBN = token0.lpBalanceBN.minus(pool.lpReserve0).plus(poolReserve0);
      token1.lpBalanceBN = token1.lpBalanceBN.minus(pool.lpReserve1).plus(poolReserve1);

      pool.lpReserve0 = poolReserve0;
      pool.lpReserve1 = poolReserve1;
    }

    const poolPrice = getPriceFromReserves(token0, token1, pool.reserve0Balance, pool.reserve1Balance);
    updateTokenPrices(token0, token1, poolPrice);

    if(pair != null && pair.totalSupply.gt(BigInt.zero())) {
      updatePoolStats(token0, token1, pool, pair);
    }

    pool.save();
    token0.save();
    token1.save();

    // Historical data
    createFiveMinPoolSnapshot(event, poolData, token0, token1);
    createHourlyPoolSnapshot(event, poolData, token0, token1);
    createDailyPoolSnapshot(event, poolData, token0, token1);

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

  const pool = GammaPool.load(loan.pool);
  if (pool == null) return;

  const pair = DeltaSwapPair.load(pool.cfmm.toHexString());
  if (pair == null || pair.totalSupply.equals(BigInt.zero())) return;

  const token0 = Token.load(pool.token0);
  const token1 = Token.load(pool.token1);
  if (token1 == null || token0 == null) return;

  const collateralToken0 = loadOrCreateCollateralToken(loan.pool, loan.token0, loan.account);
  const collateralToken1 = loadOrCreateCollateralToken(loan.pool, loan.token1, loan.account);
  const totalCollateralToken0 = loadOrCreateTotalCollateralToken(loan.token0, loan.account);
  const totalCollateralToken1 = loadOrCreateTotalCollateralToken(loan.token1, loan.account);

  // This might be a problem when it's a loan with a positive balance transferred to a new collateralToken
  collateralToken0.balance = collateralToken0.balance.minus(loan.collateral0).plus(event.params.tokensHeld[0]);
  collateralToken1.balance = collateralToken1.balance.minus(loan.collateral1).plus(event.params.tokensHeld[1]);
  totalCollateralToken0.balance = totalCollateralToken0.balance.minus(loan.collateral0).plus(event.params.tokensHeld[0]);
  totalCollateralToken1.balance = totalCollateralToken1.balance.minus(loan.collateral1).plus(event.params.tokensHeld[1]);
  collateralToken0.save();
  collateralToken1.save();
  totalCollateralToken0.save();
  totalCollateralToken1.save();

  const prevInitLiquidity = loan.initLiquidity;
  loan.rateIndex = event.params.rateIndex;
  loan.initLiquidity = event.params.initLiquidity;
  loan.liquidity = event.params.liquidity;
  loan.lpTokens = event.params.lpTokens;
  loan.collateral0 = event.params.tokensHeld[0];
  loan.collateral1 = event.params.tokensHeld[1];
  
  if (event.params.txType == 7) { // 7 -> BORROW_LIQUIDITY
    const poolContract = Pool.bind(event.address);
    const loanData = poolContract.loan(event.params.tokenId);
    loan.entryPrice = loanData.px;
    if(prevInitLiquidity == BigInt.zero()) {
      about.totalActiveLoans = about.totalActiveLoans.plus(BigInt.fromI32(1));
    }
    loan.status = 'OPEN';
    loan.openedAtBlock = event.block.number;
    loan.openedAtTxhash = event.transaction.hash.toHexString();
    loan.openedAtTimestamp = event.block.timestamp;
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
  } else if ([11, 12, 13].includes(event.params.txType)) { // 11 -> LIQUIDATE, 12 -> LIQUIDATE_WITH_LP, 13 -> BATCH_LIQUIDATION
    loan.status = 'LIQUIDATED';
    loan.closedAtBlock = event.block.number;
    loan.closedAtTxhash = event.transaction.hash.toHexString();
    loan.closedAtTimestamp = event.block.timestamp;
    if (about.totalActiveLoans.gt(BigInt.fromI32(0))) {
      about.totalActiveLoans = about.totalActiveLoans.minus(BigInt.fromI32(1));
    }
  }

  about.save();

  updateLoanStats(loan, pair, token1);

  loan.save();

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

  const ONE = BigInt.fromI32(10).pow(18).toBigDecimal();
  const lpBalanceETHBN = BigInt.fromString(pool.lpBalanceETH.times(ONE).truncate(0).toString());
  const lpBorrowedBalanceETHBN = BigInt.fromString(pool.lpBalanceETH.times(ONE).truncate(0).toString());
  const lpBalanceUSDBN = BigInt.fromString(pool.lpBalanceUSD.times(ONE).truncate(0).toString());
  const lpBorrowedBalanceUSDBN = BigInt.fromString(pool.lpBalanceUSD.times(ONE).truncate(0).toString());
  const totalLpBalanceETHBN = lpBalanceETHBN.plus(lpBorrowedBalanceETHBN);
  const totalLpBalanceUSDBN = lpBalanceUSDBN.plus(lpBorrowedBalanceUSDBN);

  if (fromAccount.id != ADDRESS_ZERO) {
    let poolBalanceFrom = PoolBalance.load(id1);
    if (poolBalanceFrom) {
      poolBalanceFrom.balance = poolBalanceFrom.balance.minus(event.params.amount);
      if (pool.totalSupply == BigInt.fromI32(0)) {
        poolBalanceFrom.balanceETH = BigDecimal.fromString('0');
        poolBalanceFrom.balanceUSD = BigDecimal.fromString('0');
      } else {
        const balanceETHBN = totalLpBalanceETHBN.times(poolBalanceFrom.balance).div(pool.totalSupply);
        const balanceUSDBN = totalLpBalanceUSDBN.times(poolBalanceFrom.balance).div(pool.totalSupply);

        poolBalanceFrom.balanceETH = balanceETHBN.divDecimal(ONE);
        poolBalanceFrom.balanceUSD = balanceUSDBN.divDecimal(ONE);
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
      const balanceETHBN = totalLpBalanceETHBN.times(poolBalanceTo.balance).div(pool.totalSupply);
      const balanceUSDBN = totalLpBalanceUSDBN.times(poolBalanceTo.balance).div(pool.totalSupply);

      poolBalanceTo.balanceETH = balanceETHBN.divDecimal(ONE);
      poolBalanceTo.balanceUSD = balanceUSDBN.divDecimal(ONE);
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
