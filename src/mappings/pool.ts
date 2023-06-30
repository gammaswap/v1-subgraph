import { BigInt, log } from '@graphprotocol/graph-ts';
import { Pool, PoolUpdated, LoanCreated, LoanUpdated, Liquidation, Transfer } from '../types/templates/GammaPool/Pool';
import { GammaPool, GammaPoolTracer, Loan, VaultBalance, PoolFlashData, PoolHourlyData, PoolDailyData } from '../types/schema';
import { createLoan, createLiquidation, loadOrCreateAccount, loadOrCreateToken, createPoolFlashData, createPoolHourlyData, createPoolDailyData } from '../helpers/loader';
import { POSITION_MANAGER, ADDRESS_ZERO } from '../helpers/constants';
import { updatePrices, updatePoolStats } from '../helpers/utils';

export function handlePoolUpdate(event: PoolUpdated): void {
  const poolAddress = event.address;
  const poolContract = Pool.bind(poolAddress);
  const pool = GammaPool.load(poolAddress.toHexString());
  
  if (pool == null) {
    log.error("POOL NOT AVAILABLE: {}", [poolAddress.toHexString()]);
    return;
  }

  const tokenMetadata = poolContract.getTokensMetaData();
  const token0 = loadOrCreateToken(pool.token0);
  const token1 = loadOrCreateToken(pool.token1);
  if (token0.name == "" || token0.symbol == "" || token0.decimals == BigInt.fromI32(0)) {
    token0.name = tokenMetadata.get_names()[0];
    token0.symbol = tokenMetadata.get_symbols()[0];
    token0.decimals = BigInt.fromI32(tokenMetadata.get_decimals()[0]);
    token0.save();
  }
  if (token1.name == "" || token1.symbol == "" || token1.decimals == BigInt.fromI32(0)) {
    token1.name = tokenMetadata.get_names()[1];
    token1.symbol = tokenMetadata.get_symbols()[1];
    token1.decimals = BigInt.fromI32(tokenMetadata.get_decimals()[1]);
    token1.save();
  }

  updatePrices(poolAddress);

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

  updatePoolStats(pool);

  pool.save();

  // Historical data
  const poolTracer = GammaPoolTracer.load(poolAddress.toHexString());

  const flashData = createPoolFlashData(event);
  let prevAccFeeIndex = BigInt.fromI32(10).pow(18);
  if (poolTracer != null && poolTracer.lastFlashData != null) {
    const lastFlashData = PoolFlashData.load(poolTracer.lastFlashData!);
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
  flashData.totalLiquidity = totalLiquidity;
  flashData.utilizationRate = poolData.BORROWED_INVARIANT.times(ratePrecision).div(totalLiquidity);
  flashData.accFeeIndex = poolData.accFeeIndex;
  let dailyConversionMultiplier = 365 * 24 * 60 / 5;
  let accFeeGrowthDiff = poolData.accFeeIndex.times(ratePrecision).div(prevAccFeeIndex).minus(ratePrecision);
  flashData.accFeeIndexGrowth = accFeeGrowthDiff.times(BigInt.fromI32(dailyConversionMultiplier));
  flashData.price0 = poolData.CFMM_RESERVES[0].times(precision1).div(poolData.CFMM_RESERVES[1]);
  flashData.price1 = poolData.CFMM_RESERVES[1].times(precision0).div(poolData.CFMM_RESERVES[0]);
  flashData.save();

  if (poolTracer != null && poolTracer.lastFlashData != flashData.id) {
    poolTracer.lastFlashData = flashData.id;
    poolTracer.save();
  }

  const hourlyData = createPoolHourlyData(event);
  prevAccFeeIndex = BigInt.fromI32(10).pow(18);
  if (poolTracer != null && poolTracer.lastHourlyData != null) {
    const lastHourlyData = PoolHourlyData.load(poolTracer.lastHourlyData!);
    if (lastHourlyData) {
      prevAccFeeIndex = lastHourlyData.accFeeIndex;
    }
  }
  hourlyData.utilizationRate = poolData.utilizationRate;
  hourlyData.borrowRate = poolData.borrowRate;
  hourlyData.totalLiquidity = totalLiquidity;
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

  const dailyData = createPoolDailyData(event);
  prevAccFeeIndex = BigInt.fromI32(10).pow(18);
  if (poolTracer != null && poolTracer.lastDailyData != null) {
    const lastDailyData = PoolDailyData.load(poolTracer.lastDailyData!);
    if (lastDailyData) {
      prevAccFeeIndex = lastDailyData.accFeeIndex;
    }
  }
  dailyData.utilizationRate = poolData.utilizationRate;
  dailyData.borrowRate = poolData.borrowRate;
  dailyData.totalLiquidity = totalLiquidity;
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

  // const pool = GammaPool.load(loan.pool)!;
  const poolContract = Pool.bind(event.address);
  const loanData = poolContract.loan(event.params.tokenId);
  loan.rateIndex = loanData.rateIndex;
  loan.initLiquidity = loanData.initLiquidity;
  loan.liquidity = loanData.liquidity;
  loan.lpTokens = loanData.lpTokens;
  if (
    loan.depositedCollateral0 == BigInt.fromI32(0) && loan.depositedCollateral1 == BigInt.fromI32(0) &&
    loan.collateral0 == BigInt.fromI32(0) && loan.collateral0 == BigInt.fromI32(0)
  ) { // Initial deposit only
    loan.depositedCollateral0 = loanData.tokensHeld[0];
    loan.depositedCollateral1 = loanData.tokensHeld[1];
  }
  loan.collateral0 = loanData.tokensHeld[0];
  loan.collateral1 = loanData.tokensHeld[1];
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
      const loanId = poolAddress.toHexString() + '-' + event.params.tokenId.toString();
      const loan = Loan.load(loanId);
      if (loan == null) {
        log.error("LIQUIDATION: LOAN NOT AVAILABLE: {}", [loanId]);
        return;
      }
      const liquidations = pool.liquidations;
      const sequence = liquidations ? liquidations.load().length : 0;
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
