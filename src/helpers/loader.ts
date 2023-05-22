import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../types/GammaFactory/Factory';
import { GammaPool, Loan, Position, Liquidation, Account } from '../types/schema';
import { ADDRESS_ZERO } from './constants';

export function loadOrCreatePool(id: string, event: PoolCreated): GammaPool {
  let pool = GammaPool.load(id);
  if (pool == null) {
    pool = new GammaPool(id);
    pool.address = Address.fromHexString(id);
    pool.cfmm = event.params.cfmm;
    pool.protocolId = BigInt.fromI32(event.params.protocolId);
    pool.token0 = event.params.tokens[0];
    pool.token0Symbol = "";
    pool.token0Decimals = BigInt.fromI32(18);
    pool.token1 = event.params.tokens[1];
    pool.token1Symbol = "";
    pool.token1Decimals = BigInt.fromI32(18);
    pool.lpBalance = BigDecimal.fromString("0");
    pool.lpBorrowedBalance = BigDecimal.fromString("0");
    pool.lpBorrowedBalancePlusInterest = BigDecimal.fromString("0");
    pool.lpInvariant = BigDecimal.fromString("0");
    pool.lpBorrowedInvariant = BigDecimal.fromString("0");
    pool.accFeeIndex = BigDecimal.fromString("0");
    pool.lastCfmmFeeIndex = BigDecimal.fromString("0");
    pool.lastCfmmInvariant = BigDecimal.fromString("0");
    pool.lastCfmmTotalSupply = BigDecimal.fromString("0");
    pool.lastFeeIndex = BigDecimal.fromString("0");
    pool.lastPrice = BigDecimal.fromString("0");
    pool.totalSupply = BigDecimal.fromString("0");
    pool.token0Balance = BigDecimal.fromString("0");
    pool.token1Balance = BigDecimal.fromString("0");
    pool.reserve0Balance = BigDecimal.fromString("0");
    pool.reserve1Balance = BigDecimal.fromString("0");
    pool.borrowRate = BigDecimal.fromString("0");
    pool.supplyRate = BigDecimal.fromString("0");
    pool.utilizationRate = BigDecimal.fromString("0");
    pool.ltvThreshold = BigDecimal.fromString("0");
    pool.liquidationFee = BigDecimal.fromString("0");
    pool.block = event.block.number;
    pool.timestamp = event.block.timestamp;

    pool.save();
  }

  return pool;
}

export function loadOrCreateLoan(id: string, params: any): Loan {
  let loan = Loan.load(id);
  if (loan == null) {
    loan = new Loan(id);
    loan.tokenId = params.tokenId;
    loan.pool = params.poolId;
    loan.account = params.accountId;
    loan.rateIndex = params.rateIndex || BigDecimal.fromString("0");
    loan.initLiquidity = params.initLiquidity || BigDecimal.fromString("0");
    loan.liquidity = params.liquidity || BigDecimal.fromString("0");
    loan.lpTokens = params.lpTokens || BigDecimal.fromString("0");
    loan.token0Held = params.token0Held || BigDecimal.fromString("0");
    loan.token1Held = params.token1Held || BigDecimal.fromString("0");
    loan.price = params.price || BigDecimal.fromString("0");
    if (params.status == 0) {
      loan.status = 'OPEN';
    } else if (params.status == 1) {
      loan.status = 'CLOSED';
    } else if (params.status == 2) {
      loan.status = 'LIQUIDATED_PARTIAL';
    } else if (params.status == 3) {
      loan.status = 'LIQUIDATED_FULL';
    }
    loan.openedBlock = params.openedBlock || BigInt.fromI32(0);
    loan.openedBlock = params.openedTimestamp || BigInt.fromI32(0);
    loan.closedBlock = params.closedBlock || BigInt.fromI32(0);
    loan.closedBlock = params.closedTimestamp || BigInt.fromI32(0);

    loan.save();
  }

  return loan;
}

export function loadOrCreatePosition(id: string, params: any): Position {
  let position = Position.load(id);
  if (position == null) {
    position = new Position(id);
    position.pool = params.poolId;
    position.account = params.accountId;
    position.gsTokens = params.gsTokens || BigDecimal.fromString("0");
    position.lpTokens = params.lpTokens || BigDecimal.fromString("0");

    position.save();
  }

  return position;
}

export function loadOrCreateLiquidation(id: string, params: any): Liquidation {
  let liquidation = Liquidation.load(id);
  if (liquidation == null) {
    liquidation = new Liquidation(id);
    liquidation.pool = params.poolId;
    liquidation.loan = params.loanId;
    liquidation.liquidator = params.accountId;
    liquidation.collateral = params.collateral || BigDecimal.fromString("0");
    liquidation.liquidity = params.liquidity || BigDecimal.fromString("0");
    liquidation.writeDown = params.writeDown || BigDecimal.fromString("0");
    liquidation.block = params.block || BigInt.fromI32(0);
    liquidation.timestamp = params.timestamp || BigInt.fromI32(0);

    liquidation.save();
  }

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