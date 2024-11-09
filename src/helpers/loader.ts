import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../types/GammaFactory/Factory';
import { PairCreated } from '../types/DeltaswapFactory/DeltaSwapFactory';
import { LoanCreated, LoanUpdated, Liquidation as LiquidationEvent, PoolUpdated } from '../types/templates/GammaPool/Pool';
import { PoolViewer__getLatestPoolDataResultDataStruct as LatestPoolData } from '../types/templates/GammaPool/PoolViewer';
import { ERC20 } from '../types/templates/DeltaSwapPair/ERC20';
import { ERC20b } from '../types/templates/DeltaSwapPair/ERC20b';
import {
  DeltaSwapPair as DeltaSwapPairSource,
  AeroPool as AeroPoolSource,
  AeroCLPool as AeroCLPoolSource,
  UniswapV3Pool as UniswapV3PoolSource
} from "../types/templates";
import {
  GammaPool,
  GammaPoolTracer,
  Loan,
  LoanSnapshot,
  Liquidation,
  Token,
  Account,
  Protocol,
  ProtocolToken,
  FiveMinPoolSnapshot,
  HourlyPoolSnapshot,
  DailyPoolSnapshot,
  DeltaSwapPair,
  About,
  CollateralTokenBalance,
  TotalCollateralTokenBalance
} from '../types/schema';
import { NETWORK, ARBITRUM_BRIDGE_USDC_TOKEN, ADDRESS_ZERO, VERSION } from './constants';
import { getEthUsdValue, isTokenValid } from './utils';

const YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

