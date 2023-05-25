import { BigInt, BigDecimal } from '@graphprotocol/graph-ts';

export function convertToBigDecimal(value: BigInt, decimals: number = 18): BigDecimal {
  const precision = BigInt.fromI32(10).pow(<u8>decimals).toBigDecimal();

  return value.divDecimal(precision);
}