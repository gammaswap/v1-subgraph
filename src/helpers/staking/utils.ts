import { GammaPool, StakedBalance, Token } from "../../types/schema";
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ADDRESS_ZERO, ES_GS, GS } from "../constants";

export function updateStakedBalances(stakedBalance: StakedBalance, amount: BigInt, depositTokenAddress: string, isDeposit: boolean): void {
    const depositTokens = stakedBalance.depositTokens;
    const depositBalances = stakedBalance.depositBalances;
    if(depositTokens != null && depositBalances != null && depositTokens.length == depositBalances.length) {
        let _depositBalances: BigInt[] = [];
        let poolDepositBalance = BigInt.fromI32(0);
        let totalDepositBalance = BigInt.fromI32(0);
        for(let i = 0; i < depositTokens.length; i++) {
            if(depositTokens[i].toHexString().toLowerCase() == depositTokenAddress) {
                if(isDeposit) {
                    poolDepositBalance = depositBalances[i].plus(amount);
                } else {
                    poolDepositBalance = depositBalances[i].minus(amount);
                }
                totalDepositBalance = totalDepositBalance.plus(poolDepositBalance);
                _depositBalances = _depositBalances.concat([poolDepositBalance]);
            } else {
                totalDepositBalance = totalDepositBalance.plus(depositBalances[i]);
                _depositBalances = _depositBalances.concat([depositBalances[i]]);
            }
        }
        stakedBalance.depositBalances = _depositBalances;

        if(stakedBalance.pool != null) {
            const pool = GammaPool.load(stakedBalance.pool!);
            if(pool != null) {
                if (pool.totalSupply == BigInt.fromI32(0)) {
                    stakedBalance.depositBalanceETH = BigDecimal.fromString('0');
                    stakedBalance.depositBalanceUSD = BigDecimal.fromString('0');
                } else {
                    const ONE = BigInt.fromI32(10).pow(18).toBigDecimal();

                    const lpBalanceETHBN = BigInt.fromString(pool.lpBalanceETH.times(ONE).truncate(0).toString());
                    const lpBorrowedBalanceETHBN = BigInt.fromString(pool.lpBorrowedBalanceETH.times(ONE).truncate(0).toString());
                    const depositBalanceETHBN = lpBalanceETHBN.plus(lpBorrowedBalanceETHBN).times(totalDepositBalance).div(pool.totalSupply);

                    const lpBalanceUSDBN = BigInt.fromString(pool.lpBalanceUSD.times(ONE).truncate(0).toString());
                    const lpBorrowedBalanceUSDBN = BigInt.fromString(pool.lpBorrowedBalanceUSD.times(ONE).truncate(0).toString());
                    const depositBalanceUSDBN = lpBalanceUSDBN.plus(lpBorrowedBalanceUSDBN).times(totalDepositBalance).div(pool.totalSupply);

                    stakedBalance.depositBalanceETH = depositBalanceETHBN.divDecimal(ONE).truncate(18);
                    stakedBalance.depositBalanceUSD = depositBalanceUSDBN.divDecimal(ONE).truncate(6);
                }
            }
        } else if(depositTokenAddress != ADDRESS_ZERO && (depositTokenAddress == GS || depositTokenAddress == ES_GS)) {
            const gsToken = Token.load(GS);
            if(gsToken != null) {
                const precisionBN = BigInt.fromI32(10).pow(<u8>gsToken.decimals.toI32());
                const ONE = BigInt.fromI32(10).pow(18).toBigDecimal();

                const priceETHBN = BigInt.fromString(gsToken.priceETH.times(ONE).truncate(0).toString());
                const priceUSDBN = BigInt.fromString(gsToken.priceUSD.times(ONE).truncate(0).toString());

                const depositBalanceETHBN = totalDepositBalance.times(priceETHBN).div(precisionBN);
                const depositBalanceUSDBN = totalDepositBalance.times(priceUSDBN).div(precisionBN);
                stakedBalance.depositBalanceETH = depositBalanceETHBN.divDecimal(ONE);
                stakedBalance.depositBalanceUSD = depositBalanceUSDBN.divDecimal(ONE);
            }
        }
    }
}