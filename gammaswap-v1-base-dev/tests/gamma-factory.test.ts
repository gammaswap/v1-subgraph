import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { FeeUpdate } from "../generated/schema"
import { FeeUpdate as FeeUpdateEvent } from "../generated/GammaFactory/GammaFactory"
import { handleFeeUpdate } from "../src/gamma-factory"
import { createFeeUpdateEvent } from "./gamma-factory-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let pool = Address.fromString("0x0000000000000000000000000000000000000001")
    let to = Address.fromString("0x0000000000000000000000000000000000000001")
    let protocolFee = 123
    let origFeeShare = 123
    let isSet = "boolean Not implemented"
    let newFeeUpdateEvent = createFeeUpdateEvent(
      pool,
      to,
      protocolFee,
      origFeeShare,
      isSet
    )
    handleFeeUpdate(newFeeUpdateEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("FeeUpdate created and stored", () => {
    assert.entityCount("FeeUpdate", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "FeeUpdate",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "pool",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "FeeUpdate",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "to",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "FeeUpdate",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "protocolFee",
      "123"
    )
    assert.fieldEquals(
      "FeeUpdate",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "origFeeShare",
      "123"
    )
    assert.fieldEquals(
      "FeeUpdate",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "isSet",
      "boolean Not implemented"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
