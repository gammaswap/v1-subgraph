import { Address, BigInt, log } from '@graphprotocol/graph-ts';
import { PoolViewer } from '../types/templates/GammaPool/PoolViewer';
import { Pool, PoolUpdated, LoanCreated, LoanUpdated, Liquidation, Transfer } from '../types/templates/GammaPool/Pool';
import { GammaPool, GammaPoolTracer, Loan, PoolBalance, FiveMinPoolSnapshot, HourlyPoolSnapshot, DailyPoolSnapshot } from '../types/schema';
import { createLoan, createLiquidation, loadOrCreateAccount, loadOrCreateToken, createFiveMinPoolSnapshot, createHourlyPoolSnapshot, createDailyPoolSnapshot, createLoanSnapshot } from '../helpers/loader';
import { POSITION_MANAGER, ADDRESS_ZERO, POOL_VIEWER } from '../helpers/constants';
import { updatePrices, updatePoolStats, updateLoanStats, getEthUsdValue } from '../helpers/utils';

export function handlePoolUpdate(event: PoolUpdated): void {
  const poolAddress = event.address;
  // const poolContract = Pool.bind(poolAddress);
  const pool = GammaPool.load(poolAddress.toHexString());
  
  if (pool == null) {
    log.error("POOL NOT AVAILABLE: {}", [poolAddress.toHexString()]);
    return;
  }

  const poolViewer = PoolViewer.bind(Address.fromString(POOL_VIEWER));
  const token0 = loadOrCreateToken(pool.token0);
  const token1 = loadOrCreateToken(pool.token1);

  updatePrices(poolAddress);

  const poolData = poolViewer.getLatestPoolData(poolAddress);
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
  pool.ltvThreshold = BigInt.fromI32(poolData.ltvThreshold);
  pool.liquidationFee = BigInt.fromI32(poolData.liquidationFee);

  pool.block = event.block.number;
  pool.timestamp = event.block.timestamp;

  updatePoolStats(pool);

  pool.save();

  // Historical data
  const poolTracer = GammaPoolTracer.load(poolAddress.toHexString());

  const flashData = createFiveMinPoolSnapshot(event);
  let prevAccFeeIndex = BigInt.fromI32(10).pow(18);
  if (poolTracer != null && poolTracer.lastFiveMinData != null) {
    const lastFlashData = FiveMinPoolSnapshot.load(poolTracer.lastFiveMinData!);
    if (lastFlashData) {
      prevAccFeeIndex = lastFlashData.accFeeIndex;
    }
  }
  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const ratePrecision = BigInt.fromI32(10).pow(18);
  flashData.utilizationRate = poolData.utilizationRate;
  flashData.borrowRate = poolData.borrowRate;
  const totalLiquidity = poolData.BORROWED_INVARIANT.plus(poolData.LP_INVARIANT);
  flashData.borrowedLiquidity = poolData.BORROWED_INVARIANT;
  flashData.borrowedLiquidityETH = getEthUsdValue(token0, token1, poolData.BORROWED_INVARIANT, poolData.lastPrice, true);
  flashData.borrowedLiquidityUSD = getEthUsdValue(token0, token1, poolData.BORROWED_INVARIANT, poolData.lastPrice, false);
  flashData.totalLiquidity = totalLiquidity;
  flashData.totalLiquidityETH = getEthUsdValue(token0, token1, totalLiquidity, poolData.lastPrice, true);
  flashData.totalLiquidityUSD = getEthUsdValue(token0, token1, totalLiquidity, poolData.lastPrice, false);
  flashData.utilizationRate = poolData.BORROWED_INVARIANT.times(ratePrecision).div(totalLiquidity);
  flashData.accFeeIndex = poolData.accFeeIndex;
  let dailyConversionMultiplier = 365 * 24 * 60 / 5;
  let accFeeGrowthDiff = poolData.accFeeIndex.times(ratePrecision).div(prevAccFeeIndex).minus(ratePrecision);
  flashData.accFeeIndexGrowth = accFeeGrowthDiff.times(BigInt.fromI32(dailyConversionMultiplier));
  flashData.price0 = poolData.CFMM_RESERVES[0].times(precision1).div(poolData.CFMM_RESERVES[1]);
  flashData.price1 = poolData.CFMM_RESERVES[1].times(precision0).div(poolData.CFMM_RESERVES[0]);
  flashData.save();

  if (poolTracer != null && poolTracer.lastFiveMinData != flashData.id) {
    poolTracer.lastFiveMinData = flashData.id;
    poolTracer.save();
  }

  const hourlyData = createHourlyPoolSnapshot(event);
  prevAccFeeIndex = BigInt.fromI32(10).pow(18);
  if (poolTracer != null && poolTracer.lastHourlyData != null) {
    const lastHourlyData = HourlyPoolSnapshot.load(poolTracer.lastHourlyData!);
    if (lastHourlyData) {
      prevAccFeeIndex = lastHourlyData.accFeeIndex;
    }
  }
  hourlyData.utilizationRate = poolData.utilizationRate;
  hourlyData.borrowRate = poolData.borrowRate;
  hourlyData.borrowedLiquidity = poolData.BORROWED_INVARIANT;
  hourlyData.borrowedLiquidityETH = getEthUsdValue(token0, token1, poolData.BORROWED_INVARIANT, poolData.lastPrice, true);
  hourlyData.borrowedLiquidityUSD = getEthUsdValue(token0, token1, poolData.BORROWED_INVARIANT, poolData.lastPrice, false);
  hourlyData.totalLiquidity = totalLiquidity;
  hourlyData.totalLiquidityETH = getEthUsdValue(token0, token1, totalLiquidity, poolData.lastPrice, true);
  hourlyData.totalLiquidityUSD = getEthUsdValue(token0, token1, totalLiquidity, poolData.lastPrice, false);
  hourlyData.utilizationRate = poolData.BORROWED_INVARIANT.times(ratePrecision).div(totalLiquidity);
  hourlyData.accFeeIndex = poolData.accFeeIndex;
  dailyConversionMultiplier = 365 * 24;
  accFeeGrowthDiff = poolData.accFeeIndex.times(ratePrecision).div(prevAccFeeIndex).minus(ratePrecision);
  hourlyData.accFeeIndexGrowth = accFeeGrowthDiff.times(BigInt.fromI32(dailyConversionMultiplier));
  hourlyData.price0 = poolData.CFMM_RESERVES[0].times(precision1).div(poolData.CFMM_RESERVES[1]);
  hourlyData.price1 = poolData.CFMM_RESERVES[1].times(precision0).div(poolData.CFMM_RESERVES[0]);
  hourlyData.save();

  if (poolTracer != null && poolTracer.lastHourlyData != hourlyData.id) {
    poolTracer.lastHourlyData = hourlyData.id;
    poolTracer.save();
  }

  const dailyData = createDailyPoolSnapshot(event);
  prevAccFeeIndex = BigInt.fromI32(10).pow(18);
  if (poolTracer != null && poolTracer.lastDailyData != null) {
    const lastDailyData = DailyPoolSnapshot.load(poolTracer.lastDailyData!);
    if (lastDailyData) {
      prevAccFeeIndex = lastDailyData.accFeeIndex;
    }
  }
  dailyData.utilizationRate = poolData.utilizationRate;
  dailyData.borrowRate = poolData.borrowRate;
  dailyData.borrowedLiquidity = poolData.BORROWED_INVARIANT;
  dailyData.borrowedLiquidityETH = getEthUsdValue(token0, token1, poolData.BORROWED_INVARIANT, poolData.lastPrice, true);
  dailyData.borrowedLiquidityUSD = getEthUsdValue(token0, token1, poolData.BORROWED_INVARIANT, poolData.lastPrice, false);
  dailyData.totalLiquidity = totalLiquidity;
  dailyData.totalLiquidityETH = getEthUsdValue(token0, token1, totalLiquidity, poolData.lastPrice, true);
  dailyData.totalLiquidityUSD = getEthUsdValue(token0, token1, totalLiquidity, poolData.lastPrice, false);
  dailyData.utilizationRate = poolData.BORROWED_INVARIANT.times(ratePrecision).div(totalLiquidity);
  dailyData.accFeeIndex = poolData.accFeeIndex;
  dailyConversionMultiplier = 365;
  accFeeGrowthDiff = poolData.accFeeIndex.times(ratePrecision).div(prevAccFeeIndex).minus(ratePrecision);
  dailyData.accFeeIndexGrowth = accFeeGrowthDiff.times(BigInt.fromI32(dailyConversionMultiplier));
  dailyData.price0 = poolData.CFMM_RESERVES[0].times(precision1).div(poolData.CFMM_RESERVES[1]);
  dailyData.price1 = poolData.CFMM_RESERVES[1].times(precision0).div(poolData.CFMM_RESERVES[0]);
  dailyData.save();

  if (poolTracer != null && poolTracer.lastDailyData != dailyData.id) {
    poolTracer.lastDailyData = dailyData.id;
    poolTracer.save();
  }
}

