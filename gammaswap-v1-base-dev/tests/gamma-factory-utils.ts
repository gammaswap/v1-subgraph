import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  FeeUpdate,
  OwnershipTransferStarted,
  OwnershipTransferred,
  PoolCreated,
  PoolParamsUpdate,
  RateParamsUpdate
} from "../generated/GammaFactory/GammaFactory"

export function createFeeUpdateEvent(
  pool: Address,
  to: Address,
  protocolFee: i32,
  origFeeShare: i32,
  isSet: boolean
): FeeUpdate {
  let feeUpdateEvent = changetype<FeeUpdate>(newMockEvent())

  feeUpdateEvent.parameters = new Array()

  feeUpdateEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  feeUpdateEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  feeUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "protocolFee",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(protocolFee))
    )
  )
  feeUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "origFeeShare",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(origFeeShare))
    )
  )
  feeUpdateEvent.parameters.push(
    new ethereum.EventParam("isSet", ethereum.Value.fromBoolean(isSet))
  )

  return feeUpdateEvent
}

export function createOwnershipTransferStartedEvent(
  currentOwner: Address,
  newOwner: Address
): OwnershipTransferStarted {
  let ownershipTransferStartedEvent = changetype<OwnershipTransferStarted>(
    newMockEvent()
  )

  ownershipTransferStartedEvent.parameters = new Array()

  ownershipTransferStartedEvent.parameters.push(
    new ethereum.EventParam(
      "currentOwner",
      ethereum.Value.fromAddress(currentOwner)
    )
  )
  ownershipTransferStartedEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferStartedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent = changetype<OwnershipTransferred>(
    newMockEvent()
  )

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createPoolCreatedEvent(
  pool: Address,
  cfmm: Address,
  protocolId: i32,
  implementation: Address,
  tokens: Array<Address>,
  count: BigInt
): PoolCreated {
  let poolCreatedEvent = changetype<PoolCreated>(newMockEvent())

  poolCreatedEvent.parameters = new Array()

  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("cfmm", ethereum.Value.fromAddress(cfmm))
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "protocolId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(protocolId))
    )
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "implementation",
      ethereum.Value.fromAddress(implementation)
    )
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("tokens", ethereum.Value.fromAddressArray(tokens))
  )
  poolCreatedEvent.parameters.push(
    new ethereum.EventParam("count", ethereum.Value.fromUnsignedBigInt(count))
  )

  return poolCreatedEvent
}

export function createPoolParamsUpdateEvent(
  pool: Address,
  origFee: i32,
  extSwapFee: i32,
  emaMultiplier: i32,
  minUtilRate1: i32,
  minUtilRate2: i32,
  feeDivisor: i32,
  liquidationFee: i32,
  ltvThreshold: i32,
  minBorrow: BigInt
): PoolParamsUpdate {
  let poolParamsUpdateEvent = changetype<PoolParamsUpdate>(newMockEvent())

  poolParamsUpdateEvent.parameters = new Array()

  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "origFee",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(origFee))
    )
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "extSwapFee",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(extSwapFee))
    )
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "emaMultiplier",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(emaMultiplier))
    )
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "minUtilRate1",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(minUtilRate1))
    )
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "minUtilRate2",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(minUtilRate2))
    )
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "feeDivisor",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(feeDivisor))
    )
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "liquidationFee",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(liquidationFee))
    )
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "ltvThreshold",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(ltvThreshold))
    )
  )
  poolParamsUpdateEvent.parameters.push(
    new ethereum.EventParam(
      "minBorrow",
      ethereum.Value.fromUnsignedBigInt(minBorrow)
    )
  )

  return poolParamsUpdateEvent
}

export function createRateParamsUpdateEvent(
  pool: Address,
  data: Bytes,
  active: boolean
): RateParamsUpdate {
  let rateParamsUpdateEvent = changetype<RateParamsUpdate>(newMockEvent())

  rateParamsUpdateEvent.parameters = new Array()

  rateParamsUpdateEvent.parameters.push(
    new ethereum.EventParam("pool", ethereum.Value.fromAddress(pool))
  )
  rateParamsUpdateEvent.parameters.push(
    new ethereum.EventParam("data", ethereum.Value.fromBytes(data))
  )
  rateParamsUpdateEvent.parameters.push(
    new ethereum.EventParam("active", ethereum.Value.fromBoolean(active))
  )

  return rateParamsUpdateEvent
}
