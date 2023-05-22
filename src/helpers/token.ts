// import { Address } from '@graphprotocol/graph-ts';
// import { } from '../types/templates/GammaPool/Pool/'

// class TokenInfo {
//   constructor(readonly name: string | null, readonly symbol: string | null, readonly decimals: number) {}
// }

// export function getTokenInfo(address: Address): TokenInfo {
//   let erc20 = ERC20.bind(address)

//   let name = erc20.try_name()
//   let symbol = erc20.try_symbol()
//   let decimals = erc20.try_decimals()

//   return new TokenInfo(
//     name.reverted ? '' : name.value.toString(),
//     symbol.reverted ? '' : symbol.value.toString(),
//     decimals.reverted ? 18 : decimals.value,
//   )
// }