export function createPool(id: string, event: PoolCreated): boolean {
  const protocol = loadOrCreateProtocol(event.params.protocolId.toString());

  const pool = new GammaPool(id);
  pool.address = Address.fromHexString(id);
  pool.cfmm = event.params.cfmm;
  // pool.protocol = protocol.id;
  pool.protocolId = BigInt.fromI32(event.params.protocolId);

  const token0 = loadOrCreateToken(event.params.tokens[0].toHexString());
  const token1 = loadOrCreateToken(event.params.tokens[1].toHexString());

  if(token0 == null || token1 == null || !isTokenValid(token0) || !isTokenValid(token1)) {
    log.error("Invalid Tokens: Failed to create pool {}", [id]);
    return false;
  }

  pool.token0 = token0.id;
  pool.token1 = token1.id;

  loadOrCreateProtocolToken(protocol.id, token0.id);
  loadOrCreateProtocolToken(protocol.id, token1.id);

  pool.shortStrategy = Address.fromHexString(ADDRESS_ZERO);
  pool.borrowStrategy = Address.fromHexString(ADDRESS_ZERO);
  pool.repayStrategy = Address.fromHexString(ADDRESS_ZERO);
  pool.rebalanceStrategy = Address.fromHexString(ADDRESS_ZERO);
  pool.singleLiquidationStrategy = Address.fromHexString(ADDRESS_ZERO);
  pool.batchLiquidationStrategy = Address.fromHexString(ADDRESS_ZERO);

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
  pool.borrowedBalance0 = BigInt.fromI32(0);
  pool.borrowedBalance1 = BigInt.fromI32(0);
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
  pool.lpReserve0 = BigInt.fromI32(0);
  pool.lpReserve1 = BigInt.fromI32(0);
  pool.borrowRate = BigInt.fromI32(0);
  pool.supplyRate = BigInt.fromI32(0);
  pool.utilizationRate = BigInt.fromI32(0);
  pool.emaUtilRate = BigInt.fromI32(0);
  pool.emaMultiplier = 0;
  pool.minUtilRate1 = 0;
  pool.minUtilRate2 = 0;
  pool.feeDivisor = 0;
  pool.origFee = 0;
  pool.ltvThreshold = BigInt.fromI32(0);
  pool.liquidationFee = BigInt.fromI32(0);
  pool.hasStakingTrackers = false;
  pool.activeStaking = false;
  pool.block = event.block.number;
  pool.timestamp = event.block.timestamp;


  if(!createPairFromPool(pool)) {
    return false;
  }

  pool.save();

  return true;
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
    loan.manager = Address.fromHexString(ADDRESS_ZERO);
    loan.pool = pool.id;
    loan.token0 = pool.token0;
    loan.token1 = pool.token1;
    loan.protocol = pool.protocolId.toString();
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

export function loadOrCreateCollateralToken(poolId: string, tokenId: string, accountId: string): CollateralTokenBalance {
  const collateralTokenId = poolId+"-"+tokenId+"-"+accountId;
  let collateralTokenBalance = CollateralTokenBalance.load(collateralTokenId);
  if (collateralTokenBalance == null) {
    collateralTokenBalance = new CollateralTokenBalance(collateralTokenId);
    collateralTokenBalance.account = accountId;
    collateralTokenBalance.pool = poolId;
    collateralTokenBalance.token = tokenId;
    collateralTokenBalance.balance = BigInt.fromI32(0);
    collateralTokenBalance.save();
  }

  return collateralTokenBalance;
}

export function loadOrCreateTotalCollateralToken(tokenId: string, accountId: string): TotalCollateralTokenBalance {
  const totalCollateralTokenId = tokenId+"-"+accountId;
  let totalCollateralTokenBalance = TotalCollateralTokenBalance.load(totalCollateralTokenId);
  if (totalCollateralTokenBalance == null) {
    totalCollateralTokenBalance = new TotalCollateralTokenBalance(totalCollateralTokenId);
    totalCollateralTokenBalance.account = accountId;
    totalCollateralTokenBalance.token = tokenId;
    totalCollateralTokenBalance.balance = BigInt.fromI32(0);
    totalCollateralTokenBalance.save();
  }

  return totalCollateralTokenBalance;
}

export function transferLoanOwner(loanId: string, newOwner: string, setManager: boolean, manager: Address): void {
  const loan = Loan.load(loanId);
  if (loan == null) {
    log.error("LOAN NOT AVAILABLE: {}", [loanId]);
    return;
  }

  if (setManager) {
    loan.manager = manager;
  }

  const account = loadOrCreateAccount(newOwner);

  // subtract from here
  const fromCollateralToken0 = loadOrCreateCollateralToken(loan.pool, loan.token0, loan.account);
  const fromCollateralToken1 = loadOrCreateCollateralToken(loan.pool, loan.token1, loan.account);
  const fromTotalCollateralToken0 = loadOrCreateTotalCollateralToken(loan.token0, loan.account);
  const fromTotalCollateralToken1 = loadOrCreateTotalCollateralToken(loan.token1, loan.account);

  fromCollateralToken0.balance = fromCollateralToken0.balance.minus(loan.collateral0);
  fromCollateralToken1.balance = fromCollateralToken1.balance.minus(loan.collateral1);
  fromTotalCollateralToken0.balance = fromTotalCollateralToken0.balance.minus(loan.collateral0);
  fromTotalCollateralToken1.balance = fromTotalCollateralToken1.balance.minus(loan.collateral1);

  fromCollateralToken0.save();
  fromCollateralToken1.save();
  fromTotalCollateralToken0.save();
  fromTotalCollateralToken1.save();

  loan.account = account.id;
  loan.save();

  // add to here
  const toCollateralToken0 = loadOrCreateCollateralToken(loan.pool, loan.token0, loan.account);
  const toCollateralToken1 = loadOrCreateCollateralToken(loan.pool, loan.token1, loan.account);
  const toTotalCollateralToken0 = loadOrCreateTotalCollateralToken(loan.token0, loan.account);
  const toTotalCollateralToken1 = loadOrCreateTotalCollateralToken(loan.token1, loan.account);

  toCollateralToken0.balance = toCollateralToken0.balance.plus(loan.collateral0);
  toCollateralToken1.balance = toCollateralToken1.balance.plus(loan.collateral1);
  toTotalCollateralToken0.balance = toTotalCollateralToken0.balance.plus(loan.collateral0);
  toTotalCollateralToken1.balance = toTotalCollateralToken1.balance.plus(loan.collateral1);

  toCollateralToken0.save();
  toCollateralToken1.save();
  toTotalCollateralToken0.save();
  toTotalCollateralToken1.save();
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
  const loanId = event.params.tokenId.toString();
  
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
    const tokenAddress = Address.fromString(id);

    const tokenContract = ERC20.bind(tokenAddress);
    const tokenContract2 = ERC20b.bind(tokenAddress);

    let decimals = BigInt.fromString("0");
    let name = "";
    let symbol = "";

    const decimalsResult = tokenContract.try_decimals();
    if(!decimalsResult.reverted) {
      decimals = BigInt.fromString(decimalsResult.value.toString());
    } else {
      log.error("1 Failed to get decimals for token {}", [id]);
      const decimalsResult2 = tokenContract2.try_decimals();
      if(!decimalsResult2.reverted) {
        decimals = BigInt.fromString(decimalsResult2.value.toString());
      } else {
        log.error("2 Failed to get decimals for token {}", [id]);
      }
    }

    const nameResult = tokenContract.try_name();
    if(!nameResult.reverted) {
      name = nameResult.value.toString().trim();
    } else {
      log.error("1 Failed to get name for token {}", [id]);
      const nameResult2 = tokenContract2.try_name();
      if(!nameResult2.reverted) {
        name = nameResult2.value.toString().trim();
      } else {
        log.error("2 Failed to get name for token {}", [id]);
      }

    }

    const symbolResult = tokenContract.try_symbol();
    if(!symbolResult.reverted) {
      symbol = symbolResult.value.toString().trim();
    } else {
      log.error("1 Failed to get symbol for token {}", [id]);
      const symbolResult2 = tokenContract2.try_symbol();
      if(!symbolResult2.reverted) {
        symbol = symbolResult2.value.toString().trim();
      } else {
        log.error("2 Failed to get symbol for token {}", [id]);
      }
    }

    token.name = name;
    token.symbol = symbol;
    token.decimals = decimals;

    if(!isTokenValid(token)) {
      log.error("Token {} decimal value {} not supported", [id, decimals.toString()]);
    }

    if (NETWORK == "arbitrum-one" && token.id == ARBITRUM_BRIDGE_USDC_TOKEN) {
      token.symbol = "USDC.e";
    }

    token.priceETH = BigDecimal.fromString('0');
    token.priceUSD = BigDecimal.fromString('0');
    token.lpBalanceBN = BigInt.fromString('0');
    token.lpBalanceUSD = BigDecimal.fromString('0');
    token.lpBalanceETH = BigDecimal.fromString('0');
    token.dsBalanceBN = BigInt.fromString('0');
    token.dsBalanceUSD = BigDecimal.fromString('0');
    token.dsBalanceETH = BigDecimal.fromString('0');
    token.gsBalanceBN = BigInt.fromString('0');
    token.gsBalanceUSD = BigDecimal.fromString('0');
    token.gsBalanceETH = BigDecimal.fromString('0');
    token.balanceBN = BigInt.fromString('0');
    token.balanceUSD = BigDecimal.fromString('0');
    token.balanceETH = BigDecimal.fromString('0');
    token.borrowedBalanceBN = BigInt.fromString('0');
    token.borrowedBalanceUSD = BigDecimal.fromString('0');
    token.borrowedBalanceETH = BigDecimal.fromString('0');
    token.isDerived = false;
    token.save();
  }

  return token;
}

