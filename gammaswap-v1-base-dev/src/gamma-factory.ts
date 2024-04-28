import {
  FeeUpdate as FeeUpdateEvent,
  OwnershipTransferStarted as OwnershipTransferStartedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PoolCreated as PoolCreatedEvent,
  PoolParamsUpdate as PoolParamsUpdateEvent,
  RateParamsUpdate as RateParamsUpdateEvent
} from "../generated/GammaFactory/GammaFactory"
import {
  FeeUpdate,
  OwnershipTransferStarted,
  OwnershipTransferred,
  PoolCreated,
  PoolParamsUpdate,
  RateParamsUpdate
} from "../generated/schema"

export function handleFeeUpdate(event: FeeUpdateEvent): void {
  let entity = new FeeUpdate(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pool = event.params.pool
  entity.to = event.params.to
  entity.protocolFee = event.params.protocolFee
  entity.origFeeShare = event.params.origFeeShare
  entity.isSet = event.params.isSet

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferStarted(
  event: OwnershipTransferStartedEvent
): void {
  let entity = new OwnershipTransferStarted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.currentOwner = event.params.currentOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePoolCreated(event: PoolCreatedEvent): void {
  let entity = new PoolCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pool = event.params.pool
  entity.cfmm = event.params.cfmm
  entity.protocolId = event.params.protocolId
  entity.implementation = event.params.implementation
  entity.tokens = event.params.tokens
  entity.count = event.params.count

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePoolParamsUpdate(event: PoolParamsUpdateEvent): void {
  let entity = new PoolParamsUpdate(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pool = event.params.pool
  entity.origFee = event.params.origFee
  entity.extSwapFee = event.params.extSwapFee
  entity.emaMultiplier = event.params.emaMultiplier
  entity.minUtilRate1 = event.params.minUtilRate1
  entity.minUtilRate2 = event.params.minUtilRate2
  entity.feeDivisor = event.params.feeDivisor
  entity.liquidationFee = event.params.liquidationFee
  entity.ltvThreshold = event.params.ltvThreshold
  entity.minBorrow = event.params.minBorrow

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRateParamsUpdate(event: RateParamsUpdateEvent): void {
  let entity = new RateParamsUpdate(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pool = event.params.pool
  entity.data = event.params.data
  entity.active = event.params.active

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