export function handleLoanCreate(event: LoanCreated): void {
  const caller = event.params.caller.toHexString();
  /**
   * If position manager is the caller,
   * use `handleLoanCreateFromPositionManager`
   */
  if (caller == POSITION_MANAGER) return;

  const loanId = event.address.toHexString() + '-' + event.params.tokenId.toString();
  createLoan(loanId, event);
}

export function handleLoanUpdate(event: LoanUpdated): void {
  const loanId = event.address.toHexString() + '-' + event.params.tokenId.toString();
  const loan = Loan.load(loanId);

  if (loan == null) {
    log.error("LOAN NOT AVAILABLE: {}", [loanId]);
    return;
  }

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
  if (event.params.txType == 8) { // 8 -> REPAY_LIQUIDITY
    loan.status = 'CLOSED';
    loan.closedAtBlock = event.block.number;
    loan.closedAtTxhash = event.transaction.hash.toHexString();
    loan.closedAtTimestamp = event.block.timestamp;
  } else if (event.params.txType == 11 || event.params.txType == 12) {  // 11 -> LIQUIDATE, 12 -> LIQUIDATE_WITH_LP
    loan.status = 'LIQUIDATED';
    loan.closedAtBlock = event.block.number;
    loan.closedAtTxhash = event.transaction.hash.toHexString();
    loan.closedAtTimestamp = event.block.timestamp;
  }

  loan.save();

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
    poolBalanceFrom.save();
  }

  let poolBalanceTo = PoolBalance.load(id2);
  if (toAccount.id != ADDRESS_ZERO) {
    if (poolBalanceTo == null) {
      poolBalanceTo = new PoolBalance(id2);
      poolBalanceTo.pool = pool.id;
      poolBalanceTo.account = toAccount.id;
      poolBalanceTo.balance = BigInt.fromI32(0);
      poolBalanceTo.initialBlock = event.block.number;
      poolBalanceTo.initialTimestamp = event.block.timestamp;
    }
    poolBalanceTo.balance = poolBalanceTo.balance.plus(event.params.amount);
    poolBalanceTo.save();
  }
}
