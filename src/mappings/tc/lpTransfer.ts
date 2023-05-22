import { BigInt } from '@graphprotocol/graph-ts';
import { LpTransfer } from '../../types/tc/schema';
import { Transfer } from '../../types/tc/WethBalance/Token';

const whitelistedAddresses = [
  '0x0000000000000000000000000000000000000000', // mint
]

const tokenAddresses = [
  '0x823beef029cd4adaca473e0d5903f26f3d2ff78c', // WETH_ARB
  '0x536ac895a00b6e44c8b57bdc00ee60a5a036def1', // JONES_WETH
  '0xb93d8c46760ba1286df27f922f0649f1c041487c', // WETH_DPX
  '0x88a58f96ab69797662b51da1975d40007831b2d1'  // USDC_WETH
]

export function handleTransfer(event: Transfer): void {
  const tokenContractAddress = event.address.toHexString();
  const sender = event.params.from.toHexString();
  const receiver = event.params.to.toHexString();
  
  if (whitelistedAddresses.includes(sender)) {
    let lpTransfer = LpTransfer.load(receiver);
  
    if (!lpTransfer) {
      lpTransfer = new LpTransfer(receiver);
      lpTransfer.wetharb = BigInt.fromI32(0);
      lpTransfer.jonesweth = BigInt.fromI32(0);
      lpTransfer.wethdpx = BigInt.fromI32(0);
      lpTransfer.usdcweth = BigInt.fromI32(0);
    }
  
    if (tokenContractAddress == tokenAddresses[0]) {
      lpTransfer.wetharb = lpTransfer.wetharb.plus(event.params.value);
    } else if (tokenContractAddress == tokenAddresses[1]) {
      lpTransfer.jonesweth = lpTransfer.jonesweth.plus(event.params.value);
    } else if (tokenContractAddress == tokenAddresses[2]) {
      lpTransfer.wethdpx = lpTransfer.wethdpx.plus(event.params.value);
    } else if (tokenContractAddress == tokenAddresses[3]) {
      lpTransfer.usdcweth = lpTransfer.usdcweth.plus(event.params.value);
    }
  
    lpTransfer.save();
  }
  
}