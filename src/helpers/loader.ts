import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../types/GammaFactory/Factory';
import { LoanCreated, LoanUpdated, Liquidation as LiquidationEvent, PoolUpdated } from '../types/templates/GammaPool/Pool';
import { PoolViewer } from '../types/templates/GammaPool/PoolViewer';
import { CreateLoan } from '../types/PositionManager/PositionManager';
import { GammaPool, GammaPoolTracer, Loan, LoanSnapshot, Liquidation, Token, Account, FiveMinPoolSnapshot, HourlyPoolSnapshot, DailyPoolSnapshot } from '../types/schema';
import { NETWORK, POOL_VIEWER, ARBITRUM_BRIDGE_USDC_TOKEN } from './constants';

export function createPool(id: string, event: PoolCreated): GammaPool {
  const pool = new GammaPool(id);
  pool.address = Address.fromHexString(id);
  pool.cfmm = event.params.cfmm;
  pool.protocolId = BigInt.fromI32(event.params.protocolId);

  const poolViewer = PoolViewer.bind(Address.fromString(POOL_VIEWER));
  const tokenMetadata = poolViewer.getTokensMetaData(event.params.tokens);
  const token0 = loadOrCreateToken(event.params.tokens[0].toHexString());
  const token1 = loadOrCreateToken(event.params.tokens[1].toHexString());
  let networkName = NETWORK;
  if (token0.name == "" || token0.symbol == "" || token0.decimals == BigInt.fromI32(0)) {
    token0.name = tokenMetadata.get_names()[0];
    if (networkName == "arbitrum-one" && pool.token0 == ARBITRUM_BRIDGE_USDC_TOKEN) {
      token0.symbol = "USDC.e";
    } else {
      token0.symbol = tokenMetadata.get_symbols()[0];
    }
    token0.decimals = BigInt.fromI32(tokenMetadata.get_decimals()[0]);
    token0.save();
  }
  if (token1.name == "" || token1.symbol == "" || token1.decimals == BigInt.fromI32(0)) {
    token1.name = tokenMetadata.get_names()[1];
    if (networkName == "arbitrum-one" && pool.token1 == ARBITRUM_BRIDGE_USDC_TOKEN) {
      token1.symbol = "USDC.e";
    } else {
      token1.symbol = tokenMetadata.get_symbols()[1];
    }
    token1.decimals = BigInt.fromI32(tokenMetadata.get_decimals()[1]);
    token1.save();
  }

  pool.token0 = token0.id;
  pool.token1 = token1.id;

  pool.lpBalance = BigInt.fromI32(0);
  pool.lpBorrowedBalance = BigInt.fromI32(0);
  pool.lpBorrowedBalancePlusInterest = BigInt.fromI32(0);
  pool.lpInvariant = BigInt.fromI32(0);
  pool.lpBorrowedInvariant = BigInt.fromI32(0);
  pool.accFeeIndex = BigInt.fromI32(10).pow(18);
  pool.lastCfmmFeeIndex = BigInt.fromI32(10).pow(18);
  pool.lastCfmmInvariant = BigInt.fromI32(0);
  pool.lastCfmmTotalSupply = BigInt.fromI32(0);
  pool.lastFeeIndex = BigInt.fromI32(10).pow(18);
  pool.lastPrice = BigInt.fromI32(0);
  
  pool.lpBalanceETH = BigDecimal.fromString('0');
  pool.lpBalanceUSD = BigDecimal.fromString('0');
  pool.lpBalanceInToken0 = BigDecimal.fromString('0');
  pool.lpBalanceInToken1 = BigDecimal.fromString('0');
  pool.lpBorrowedBalanceETH = BigDecimal.fromString('0');
  pool.lpBorrowedBalanceUSD = BigDecimal.fromString('0');
  pool.lpBorrowedBalanceInToken0 = BigDecimal.fromString('0');
  pool.lpBorrowedBalanceInToken1 = BigDecimal.fromString('0');
  pool.lpBorrowedBalancePlusInterestETH = BigDecimal.fromString('0');
  pool.lpBorrowedBalancePlusInterestUSD = BigDecimal.fromString('0');
  pool.lpBorrowedBalancePlusInterestInToken0 = BigDecimal.fromString('0');
  pool.lpBorrowedBalancePlusInterestInToken1 = BigDecimal.fromString('0');
  pool.tvlETH = BigDecimal.fromString('0');
  pool.tvlUSD = BigDecimal.fromString('0');
  pool.lastCfmmETH = BigDecimal.fromString('0');
  pool.lastCfmmUSD = BigDecimal.fromString('0');
  pool.lastCfmmInToken0 = BigDecimal.fromString('0');
  pool.lastCfmmInToken1 = BigDecimal.fromString('0');

  pool.totalSupply = BigInt.fromI32(0);
  pool.token0Balance = BigInt.fromI32(0);
  pool.token1Balance = BigInt.fromI32(0);
  pool.reserve0Balance = BigInt.fromI32(0);
  pool.reserve1Balance = BigInt.fromI32(0);
  pool.borrowRate = BigInt.fromI32(0);
  pool.supplyRate = BigInt.fromI32(0);
  pool.utilizationRate = BigInt.fromI32(0);
  pool.ltvThreshold = BigInt.fromI32(0);
  pool.liquidationFee = BigInt.fromI32(0);
  pool.block = event.block.number;
  pool.timestamp = event.block.timestamp;

  pool.save();

  return pool;
}

