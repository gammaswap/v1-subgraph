import { DepositTokenSet, Stake, Unstake, RewardsUpdate, UserRewardsUpdate, Claim } from '../../types/templates/RewardTracker/RewardTracker'
import { BigInt } from "@graphprotocol/graph-ts";
import { loadStakedBalance } from "../../helpers/staking/loader";
import { updateStakedBalances } from "../../helpers/staking/utils";

export function handleDepositTokenSet(event: DepositTokenSet): void {
  
}

export function handleStake(event: Stake): void {
    const rewardTrackerId = event.address.toHexString();
    const accountId = event.params._account.toHexString();
    let stakedBalance = loadStakedBalance(accountId, rewardTrackerId);
    if(stakedBalance != null) {
        const amount = event.params._amount;
        const depositTokenAddress = event.params._depositToken.toHexString();
        if(stakedBalance.initialBlock == BigInt.zero()) {
            stakedBalance.initialBlock = event.block.number;
            stakedBalance.initialTimestamp = event.block.timestamp;
        }
        stakedBalance.balance = stakedBalance.balance.plus(amount);
        updateStakedBalances(stakedBalance, amount, depositTokenAddress, true);
        stakedBalance.save();
    }
}

export function handleUnstake(event: Unstake): void {
    const rewardTrackerId = event.address.toHexString();
    const accountId = event.params._account.toHexString();
    let stakedBalance = loadStakedBalance(accountId, rewardTrackerId);
    if(stakedBalance != null) {
        const amount = event.params._amount;
        const depositTokenAddress = event.params._depositToken.toHexString();
        stakedBalance.balance = stakedBalance.balance.minus(amount);
        updateStakedBalances(stakedBalance, amount, depositTokenAddress, false);
        stakedBalance.save();
    }
}

export function handleRewardsUpdate(event: RewardsUpdate): void {

}

export function handleUserRewardsUpdate(event: UserRewardsUpdate): void {

}

export function handleClaim(event: Claim): void {

}