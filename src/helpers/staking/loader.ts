import { Address, BigDecimal, BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import { RewardTracker, RewardDistributor } from '../../types/schema';

export function createRewardTracker(gsPool: string, tracker: Address, distributor: Address, depositTokens: string[], isFeeTracker: boolean): RewardTracker {
  const rewardTracker = new RewardTracker(tracker.toHexString());
  rewardTracker.isFeeTracker = isFeeTracker;
  if (gsPool != '') {
    rewardTracker.gsPool = gsPool;
  }

  let _depositTokens: Bytes[] = [];
  for (let i = 0; i < depositTokens.length; i ++) {
    const t = Address.fromHexString(depositTokens[i]);
    _depositTokens = _depositTokens.concat([t]);
  }
  rewardTracker.depositTokens = _depositTokens;
  rewardTracker.totalSupply = BigInt.fromI32(0);
  rewardTracker.distributor = distributor.toHexString();
  rewardTracker.cumulativeRewardPerToken = BigInt.fromI32(0);

  rewardTracker.save();
  return rewardTracker;
}

export function createRewardDistributor(distributor: Address, rewardTokenAddress: string, isBonusDistributor: boolean): RewardDistributor {
  const rewardDistributor = new RewardDistributor(distributor.toHexString());
  rewardDistributor.isBonusDistributor = isBonusDistributor;
  rewardDistributor.rewardToken = Address.fromHexString(rewardTokenAddress);
  rewardDistributor.tokensPerInterval = BigInt.fromI32(0);
  rewardDistributor.lastDistributionTime = BigInt.fromI32(0);
  rewardDistributor.paused = true;

  rewardDistributor.save();
  return rewardDistributor;
}