export function createPoolTracer(id: string): GammaPoolTracer {
  const poolTracer = new GammaPoolTracer(id);
  poolTracer.pool = id;

  poolTracer.save();

  return poolTracer;
}

export function createLoan(id: string, event: LoanCreated): Loan {
  const pool = GammaPool.load(event.address.toHexString()); // Make sure pool exists
  const loan = new Loan(id);
  if (pool != null) {
    const account = loadOrCreateAccount(event.params.caller.toHexString()); // Make sure account exists
    loan.tokenId = event.params.tokenId;
    loan.pool = pool.id;
    loan.account = account.id;
    loan.rateIndex = BigInt.fromI32(0);
    loan.initLiquidity = BigInt.fromI32(0);
    loan.initLiquidityETH = BigDecimal.fromString('0');
    loan.initLiquidityUSD = BigDecimal.fromString('0');
    loan.liquidity = BigInt.fromI32(0);
    loan.liquidityETH = BigDecimal.fromString('0');
    loan.liquidityUSD = BigDecimal.fromString('0');
    loan.lpTokens = BigInt.fromI32(0);
    loan.collateral0 = BigInt.fromI32(0);
    loan.collateral1 = BigInt.fromI32(0);
    loan.entryPrice = BigInt.fromI32(0);
    loan.status = 'OPEN';
    loan.openedAtBlock = event.block.number;
    loan.openedAtTxhash = event.transaction.hash.toHexString();
    loan.openedAtTimestamp = event.block.timestamp;
    loan.closedAtBlock = BigInt.fromI32(0);
    loan.closedAtTxhash = "";
    loan.closedAtTimestamp = BigInt.fromI32(0);

    loan.save();
  }

  return loan;
}

export function createLoanPositionManager(event: CreateLoan): Loan {
  const pool = GammaPool.load(event.params.pool.toHexString()); // Make sure pool exists
  const id = event.params.pool.toHexString() + '-' + event.params.tokenId.toString();
  const loan = new Loan(id);
  if (pool != null) {
    const account = loadOrCreateAccount(event.params.owner.toHexString()); // Make sure account exists
    loan.tokenId = event.params.tokenId;
    loan.pool = pool.id;
    loan.account = account.id;
    loan.rateIndex = BigInt.fromI32(0);
    loan.initLiquidity = BigInt.fromI32(0);
    loan.initLiquidityETH = BigDecimal.fromString('0');
    loan.initLiquidityUSD = BigDecimal.fromString('0');
    loan.liquidity = BigInt.fromI32(0);
    loan.liquidityETH = BigDecimal.fromString('0');
    loan.liquidityUSD = BigDecimal.fromString('0');
    loan.lpTokens = BigInt.fromI32(0);
    loan.collateral0 = BigInt.fromI32(0);
    loan.collateral1 = BigInt.fromI32(0);
    loan.entryPrice = BigInt.fromI32(0);
    loan.status = 'OPEN';
    loan.openedAtBlock = event.block.number;
    loan.openedAtTxhash = event.transaction.hash.toHexString();
    loan.openedAtTimestamp = event.block.timestamp;
    loan.closedAtBlock = BigInt.fromI32(0);
    loan.closedAtTxhash = "";
    loan.closedAtTimestamp = BigInt.fromI32(0);

    loan.save();
  }

  return loan;
}

