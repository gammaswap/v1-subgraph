import { log, Address } from '@graphprotocol/graph-ts';
import {
  RewardTracker as RewardTrackerDataSource,
  RewardDistributor as RewardDistributorDataSource
} from '../../types/templates';
import { RewardTracker } from '../../types/templates/RewardTracker/RewardTracker';
import { RewardDistributor } from '../../types/templates/RewardDistributor/RewardDistributor';
import {
  CoreTrackerCreated,
  CoreTrackerUpdated,
  PoolTrackerCreated,
  PoolTrackerUpdated,
  StakedGs,
  StakedLp,
  UnstakedGs,
  UnstakedLp
} from '../../types/StakingRouter/IStakingRouter';
import { createRewardTracker, createRewardDistributor } from '../../helpers/staking/loader';
import { WETH, GS, ES_GS, BN_GS } from '../../helpers/constants';
import { GammaPool } from '../../types/schema';

export function handleCoreTrackerCreate(event: CoreTrackerCreated): void {
  createRewardDistributor(event.params.rewardDistributor, ES_GS);
  createRewardTracker('', event.params.rewardTracker, event.params.rewardDistributor, [GS, ES_GS]);
  createRewardDistributor(event.params.feeDistributor, WETH);
  createRewardTracker('', event.params.feeTracker, event.params.feeDistributor, [event.params.bonusTracker.toHexString(), BN_GS]);

  RewardTrackerDataSource.create(event.params.rewardTracker);
  RewardTrackerDataSource.create(event.params.feeTracker);
  // RewardTrackerDataSource.create(event.params.bonusTracker);
  RewardDistributorDataSource.create(event.params.rewardDistributor);
  // RewardDistributorDataSource.create(event.params.bonusDistributor);
  RewardDistributorDataSource.create(event.params.feeDistributor);
}

export function handleCoreTrackerUpdate(event: CoreTrackerUpdated): void {

}

export function handlePoolTrackerCreate(event: PoolTrackerCreated): void {
  const poolAddress = event.params.gsPool.toHexString();
  const pool = GammaPool.load(poolAddress);
  if (pool == null) {
    log.error("POOL NOT AVAILABLE: {}", [poolAddress]);
    return;
  }
  pool.hasStakingTrackers = true;
  pool.activeStaking = true;
  pool.save();

  createRewardDistributor(event.params.rewardDistributor, ES_GS);
  createRewardTracker(poolAddress, event.params.rewardTracker, event.params.rewardDistributor, [poolAddress]);
}

export function handlePoolTrackerUpdate(event: PoolTrackerUpdated): void {

}

export function handleGsStake(event: StakedGs): void {

}

export function handleLpStake(event: StakedLp): void {

}

export function handleGsUnstake(event: UnstakedGs): void {

}

export function handleLpUnstake(event: UnstakedLp): void {

}