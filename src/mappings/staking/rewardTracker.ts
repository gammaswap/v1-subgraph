import { DepositTokenSet, Stake, Unstake, RewardsUpdate, UserRewardsUpdate, Claim } from '../../types/templates/RewardTracker/IRewardTracker'
import { BigInt } from "@graphprotocol/graph-ts";
import { loadStakedBalance } from "../../helpers/staking/loader";
import { updateStakedBalances } from "../../helpers/staking/utils";
import { PoolAndStakedBalance } from "../../types/schema";
import { ADDRESS_ZERO } from "../../helpers/constants";
import { loadOrCreateAccount } from "../../helpers/loader";

export function handleDepositTokenSet(event: DepositTokenSet): void {
  
}

export function handleStake(event: Stake): void {
    const rewardTrackerId = event.address.toHexString();
    const accountId = event.params._account.toHexString();

    const account = loadOrCreateAccount(accountId);

    let stakedBalance = loadStakedBalance(account.id, rewardTrackerId);
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

        if (accountId != ADDRESS_ZERO && stakedBalance.pool != null) {
            const poolAddress = stakedBalance.pool!;
            const id = poolAddress + '-' + accountId;
            let poolAndStakeBalanceTo = PoolAndStakedBalance.load(id);
            if (poolAndStakeBalanceTo == null) {
                poolAndStakeBalanceTo = new PoolAndStakedBalance(id);
                poolAndStakeBalanceTo.pool = poolAddress;
                poolAndStakeBalanceTo.account = accountId;
                poolAndStakeBalanceTo.balance = BigInt.fromI32(0);
                poolAndStakeBalanceTo.isRewardTracker = stakedBalance.isRewardTracker;
            }
            poolAndStakeBalanceTo.balance = poolAndStakeBalanceTo.balance.plus(amount);
            poolAndStakeBalanceTo.save();
        }
    }
}

export function handleUnstake(event: Unstake): void {
    const rewardTrackerId = event.address.toHexString();
    const accountId = event.params._account.toHexString();

    const account = loadOrCreateAccount(accountId);

    let stakedBalance = loadStakedBalance(account.id, rewardTrackerId);
    if(stakedBalance != null) {
        const amount = event.params._amount;
        const depositTokenAddress = event.params._depositToken.toHexString();
        stakedBalance.balance = stakedBalance.balance.minus(amount);
        updateStakedBalances(stakedBalance, amount, depositTokenAddress, false);
        stakedBalance.save();

        if(stakedBalance.pool != null) {
            const id = stakedBalance.pool! + '-' + accountId;
            let poolAndStakeBalanceFrom = PoolAndStakedBalance.load(id);
            if (poolAndStakeBalanceFrom) {
                poolAndStakeBalanceFrom.balance = poolAndStakeBalanceFrom.balance.minus(amount);
                poolAndStakeBalanceFrom.save();
            }
        }
    }
}

export function handleRewardsUpdate(event: RewardsUpdate): void {

}

export function handleUserRewardsUpdate(event: UserRewardsUpdate): void {

}

export function handleClaim(event: Claim): void {

}