export function loadOrCreateProtocol(id: string): Protocol {
  let protocol = Protocol.load(id);
  if (protocol == null) {
    protocol = new Protocol(id);
    protocol.save();
  }

  return protocol;
}

export function loadOrCreateProtocolToken(protocolId: string, token: string): ProtocolToken {
  const id = protocolId + '-' + token;
  let protocolToken = ProtocolToken.load(id);
  if (protocolToken == null) {
    protocolToken = new ProtocolToken(id);
    protocolToken.protocol = protocolId;
    protocolToken.token = token;
    protocolToken.save();
  }

  return protocolToken;
}

export function createPairFromRouter(id: string, token0Addr: string, token1Addr: string, protocol: string, fee: BigInt): boolean {
  let pair = DeltaSwapPair.load(id);
  if (pair == null) {
    pair = new DeltaSwapPair(id);
    const token0 = loadOrCreateToken(token0Addr);
    const token1 = loadOrCreateToken(token1Addr);

    if(token0 == null || token1 == null || !isTokenValid(token0) || !isTokenValid(token1)) {
      log.error("Invalid Tokens: Failed to create Pair {} from router", [id]);
      return false;
    }

    pair.totalSupply = BigInt.fromI32(0);
    pair.token0 = token0.id;
    pair.token1 = token1.id;
    pair.timestamp = BigInt.fromI32(0);
    pair.startBlock = BigInt.fromI32(0);
    pair.reserve0 = BigInt.fromI32(0);
    pair.reserve1 = BigInt.fromI32(0);
    pair.protocol = BigInt.fromString(protocol);
    pair.pool = ADDRESS_ZERO;
    // V3 pools
    pair.fee = fee;
    pair.sqrtPriceX96 = BigInt.fromI32(0);
    pair.liquidity = BigInt.fromI32(0);
    // router
    pair.liquidityETH = BigDecimal.zero();
    pair.liquidityUSD = BigDecimal.zero();
    pair.isTracked = true;
    pair.save();

    if(pair.protocol.ge(BigInt.fromI32(1)) && pair.protocol.lt(BigInt.fromI32(3))) {
      DeltaSwapPairSource.create(Address.fromString(id));
    } else if(pair.protocol.ge(BigInt.fromI32(4)) && pair.protocol.le(BigInt.fromI32(5))){ // Aerodrome Stable & NonStable
      AeroPoolSource.create(Address.fromString(id));
    } else if(pair.protocol.equals(BigInt.fromI32(6))) { // UniswapV3
      UniswapV3PoolSource.create(Address.fromString(id));
    } else if(pair.protocol.equals(BigInt.fromI32(7))) { // AerodromeCL
      AeroCLPoolSource.create(Address.fromString(id));
    }
  }
  return true;
}