export function createLoanSnapshot(loan: Loan, event: LoanUpdated): LoanSnapshot {
  const snapshots = loan.snapshots;
  const sequence = snapshots ? snapshots.load().length : 0;
  const id = loan.id + '-' + sequence.toString();
  const loanSnapshot = new LoanSnapshot(id);
  loanSnapshot.rateIndex = loan.rateIndex;
  loanSnapshot.initLiquidity = loan.initLiquidity;
  loanSnapshot.liquidity = loan.liquidity;
  loanSnapshot.lpTokens = loan.lpTokens;
  loanSnapshot.collateral0 = loan.collateral0;
  loanSnapshot.collateral1 = loan.collateral1;
  if (event.params.txType == 4) {
    loanSnapshot.type = 'INCREASE_COLLATERAL';
  } else if (event.params.txType == 5) {
    loanSnapshot.type = 'DECREASE_COLLATERAL';
  } else if (event.params.txType == 6) {
    loanSnapshot.type = 'REBALANCE_COLLATERAL';
  } else if (event.params.txType == 7) {
    loanSnapshot.type = 'BORROW_LIQUIDITY';
  } else if (event.params.txType == 8) {
    loanSnapshot.type = 'REPAY_LIQUIDITY';
  } else if (event.params.txType == 9) {
    loanSnapshot.type = 'REPAY_LIQUIDITY_SET_RATIO';
  } else if (event.params.txType == 10) {
    loanSnapshot.type = 'REPAY_LIQUIDITY_WITH_LP';
  } else if (event.params.txType == 11) {
    loanSnapshot.type = 'LIQUIDATE';
  } else if (event.params.txType == 12) {
    loanSnapshot.type = 'LIQUIDATE_WITH_LP';
  } else if (event.params.txType == 13) {
    loanSnapshot.type = 'BATCH_LIQUIDATION';
  } else if (event.params.txType == 15) {
    loanSnapshot.type = 'EXTERNAL_REBALANCE';
  } else if (event.params.txType == 16) {
    loanSnapshot.type = 'EXTERNAL_LIQUIDATION';
  } else if (event.params.txType == 17) {
    loanSnapshot.type = 'UPDATE_POOL';
  }
  loanSnapshot.timestamp = event.block.timestamp;
  loanSnapshot.block = event.block.number;

  return loanSnapshot;
}

export function createLiquidation(id: string, event: LiquidationEvent): Liquidation {
  const liquidation = new Liquidation(id);
  const loanId = event.address.toHexString() + '-' + event.params.tokenId.toString();
  
  liquidation.pool = event.address.toHexString();
  liquidation.loan = loanId;
  liquidation.liquidator = event.transaction.from.toHexString();
  liquidation.collateral = event.params.collateral;
  liquidation.liquidity = event.params.liquidity;
  liquidation.writeDown = event.params.writeDownAmt;
  liquidation.block = event.block.number;
  liquidation.timestamp = event.block.timestamp;
  
  liquidation.save();
  
  return liquidation;
}

export function loadOrCreateAccount(id: string): Account {
  let account = Account.load(id);
  if (account == null) {
    account = new Account(id);
    account.save();
  }

  return account;
}

export function loadOrCreateToken(id: string): Token {
  let token = Token.load(id);
  if (token == null) {
    token = new Token(id);
    token.name = "";
    token.symbol = "";
    token.decimals = BigInt.fromI32(0);
    token.priceETH = BigDecimal.fromString('0');
    token.priceUSD = BigDecimal.fromString('0');
    token.save();
  }

  return token;
}

