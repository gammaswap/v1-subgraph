import { LoanCreated, LoanUpdated, PoolUpdated } from '../../generated/GammaPoolFactory/GammaPool'
import { PoolData as PoolDataSchema, Loan as LoanSchema, LoanData as LoanDataSchema, User as UserSchema } from '../../generated/schema'
import { GammaPool } from '../../generated/templates/GammaPool/GammaPool'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export function handlePoolUpdated(event: PoolUpdated): void {
  let poolData = new PoolDataSchema(event.transaction.hash.toHex())

  let gammaPool = GammaPool.bind(event.address)
  let tokenBalances = gammaPool.tokenBalances()
  let borrowRate = gammaPool.borrowRate()

  poolData.address = event.address // the gammaPool contract address
  poolData.tokenBalances = [tokenBalances[0].toBigDecimal(), tokenBalances[1].toBigDecimal()] // TODO
  poolData.lpTokenBalance = BigDecimal.fromString(event.params.lpTokenBalance.toString())
  poolData.lpTokenBorrowed = BigDecimal.fromString(event.params.lpTokenBalance.toString())
  poolData.lpTokenBorrowedPlusInterest = BigDecimal.fromString(event.params.lpTokenBorrowedPlusInterest.toString())
  poolData.lpTokenTotal = poolData.lpTokenBalance.plus(poolData.lpTokenBorrowedPlusInterest)
  poolData.lpInvariant = BigDecimal.fromString(event.params.lpInvariant.toString())
  poolData.lpBorrowedInvariant = BigDecimal.fromString(event.params.lpBorrowedInvariant.toString())
  poolData.borrowRate = borrowRate.toBigDecimal()
  poolData.accFeeIndex = BigDecimal.fromString(event.params.accFeeIndex.toString())
  poolData.lastFeeIndex = BigDecimal.fromString(event.params.lastFeeIndex.toString())
  poolData.lastBlockNumber = event.params.lastBlockNumber

  poolData.save()
}

export function handleLoanCreated(event: LoanCreated): void {
  let loan = new LoanSchema(event.params.tokenId.toHexString())

  // Update/Create user
  let user = UserSchema.load(event.params.caller.toString())

  if (!user) {
    user = new UserSchema(event.params.caller.toString())
  }

  user.loans.push(event.params.tokenId)

  // Initialize Loan
  let initNumber: BigInt = new BigInt(0)
  loan.poolId = event.address
  loan.tokensHeld = [initNumber]
  loan.heldLiquidity = initNumber
  loan.liquidity = initNumber
  loan.lpTokens = initNumber
  loan.rateIndex = initNumber
  loan.blockNumber = event.block.number
  user.save()
  loan.save()
}

export function handleLoanUpdated(event: LoanUpdated): void {
  let loan = LoanSchema.load(event.params.tokenId.toHexString())
  if (loan) {
    loan.tokensHeld = event.params.tokensHeld
    loan.heldLiquidity = event.params.heldLiquidity
    loan.liquidity = event.params.liquidity
    loan.lpTokens = event.params.lpTokens
    loan.rateIndex = event.params.rateIndex
    loan.save()
  }

  let updatedLoan = new LoanDataSchema(event.transaction.hash.toHexString())
  updatedLoan.poolId = event.address
  updatedLoan.tokensHeld = event.params.tokensHeld
  updatedLoan.heldLiquidity = event.params.heldLiquidity
  updatedLoan.liquidity = event.params.liquidity
  updatedLoan.lpTokens = event.params.lpTokens
  updatedLoan.rateIndex = event.params.rateIndex
  updatedLoan.blockNumber = event.block.number
  updatedLoan.save()
}
