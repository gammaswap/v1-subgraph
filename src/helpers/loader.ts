import { Address, BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../types/GammaFactory/Factory';
import { LoanCreated, Liquidation as LiquidationEvent } from '../types/templates/GammaPool/Pool';
import { CreateLoan } from '../types/PositionManager/PositionManager';
import { GammaPool, Loan, Liquidation, Token, Account } from '../types/schema';

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
    token.save();
  }

  return token;
}