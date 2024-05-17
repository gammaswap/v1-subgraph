import { log } from '@graphprotocol/graph-ts';
import {
  RewardTracker as RewardTrackerDataSource,
  RewardDistributor as RewardDistributorDataSource
} from '../../types/templates';
import { IRewardDistributor } from '../../types/templates/RewardDistributor/IRewardDistributor';
import { IVester } from '../../types/StakingRouter/IVester';
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
import { createRewardTracker, createRewardDistributor, createEscrowToken } from '../../helpers/staking/loader';
import { WETH, GS, ES_GS, BN_GS } from '../../helpers/constants';
import { GammaPool } from '../../types/schema';

export function handleCoreTrackerCreate(event: CoreTrackerCreated): void {
  RewardTrackerDataSource.create(event.params.rewardTracker);
  RewardTrackerDataSource.create(event.params.bonusTracker);
  RewardTrackerDataSource.create(event.params.feeTracker);
  RewardDistributorDataSource.create(event.params.rewardDistributor);
  RewardDistributorDataSource.create(event.params.bonusDistributor);
  RewardDistributorDataSource.create(event.params.feeDistributor);

  createRewardDistributor(event.params.rewardDistributor, ES_GS, false);
  createRewardTracker('', event.params.rewardTracker, event.params.rewardDistributor, [GS, ES_GS], false);
  createRewardDistributor(event.params.bonusDistributor, BN_GS, true);
  createRewardTracker('', event.params.bonusTracker, event.params.bonusDistributor, [event.params.rewardTracker.toHexString()], false);
  createRewardDistributor(event.params.feeDistributor, WETH, false);
  createRewardTracker('', event.params.feeTracker, event.params.feeDistributor, [event.params.bonusTracker.toHexString(), BN_GS], true);
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
  pool.save();

  RewardTrackerDataSource.create(event.params.rewardTracker);
  RewardDistributorDataSource.create(event.params.rewardDistributor);

  const distributorContract = IRewardDistributor.bind(event.params.rewardDistributor);
  const rewardTokenAddress = distributorContract.rewardToken().toHexString();
  const vesterContract = IVester.bind(event.params.vester);
  const claimableTokenAddress = vesterContract.claimableToken().toHexString();
  createEscrowToken(pool.id, rewardTokenAddress, claimableTokenAddress);
  createRewardDistributor(event.params.rewardDistributor, rewardTokenAddress, false);
  createRewardTracker(poolAddress, event.params.rewardTracker, event.params.rewardDistributor, [poolAddress], false);
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