export function createFiveMinPoolSnapshot(event: PoolUpdated): FiveMinPoolSnapshot {
  const poolId = event.address.toHexString();
  const tickId = event.block.timestamp.toI32() / 300;   // 5min segment
  const tickStartTimestamp = tickId * 300;
  const id = poolId.concat('-').concat(BigInt.fromI32(tickId).toString());
  let flashData = FiveMinPoolSnapshot.load(id);

  if (flashData == null) {
    flashData = new FiveMinPoolSnapshot(id);
    flashData.pool = poolId;
    flashData.timestamp = BigInt.fromI32(0);
    flashData.utilizationRate = BigInt.fromI32(0);
    flashData.borrowedLiquidity = BigInt.fromI32(0);
    flashData.borrowedLiquidityETH = BigDecimal.fromString('0');
    flashData.borrowedLiquidityUSD = BigDecimal.fromString('0');
    flashData.totalLiquidity = BigInt.fromI32(0);
    flashData.totalLiquidityETH = BigDecimal.fromString('0');
    flashData.totalLiquidityUSD = BigDecimal.fromString('0');
    flashData.borrowRate = BigInt.fromI32(0);
    flashData.accFeeIndex = BigInt.fromI32(0);
    flashData.accFeeIndexGrowth = BigInt.fromI32(0);
    flashData.price0 = BigInt.fromI32(0);
    flashData.price1 = BigInt.fromI32(0);
    flashData.save();
  }
  flashData.timestamp = BigInt.fromI32(tickStartTimestamp);
  
  // Pad missing flash data items
  const poolTracer = GammaPoolTracer.load(poolId);
  if (poolTracer == null) {
    log.error("GammaPoolTracer is missing for poolId {}", [poolId]);
    return flashData;
  }

  if (poolTracer.lastFiveMinData != null) {
    const lastFlashData = FiveMinPoolSnapshot.load(poolTracer.lastFiveMinData!);
    if (lastFlashData) {
      const timeDiff = tickStartTimestamp - lastFlashData.timestamp.toI32();
      const missingItemsCnt = timeDiff / 300 - 1;
      for (let i = 1; i <= missingItemsCnt; i ++) {
        const missingTickId = lastFlashData.timestamp.toI32() / 300 + i;
        const missingId = poolId.concat('-').concat(missingTickId.toString());
        const missingItem = new FiveMinPoolSnapshot(missingId);
        missingItem.pool = poolId;
        missingItem.timestamp = BigInt.fromI32(missingTickId * 300);
        missingItem.utilizationRate = lastFlashData.utilizationRate;
        missingItem.borrowedLiquidity = lastFlashData.borrowedLiquidity;
        missingItem.borrowedLiquidityETH = lastFlashData.borrowedLiquidityETH;
        missingItem.borrowedLiquidityUSD = lastFlashData.borrowedLiquidityUSD;
        missingItem.totalLiquidity = lastFlashData.totalLiquidity;
        missingItem.totalLiquidityETH = lastFlashData.totalLiquidityETH;
        missingItem.totalLiquidityUSD = lastFlashData.totalLiquidityUSD;
        missingItem.borrowRate = lastFlashData.borrowRate;
        missingItem.accFeeIndex = lastFlashData.accFeeIndex;
        missingItem.accFeeIndexGrowth = BigInt.fromI32(0);
        missingItem.price0 = lastFlashData.price0;
        missingItem.price1 = lastFlashData.price1;
        missingItem.save();
      }
    }
  }

  return flashData;
}

export function createHourlyPoolSnapshot(event: PoolUpdated): HourlyPoolSnapshot {
  const poolId = event.address.toHexString();
  const tickId = event.block.timestamp.toI32() / 3600;   // 1hr segment
  const tickStartTimestamp = tickId * 3600;
  const id = poolId.concat('-').concat(BigInt.fromI32(tickId).toString());
  let hourlyData = HourlyPoolSnapshot.load(id);

  if (hourlyData == null) {
    hourlyData = new HourlyPoolSnapshot(id);
    hourlyData.pool = poolId;
    hourlyData.timestamp = BigInt.fromI32(0);
    hourlyData.utilizationRate = BigInt.fromI32(0);
    hourlyData.borrowedLiquidity = BigInt.fromI32(0);
    hourlyData.borrowedLiquidityETH = BigDecimal.fromString('0');
    hourlyData.borrowedLiquidityUSD = BigDecimal.fromString('0');
    hourlyData.totalLiquidity = BigInt.fromI32(0);
    hourlyData.totalLiquidityETH = BigDecimal.fromString('0');
    hourlyData.totalLiquidityUSD = BigDecimal.fromString('0');
    hourlyData.borrowRate = BigInt.fromI32(0);
    hourlyData.accFeeIndex = BigInt.fromI32(0);
    hourlyData.accFeeIndexGrowth = BigInt.fromI32(0);
    hourlyData.price0 = BigInt.fromI32(0);
    hourlyData.price1 = BigInt.fromI32(0);
    hourlyData.save();
  }
  hourlyData.timestamp = BigInt.fromI32(tickStartTimestamp);

  // Pad missing hourly data items
  const poolTracer = GammaPoolTracer.load(poolId);
  if (poolTracer == null) {
    log.error("GammaPoolTracer is missing for poolId {}", [poolId]);
    return hourlyData;
  }

  if (poolTracer.lastHourlyData != null) {
    const lastHourlyData = HourlyPoolSnapshot.load(poolTracer.lastHourlyData!);
    if (lastHourlyData) {
      const timeDiff = tickStartTimestamp - lastHourlyData.timestamp.toI32();
      const missingItemsCnt = timeDiff / 3600 - 1;
      for (let i = 1; i <= missingItemsCnt; i ++) {
        const missingTickId = lastHourlyData.timestamp.toI32() / 3600 + i;
        const missingId = poolId.concat('-').concat(missingTickId.toString());
        const missingItem = new HourlyPoolSnapshot(missingId);
        missingItem.pool = poolId;
        missingItem.timestamp = BigInt.fromI32(missingTickId * 3600);
        missingItem.utilizationRate = lastHourlyData.utilizationRate;
        missingItem.borrowedLiquidity = lastHourlyData.borrowedLiquidity;
        missingItem.borrowedLiquidityETH = lastHourlyData.borrowedLiquidityETH;
        missingItem.borrowedLiquidityUSD = lastHourlyData.borrowedLiquidityUSD;
        missingItem.totalLiquidity = lastHourlyData.totalLiquidity;
        missingItem.totalLiquidityETH = lastHourlyData.totalLiquidityETH;
        missingItem.totalLiquidityUSD = lastHourlyData.totalLiquidityUSD;
        missingItem.borrowRate = lastHourlyData.borrowRate;
        missingItem.accFeeIndex = lastHourlyData.accFeeIndex;
        missingItem.accFeeIndexGrowth = BigInt.fromI32(0);
        missingItem.price0 = lastHourlyData.price0;
        missingItem.price1 = lastHourlyData.price1;
        missingItem.save();
      }
    }
  }

  return hourlyData;
}

