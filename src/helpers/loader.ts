import { Address, BigDecimal, BigInt, Bytes, bigDecimal, log } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../types/GammaFactory/Factory';
import { LoanCreated, Liquidation as LiquidationEvent, PoolUpdated } from '../types/templates/GammaPool/Pool';
import { CreateLoan } from '../types/PositionManager/PositionManager';
import { GammaPool, Loan, Liquidation, Token, Account, PoolFlashData, PoolHourlyData, PoolDailyData } from '../types/schema';

export function createPool(id: string, event: PoolCreated): GammaPool {
  const pool = new GammaPool(id);
  pool.address = Address.fromHexString(id);
  pool.cfmm = event.params.cfmm;
  pool.implementationId = BigInt.fromI32(event.params.protocolId);

  const token0 = loadOrCreateToken(event.params.tokens[0].toHexString());
  const token1 = loadOrCreateToken(event.params.tokens[1].toHexString());
  pool.token0 = token0.id;
  pool.token1 = token1.id;

  pool.lpBalance = BigInt.fromI32(0);
  pool.lpBorrowedBalance = BigInt.fromI32(0);
  pool.lpBorrowedBalancePlusInterest = BigInt.fromI32(0);
  pool.lpInvariant = BigInt.fromI32(0);
  pool.lpBorrowedInvariant = BigInt.fromI32(0);
  pool.accFeeIndex = BigInt.fromI32(0);
  pool.lastCfmmFeeIndex = BigInt.fromI32(0);
  pool.lastCfmmInvariant = BigInt.fromI32(0);
  pool.lastCfmmTotalSupply = BigInt.fromI32(0);
  pool.lastFeeIndex = BigInt.fromI32(0);
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
    loan.liquidity = BigInt.fromI32(0);
    loan.lpTokens = BigInt.fromI32(0);
    loan.collateral0 = BigInt.fromI32(0);
    loan.collateral1 = BigInt.fromI32(0);
    loan.price = BigInt.fromI32(0);
    loan.status = 'OPEN';
    loan.openedBlock = event.block.number;
    loan.openedTimestamp = event.block.timestamp;
    loan.closedBlock = BigInt.fromI32(0);
    loan.closedTimestamp = BigInt.fromI32(0);

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
    loan.liquidity = BigInt.fromI32(0);
    loan.lpTokens = BigInt.fromI32(0);
    loan.collateral0 = BigInt.fromI32(0);
    loan.collateral1 = BigInt.fromI32(0);
    loan.price = BigInt.fromI32(0);
    loan.status = 'OPEN';
    loan.openedBlock = event.block.number;
    loan.openedTimestamp = event.block.timestamp;
    loan.closedBlock = BigInt.fromI32(0);
    loan.closedTimestamp = BigInt.fromI32(0);

    loan.save();
  }

  return loan;
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

export function loadOrCreatePoolFlashData(event: PoolUpdated): PoolFlashData {
  const tickId = event.block.timestamp.toI32() / 300;   // 5min segment
  const tickStartTimestamp = tickId * 300;
  const id = event.address.toHexString().concat('-').concat(BigInt.fromI32(tickId).toString());
  let flashData = PoolFlashData.load(id);

  if (flashData == null) {
    flashData = new PoolFlashData(id);
    flashData.pool = event.address.toHexString();
    flashData.timestamp = BigInt.fromI32(0);
    flashData.utilizationRate = BigInt.fromI32(0);
    flashData.totalLiquidity = BigInt.fromI32(0);
    flashData.borrowRate = BigInt.fromI32(0);
    flashData.accFeeIndexGrowth = BigInt.fromI32(0);
    flashData.price0 = BigInt.fromI32(0);
    flashData.price1 = BigInt.fromI32(0);
    flashData.save();
  }
  flashData.timestamp = BigInt.fromI32(tickStartTimestamp);

  return flashData;
}

export function loadOrCreatePoolHourlyData(event: PoolUpdated): PoolHourlyData {
  const tickId = event.block.timestamp.toI32() / 3600;   // 1hr segment
  const tickStartTimestamp = tickId * 3600;
  const id = event.address.toHexString().concat('-').concat(BigInt.fromI32(tickId).toString());
  let hourlyData = PoolHourlyData.load(id);

  if (hourlyData == null) {
    hourlyData = new PoolHourlyData(id);
    hourlyData.pool = event.address.toHexString();
    hourlyData.timestamp = BigInt.fromI32(0);
    hourlyData.utilizationRate = BigInt.fromI32(0);
    hourlyData.totalLiquidity = BigInt.fromI32(0);
    hourlyData.borrowRate = BigInt.fromI32(0);
    hourlyData.accFeeIndexGrowth = BigInt.fromI32(0);
    hourlyData.price0 = BigInt.fromI32(0);
    hourlyData.price1 = BigInt.fromI32(0);
    hourlyData.save();
  }
  hourlyData.timestamp = BigInt.fromI32(tickStartTimestamp);

  return hourlyData;
}

export function loadOrCreatePoolDailyData(event: PoolUpdated): PoolDailyData {
  const tickId = event.block.timestamp.toI32() / 86400;   // 24hr segment
  const tickStartTimestamp = tickId * 86400;
  const id = event.address.toHexString().concat('-').concat(BigInt.fromI32(tickId).toString());
  let dailyData = PoolDailyData.load(id);

  if (dailyData == null) {
    dailyData = new PoolDailyData(id);
    dailyData.pool = event.address.toHexString();
    dailyData.timestamp = BigInt.fromI32(0);
    dailyData.utilizationRate = BigInt.fromI32(0);
    dailyData.totalLiquidity = BigInt.fromI32(0);
    dailyData.borrowRate = BigInt.fromI32(0);
    dailyData.accFeeIndexGrowth = BigInt.fromI32(0);
    dailyData.price0 = BigInt.fromI32(0);
    dailyData.price1 = BigInt.fromI32(0);
    dailyData.save();
  }
  dailyData.timestamp = BigInt.fromI32(tickStartTimestamp);

  return dailyData;
}