export function createPairFromPool(pool: GammaPool): boolean {
  const id = pool.cfmm.toHexString();
  let pair = DeltaSwapPair.load(id);
  if (pair == null) {
    pair = new DeltaSwapPair(id);
    const token0 = loadOrCreateToken(pool.token0);
    const token1 = loadOrCreateToken(pool.token1);

    if(token0 == null || token1 == null || !isTokenValid(token0) || !isTokenValid(token1)) {
      log.error("Invalid Tokens: Failed to create Pair {} from pool {}", [id, pool.id]);
      return false;
    }

    pair.totalSupply = BigInt.fromI32(0);
    pair.token0 = token0.id;
    pair.token1 = token1.id;
    pair.timestamp = BigInt.fromI32(0);
    pair.startBlock = BigInt.fromI32(0);
    pair.reserve0 = BigInt.fromI32(0);
    pair.reserve1 = BigInt.fromI32(0);
    pair.protocol = pool.protocolId;
    pair.pool = pool.id;
    // V3 pools
    pair.fee = BigInt.fromI32(0);
    pair.sqrtPriceX96 = BigInt.fromI32(0);
    pair.liquidity = BigInt.fromI32(0);
    // router
    pair.liquidityETH = BigDecimal.zero();
    pair.liquidityUSD = BigDecimal.zero();
    pair.isTracked = false;
    pair.save();

    DeltaSwapPairSource.create(Address.fromBytes(pool.cfmm));
  } else if(pair.isTracked) {
    pair.isTracked = false;
    pair.save();
  }
  return true;
}

export function createPair(event: PairCreated, protocol: string): boolean {
  const id = event.params.pair.toHexString();
  let pair = DeltaSwapPair.load(id);
  if (pair == null) {
    pair = new DeltaSwapPair(id);
    const token0 = loadOrCreateToken(event.params.token0.toHexString());
    const token1 = loadOrCreateToken(event.params.token1.toHexString());

    if(token0 == null || token1 == null || !isTokenValid(token0) || !isTokenValid(token1)) {
      log.error("Invalid Tokens: Failed to create Pair {}", [id]);
      return false;
    }

    pair.totalSupply = BigInt.fromI32(0);
    pair.token0 = token0.id;
    pair.token1 = token1.id;
    pair.timestamp = BigInt.fromI32(0);
    pair.startBlock = BigInt.fromI32(0);
    pair.reserve0 = BigInt.fromI32(0);
    pair.reserve1 = BigInt.fromI32(0);
    pair.protocol = BigInt.fromString(protocol);
    pair.pool = ADDRESS_ZERO;
    // V3 pools
    pair.fee = BigInt.fromI32(0);
    pair.sqrtPriceX96 = BigInt.fromI32(0);
    pair.liquidity = BigInt.fromI32(0);
    // router
    pair.liquidityETH = BigDecimal.zero();
    pair.liquidityUSD = BigDecimal.zero();
    pair.isTracked = false;
    pair.save();
  }
  return true;
}

