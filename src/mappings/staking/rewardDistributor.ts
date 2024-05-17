import { log } from '@graphprotocol/graph-ts';
import { BonusMultiplierChange, Distribute, StatusChange, TokensPerIntervalChange } from '../../types/templates/RewardDistributor/IRewardDistributor';
import { GammaPool, RewardDistributor, RewardTracker } from '../../types/schema';

export function handleDistribute(event: Distribute): void {
  
}

export function handleEmissionChange(event: TokensPerIntervalChange): void {

}

export function handleMultiplierChange(event: BonusMultiplierChange): void {

}

export function handleStatusChange(event: StatusChange): void {
  const rewardDistributor = RewardDistributor.load(event.address.toHexString());
  const rewardTracker = RewardTracker.load(event.params.rewardTracker.toHexString());

  if (rewardDistributor == null || rewardTracker == null) return;

  rewardDistributor.paused = event.params.paused;
  rewardDistributor.save();

  if (rewardTracker.gsPool != null) {
    const pool = GammaPool.load(rewardTracker.gsPool!);
    
    if (pool != null) {
      pool.activeStaking = !event.params.paused;
      pool.save();
    }
  }
}