import { BigInt, log } from '@graphprotocol/graph-ts';
import { OverBalance } from '../types/schema';
import { Transfer } from '../types/WethBalance/Token';

const whitelistedAddresses = [
  '0x0000000000000000000000000000000000000000', // mint
  '0x3e195dab0ad42452e7df7897248a9a8a179c517f', // UniV2 ETH_USDC
  '0xde29d5748d7c55c5c0ad58b03062b28a59ecc66e', // UniV2 ARB_ETH
  '0xf1941d19cf8ff3028eb7235fca7b80b2186d8f7b', // UniV2 DPX_ETH
  '0x16b3b007eadd16a27a5047ff75027834ee34b98c', // UniV2 JONES_ETH
  '0x88a58f96ab69797662b51da1975d40007831b2d1', // GammaPool WETH/USDC
  '0x823beef029cd4adaca473e0d5903f26f3d2ff78c', // GammaPool ARB/WETH
  '0xb93d8c46760ba1286df27f922f0649f1c041487c', // GammaPool DPX/WETH
  '0x536ac895a00b6e44c8b57bdc00ee60a5a036def1', // GammaPool JONES/WETH
]

const tokenAddresses = [
  '0xb58fdbb99981e33fa0788eeffcb32f66fb6d088d', // WETH
  '0x52a07d9f773b7bffbc5e9aab13eeed4629ed31f3', // USDC
  '0xc0559132cd7c7503bc393ca9f5e2140f9732f9d6', // ARB
  '0xfa2f8e6b5cbff47b0f8f9d14c7f23b1c2189dff4', // DPX
  '0x302c1258b376660dff4eacb81d619d3a9b593988'  // JONES
]

export function handleTransfer(event: Transfer): void {
  const tokenContractAddress = event.address.toHexString().toLowerCase();
  const sender = event.params.from.toHexString().toLowerCase();
  const receiver = event.params.to.toHexString().toLowerCase();
  
  if (whitelistedAddresses.includes(sender) || whitelistedAddresses.includes(receiver)) return;
  
  let overBalance = OverBalance.load(receiver);

  if (!overBalance) {
    overBalance = new OverBalance(receiver);
    overBalance.wethBalance = BigInt.fromI32(0);
    overBalance.usdcBalance = BigInt.fromI32(0);
    overBalance.arbBalance = BigInt.fromI32(0);
    overBalance.dpxBalance = BigInt.fromI32(0);
    overBalance.jonesBalance = BigInt.fromI32(0);
  }

  if (tokenContractAddress == tokenAddresses[0]) {
    overBalance.wethBalance = overBalance.wethBalance.plus(event.params.value);
  } else if (tokenContractAddress == tokenAddresses[1]) {
    overBalance.usdcBalance = overBalance.usdcBalance.plus(event.params.value);
  } else if (tokenContractAddress == tokenAddresses[2]) {
    overBalance.arbBalance = overBalance.arbBalance.plus(event.params.value);
  } else if (tokenContractAddress == tokenAddresses[3]) {
    overBalance.dpxBalance = overBalance.dpxBalance.plus(event.params.value);
  } else if (tokenContractAddress == tokenAddresses[4]) {
    overBalance.jonesBalance = overBalance.jonesBalance.plus(event.params.value);
  }

  overBalance.save();
}