export function createFiveMinPoolSnapshot(event: PoolUpdated, poolData: LatestPoolData): FiveMinPoolSnapshot {
  const poolId = event.address.toHexString();
  const tickId = event.block.timestamp.toI32() / 300;   // 5min segment
  const tickStartTimestamp = tickId * 300;
  const id = poolId.concat('-').concat(BigInt.fromI32(tickId).toString());

  const pool = GammaPool.load(poolId)!;
  const poolTracer = GammaPoolTracer.load(poolId);
  const token0 = loadOrCreateToken(pool.token0);
  const token1 = loadOrCreateToken(pool.token1);
  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const ratePrecision = BigInt.fromI32(10).pow(18);
  const totalLiquidity = poolData.BORROWED_INVARIANT.plus(poolData.LP_INVARIANT);

  let flashData = FiveMinPoolSnapshot.load(id);

  if (flashData == null) {
    flashData = new FiveMinPoolSnapshot(id);
    flashData.pool = poolId;
    flashData.timestamp = event.block.timestamp;
    flashData.tickTimestamp = BigInt.fromI32(tickStartTimestamp);
    let prevAccFeeIndex = BigInt.fromI32(10).pow(18);
    if (poolTracer != null && poolTracer.lastFiveMinData != null) {
      const lastFiveMinData = FiveMinPoolSnapshot.load(poolTracer.lastFiveMinData!);
      if (lastFiveMinData) {
        prevAccFeeIndex = lastFiveMinData.accFeeIndex;
      }
    }
    flashData.utilizationRate = poolData.utilizationRate;
    flashData.borrowRate = poolData.borrowRate;
    flashData.borrowedLiquidity = poolData.BORROWED_INVARIANT;
    flashData.borrowedLiquidityETH = getEthUsdValue(token0, token1, poolData.BORROWED_INVARIANT, poolData.lastPrice, true);
    flashData.borrowedLiquidityUSD = getEthUsdValue(token0, token1, poolData.BORROWED_INVARIANT, poolData.lastPrice, false);
    flashData.totalLiquidity = totalLiquidity;
    flashData.totalLiquidityETH = getEthUsdValue(token0, token1, totalLiquidity, poolData.lastPrice, true);
    flashData.totalLiquidityUSD = getEthUsdValue(token0, token1, totalLiquidity, poolData.lastPrice, false);
    // flashData.utilizationRate = poolData.BORROWED_INVARIANT.times(ratePrecision).div(totalLiquidity);
    flashData.accFeeIndex = poolData.accFeeIndex;
    flashData.totalSupply = poolData.totalSupply;
    flashData.supplyAPY = BigDecimal.fromString('0');
    flashData.borrowAPR = BigDecimal.fromString('0');
    if (poolTracer != null && poolTracer.lastFiveMinData != null) {
      const accFeeGrowthDiff = poolData.accFeeIndex.times(ratePrecision).div(prevAccFeeIndex).minus(ratePrecision);
      const lastFiveMinData = FiveMinPoolSnapshot.load(poolTracer.lastFiveMinData!);
      if (lastFiveMinData) {
        // APY = Annaulized of ((totalLiquidity1 / totalLiquidity0) / (totalSupply1 / totalSupply0)) - 1
        flashData.supplyAPY = totalLiquidity.divDecimal(lastFiveMinData.totalLiquidity.toBigDecimal())
          .div(flashData.totalSupply.divDecimal(lastFiveMinData.totalSupply.toBigDecimal()))
          .minus(BigDecimal.fromString('1'))
          .times(BigInt.fromI32(YEAR_IN_SECONDS).toBigDecimal())
          .div(flashData.timestamp.minus(lastFiveMinData.timestamp).toBigDecimal());

        // APR = Annualized of (accFeeIndex1 / accFeeIndex0) - 1
        flashData.borrowAPR = accFeeGrowthDiff.times(BigInt.fromI32(YEAR_IN_SECONDS))
          .div(flashData.timestamp.minus(lastFiveMinData.timestamp))
          .divDecimal(ratePrecision.toBigDecimal());
      }
    }
    flashData.price0 = poolData.CFMM_RESERVES[0].times(precision1).div(poolData.CFMM_RESERVES[1]);
    flashData.price1 = poolData.CFMM_RESERVES[1].times(precision0).div(poolData.CFMM_RESERVES[0]);
    flashData.save();
  }
  
  // Pad missing flash data items
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
        missingItem.timestamp = lastFlashData.timestamp;
        missingItem.tickTimestamp = BigInt.fromI32(missingTickId * 300);
        missingItem.utilizationRate = lastFlashData.utilizationRate;
        missingItem.borrowedLiquidity = lastFlashData.borrowedLiquidity;
        missingItem.borrowedLiquidityETH = lastFlashData.borrowedLiquidityETH;
        missingItem.borrowedLiquidityUSD = lastFlashData.borrowedLiquidityUSD;
        missingItem.totalLiquidity = lastFlashData.totalLiquidity;
        missingItem.totalLiquidityETH = lastFlashData.totalLiquidityETH;
        missingItem.totalLiquidityUSD = lastFlashData.totalLiquidityUSD;
        missingItem.borrowRate = lastFlashData.borrowRate;
        missingItem.accFeeIndex = lastFlashData.accFeeIndex;
        missingItem.price0 = lastFlashData.price0;
        missingItem.price1 = lastFlashData.price1;
        missingItem.totalSupply = lastFlashData.totalSupply;
        missingItem.supplyAPY = lastFlashData.supplyAPY;
        missingItem.borrowAPR = lastFlashData.borrowAPR;
        missingItem.save();
      }
    }
  }

  if (poolTracer != null && poolTracer.lastFiveMinData != flashData.id) {
    poolTracer.lastFiveMinData = flashData.id;
    poolTracer.save();
  }

  return flashData;
}

