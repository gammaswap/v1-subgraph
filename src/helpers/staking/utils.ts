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
                    stakedBalance.depositBalanceETH = pool.lpBalanceETH.plus(pool.lpBorrowedBalanceETH).times(totalDepositBalance.toBigDecimal()).div(pool.totalSupply.toBigDecimal());
                    stakedBalance.depositBalanceUSD = pool.lpBalanceUSD.plus(pool.lpBorrowedBalanceUSD).times(totalDepositBalance.toBigDecimal()).div(pool.totalSupply.toBigDecimal());
                }
            }
        } else if(depositTokenAddress != ADDRESS_ZERO && (depositTokenAddress == GS || depositTokenAddress == ES_GS)) {
            const gsToken = Token.load(GS);
            if(gsToken != null) {
                const precision = BigInt.fromI32(10).pow(<u8>gsToken.decimals.toI32());
                stakedBalance.depositBalanceETH = totalDepositBalance.toBigDecimal().times(gsToken.priceETH).div(precision.toBigDecimal());
                stakedBalance.depositBalanceUSD = totalDepositBalance.toBigDecimal().times(gsToken.priceUSD).div(precision.toBigDecimal());
            }
        }
    }
}