import { StatusChange } from '../../types/templates/RewardDistributor/RewardDistributor';
import { GammaPool, RewardTracker } from '../../types/schema';

export function handleDistribute(): void {
  
}

export function handleEmissionChange(): void {

}

export function handleMultiplierChange(): void {

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