export function createHourlyPoolSnapshot(event: PoolUpdated, poolData: LatestPoolData): HourlyPoolSnapshot {
  const poolId = event.address.toHexString();
  const tickId = event.block.timestamp.toI32() / 3600;   // 1hr segment
  const tickStartTimestamp = tickId * 3600;
  const id = poolId.concat('-').concat(BigInt.fromI32(tickId).toString());

  const pool = GammaPool.load(poolId)!;
  const poolTracer = GammaPoolTracer.load(poolId);
  const token0 = loadOrCreateToken(pool.token0);
  const token1 = loadOrCreateToken(pool.token1);
  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const ratePrecision = BigInt.fromI32(10).pow(18);
  const totalLiquidity = poolData.BORROWED_INVARIANT.plus(poolData.LP_INVARIANT);

  let hourlyData = HourlyPoolSnapshot.load(id);

  if (hourlyData == null) {
    hourlyData = new HourlyPoolSnapshot(id);
    hourlyData.pool = poolId;
    hourlyData.timestamp = event.block.timestamp;
    hourlyData.tickTimestamp = BigInt.fromI32(tickStartTimestamp);
    let prevAccFeeIndex = BigInt.fromI32(10).pow(18);
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
    // hourlyData.utilizationRate = poolData.BORROWED_INVARIANT.times(ratePrecision).div(totalLiquidity);
    hourlyData.accFeeIndex = poolData.accFeeIndex;
    hourlyData.totalSupply = poolData.totalSupply;
    hourlyData.supplyAPY = BigDecimal.fromString('0');
    hourlyData.borrowAPR = BigDecimal.fromString('0');
    if (poolTracer != null && poolTracer.lastHourlyData != null) {
      const accFeeGrowthDiff = poolData.accFeeIndex.times(ratePrecision).div(prevAccFeeIndex).minus(ratePrecision);
      const lastHourlyData = HourlyPoolSnapshot.load(poolTracer.lastHourlyData!);
      if (lastHourlyData) {
        // APY = Annaulized of ((totalLiquidity1 / totalLiquidity0) / (totalSupply1 / totalSupply0)) - 1
        hourlyData.supplyAPY = totalLiquidity.divDecimal(lastHourlyData.totalLiquidity.toBigDecimal())
          .div(hourlyData.totalSupply.divDecimal(lastHourlyData.totalSupply.toBigDecimal()))
          .minus(BigDecimal.fromString('1'))
          .times(BigInt.fromI32(YEAR_IN_SECONDS).toBigDecimal())
          .div(hourlyData.timestamp.minus(lastHourlyData.timestamp).toBigDecimal());

        // APR = Annualized of (accFeeIndex1 / accFeeIndex0) - 1
        hourlyData.borrowAPR = accFeeGrowthDiff.times(BigInt.fromI32(YEAR_IN_SECONDS))
          .div(hourlyData.timestamp.minus(lastHourlyData.timestamp))
          .divDecimal(ratePrecision.toBigDecimal());
      }
    }
    hourlyData.price0 = poolData.CFMM_RESERVES[0].times(precision1).div(poolData.CFMM_RESERVES[1]);
    hourlyData.price1 = poolData.CFMM_RESERVES[1].times(precision0).div(poolData.CFMM_RESERVES[0]);
    hourlyData.save();
  }

  // Pad missing hourly data items
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
        missingItem.timestamp = lastHourlyData.timestamp;
        missingItem.tickTimestamp = BigInt.fromI32(missingTickId * 3600);
        missingItem.utilizationRate = lastHourlyData.utilizationRate;
        missingItem.borrowedLiquidity = lastHourlyData.borrowedLiquidity;
        missingItem.borrowedLiquidityETH = lastHourlyData.borrowedLiquidityETH;
        missingItem.borrowedLiquidityUSD = lastHourlyData.borrowedLiquidityUSD;
        missingItem.totalLiquidity = lastHourlyData.totalLiquidity;
        missingItem.totalLiquidityETH = lastHourlyData.totalLiquidityETH;
        missingItem.totalLiquidityUSD = lastHourlyData.totalLiquidityUSD;
        missingItem.borrowRate = lastHourlyData.borrowRate;
        missingItem.accFeeIndex = lastHourlyData.accFeeIndex;
        missingItem.price0 = lastHourlyData.price0;
        missingItem.price1 = lastHourlyData.price1;
        missingItem.totalSupply = lastHourlyData.totalSupply;
        missingItem.supplyAPY = lastHourlyData.supplyAPY;
        missingItem.borrowAPR = lastHourlyData.borrowAPR;
        missingItem.save();
      }
    }
  }

  if (poolTracer != null && poolTracer.lastHourlyData != hourlyData.id) {
    poolTracer.lastHourlyData = hourlyData.id;
    poolTracer.save();
  }

  return hourlyData;
}

