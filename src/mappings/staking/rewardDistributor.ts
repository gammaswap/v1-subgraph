import { BonusMultiplierChange, Distribute, StatusChange, TokensPerIntervalChange } from '../../types/templates/RewardDistributor/RewardDistributor';
import { GammaPool, RewardTracker } from '../../types/schema';

export function handleDistribute(event: Distribute): void {
  
}

export function handleEmissionChange(event: TokensPerIntervalChange): void {

}

export function handleMultiplierChange(event: BonusMultiplierChange): void {

}

export function handleStatusChange(event: StatusChange): void {
  const rewardTracker = RewardTracker.load(event.params.rewardTracker.toHexString());
  if (rewardTracker == null || rewardTracker.gsPool == null) return;

  const pool = GammaPool.load(rewardTracker.gsPool!);
  if (pool != null) {
    pool.activeStaking = !event.params.paused;
    pool.save();
  }
}