export function createDailyPoolSnapshot(event: PoolUpdated): DailyPoolSnapshot {
  const poolId = event.address.toHexString();
  const tickId = event.block.timestamp.toI32() / 86400;   // 24hr segment
  const tickStartTimestamp = tickId * 86400;
  const id = poolId.concat('-').concat(BigInt.fromI32(tickId).toString());
  let dailyData = DailyPoolSnapshot.load(id);

  if (dailyData == null) {
    dailyData = new DailyPoolSnapshot(id);
    dailyData.pool = poolId;
    dailyData.timestamp = BigInt.fromI32(0);
    dailyData.utilizationRate = BigInt.fromI32(0);
    dailyData.borrowedLiquidity = BigInt.fromI32(0);
    dailyData.borrowedLiquidityETH = BigDecimal.fromString('0');
    dailyData.borrowedLiquidityUSD = BigDecimal.fromString('0');
    dailyData.totalLiquidity = BigInt.fromI32(0);
    dailyData.totalLiquidityETH = BigDecimal.fromString('0');
    dailyData.totalLiquidityUSD = BigDecimal.fromString('0');
    dailyData.borrowRate = BigInt.fromI32(0);
    dailyData.accFeeIndex = BigInt.fromI32(0);
    dailyData.accFeeIndexGrowth = BigInt.fromI32(0);
    dailyData.price0 = BigInt.fromI32(0);
    dailyData.price1 = BigInt.fromI32(0);
    dailyData.save();
  }
  dailyData.timestamp = BigInt.fromI32(tickStartTimestamp);

  // Pad missing daily data items
  const poolTracer = GammaPoolTracer.load(poolId);
  if (poolTracer == null) {
    log.error("GammaPoolTracer is missing for poolId {}", [poolId]);
    return dailyData;
  }

  if (poolTracer.lastDailyData != null) {
    const lastDailyData = DailyPoolSnapshot.load(poolTracer.lastDailyData!);
    if (lastDailyData) {
      const timeDiff = tickStartTimestamp - lastDailyData.timestamp.toI32();
      const missingItemsCnt = timeDiff / 86400 - 1;
      for (let i = 1; i <= missingItemsCnt; i ++) {
        const missingTickId = lastDailyData.timestamp.toI32() / 86400 + i;
        const missingId = poolId.concat('-').concat(missingTickId.toString());
        const missingItem = new DailyPoolSnapshot(missingId);
        missingItem.pool = poolId;
        missingItem.timestamp = BigInt.fromI32(missingTickId * 86400);
        missingItem.utilizationRate = lastDailyData.utilizationRate;
        missingItem.borrowedLiquidity = lastDailyData.borrowedLiquidity;
        missingItem.borrowedLiquidityETH = lastDailyData.borrowedLiquidityETH;
        missingItem.borrowedLiquidityUSD = lastDailyData.borrowedLiquidityUSD;
        missingItem.totalLiquidity = lastDailyData.totalLiquidity;
        missingItem.totalLiquidityETH = lastDailyData.totalLiquidityETH;
        missingItem.totalLiquidityUSD = lastDailyData.totalLiquidityUSD;
        missingItem.borrowRate = lastDailyData.borrowRate;
        missingItem.accFeeIndex = lastDailyData.accFeeIndex;
        missingItem.accFeeIndexGrowth = BigInt.fromI32(0);
        missingItem.price0 = lastDailyData.price0;
        missingItem.price1 = lastDailyData.price1;
        missingItem.save();
      }
    }
  }

  return dailyData;
}