export function createDailyPoolSnapshot(event: PoolUpdated, poolData: LatestPoolData): DailyPoolSnapshot {
  const poolId = event.address.toHexString();
  const tickId = event.block.timestamp.toI32() / 86400;   // 24hr segment
  const tickStartTimestamp = tickId * 86400;
  const id = poolId.concat('-').concat(BigInt.fromI32(tickId).toString());

  const pool = GammaPool.load(poolId)!;
  const poolTracer = GammaPoolTracer.load(poolId);
  const token0 = loadOrCreateToken(pool.token0);
  const token1 = loadOrCreateToken(pool.token1);
  const precision0 = BigInt.fromI32(10).pow(<u8>token0.decimals.toI32());
  const precision1 = BigInt.fromI32(10).pow(<u8>token1.decimals.toI32());
  const ratePrecision = BigInt.fromI32(10).pow(18);
  const totalLiquidity = poolData.BORROWED_INVARIANT.plus(poolData.LP_INVARIANT);

  let dailyData = DailyPoolSnapshot.load(id);

  if (dailyData == null) {
    dailyData = new DailyPoolSnapshot(id);
    dailyData.pool = poolId;
    dailyData.timestamp = event.block.timestamp;
    dailyData.tickTimestamp = BigInt.fromI32(tickStartTimestamp);
    let prevAccFeeIndex = BigInt.fromI32(10).pow(18);
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
    // dailyData.utilizationRate = poolData.BORROWED_INVARIANT.times(ratePrecision).div(totalLiquidity);
    dailyData.accFeeIndex = poolData.accFeeIndex;
    dailyData.totalSupply = poolData.totalSupply;
    dailyData.supplyAPY = BigDecimal.fromString('0');
    dailyData.borrowAPR = BigDecimal.fromString('0');
    if (poolTracer != null && poolTracer.lastDailyData != null) {
      const accFeeGrowthDiff = poolData.accFeeIndex.times(ratePrecision).div(prevAccFeeIndex).minus(ratePrecision);
      const lastDailyData = DailyPoolSnapshot.load(poolTracer.lastDailyData!);
      if (lastDailyData) {
        // APY = Annaulized of ((totalLiquidity1 / totalLiquidity0) / (totalSupply1 / totalSupply0)) - 1
        dailyData.supplyAPY = totalLiquidity.divDecimal(lastDailyData.totalLiquidity.toBigDecimal())
          .div(dailyData.totalSupply.divDecimal(lastDailyData.totalSupply.toBigDecimal()))
          .minus(BigDecimal.fromString('1'))
          .times(BigInt.fromI32(YEAR_IN_SECONDS).toBigDecimal())
          .div(dailyData.timestamp.minus(lastDailyData.timestamp).toBigDecimal());

        // APR = Annualized of (accFeeIndex1 / accFeeIndex0) - 1
        dailyData.borrowAPR = accFeeGrowthDiff.times(BigInt.fromI32(YEAR_IN_SECONDS))
          .div(dailyData.timestamp.minus(lastDailyData.timestamp))
          .divDecimal(ratePrecision.toBigDecimal());
      }
    }
    dailyData.price0 = poolData.CFMM_RESERVES[0].times(precision1).div(poolData.CFMM_RESERVES[1]);
    dailyData.price1 = poolData.CFMM_RESERVES[1].times(precision0).div(poolData.CFMM_RESERVES[0]);
    dailyData.save();
  }

  // Pad missing daily data items
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
        missingItem.timestamp = lastDailyData.timestamp;
        missingItem.tickTimestamp = BigInt.fromI32(missingTickId * 86400);
        missingItem.utilizationRate = lastDailyData.utilizationRate;
        missingItem.borrowedLiquidity = lastDailyData.borrowedLiquidity;
        missingItem.borrowedLiquidityETH = lastDailyData.borrowedLiquidityETH;
        missingItem.borrowedLiquidityUSD = lastDailyData.borrowedLiquidityUSD;
        missingItem.totalLiquidity = lastDailyData.totalLiquidity;
        missingItem.totalLiquidityETH = lastDailyData.totalLiquidityETH;
        missingItem.totalLiquidityUSD = lastDailyData.totalLiquidityUSD;
        missingItem.borrowRate = lastDailyData.borrowRate;
        missingItem.accFeeIndex = lastDailyData.accFeeIndex;
        missingItem.price0 = lastDailyData.price0;
        missingItem.price1 = lastDailyData.price1;
        missingItem.totalSupply = lastDailyData.totalSupply;
        missingItem.supplyAPY = lastDailyData.supplyAPY;
        missingItem.borrowAPR = lastDailyData.borrowAPR;
        missingItem.save();
      }
    }
  }

  if (poolTracer != null && poolTracer.lastDailyData != dailyData.id) {
    poolTracer.lastDailyData = dailyData.id;
    poolTracer.save();
  }

  return dailyData;
}

export function loadOrCreateAbout(): About {
  const id = 'about';
  let instance = About.load(id);
  if (instance == null) {
    instance = new About(id);
    instance.version = VERSION;
    instance.network = NETWORK;
    instance.totalPools = BigInt.fromI32(0);
    instance.totalLoans = BigInt.fromI32(0);
    instance.totalActiveLoans = BigInt.fromI32(0);
    instance.totalTvlETH = BigDecimal.fromString('0');
    instance.totalTvlUSD = BigDecimal.fromString('0');
    instance.totalBorrowedETH = BigDecimal.fromString('0');
    instance.totalBorrowedUSD = BigDecimal.fromString('0');
    instance.totalLPBalanceUSD = BigDecimal.fromString('0');
    instance.totalLPBalanceETH = BigDecimal.fromString('0');
    instance.totalDSBalanceUSD = BigDecimal.fromString('0');
    instance.totalDSBalanceETH = BigDecimal.fromString('0');
    instance.totalGSBalanceUSD = BigDecimal.fromString('0');
    instance.totalGSBalanceETH = BigDecimal.fromString('0');
    instance.save();
  }

  return instance;
}