import { Address, BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { RewardTracker, RewardDistributor, StakedBalance, EscrowToken } from '../../types/schema';
import { ERC20 } from "../../types/StakingRouter/ERC20";

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

export function createEscrowToken(poolAddress: string, escrowTokenAddress: string, claimableTokenAddress: string): void {
  const id = poolAddress + '-' + escrowTokenAddress;
  let escrowToken = EscrowToken.load(id);
  if(escrowToken == null) {
    const escrowToken = new EscrowToken(id);
    escrowToken.pool = poolAddress;
    escrowToken.address = Address.fromString(escrowTokenAddress);
    escrowToken.claimableToken = claimableTokenAddress;

    const esTokenContract = ERC20.bind(escrowToken.address);

    escrowToken.name = esTokenContract.name().trim();
    escrowToken.symbol = esTokenContract.symbol().trim();
    escrowToken.decimals = BigInt.fromString(esTokenContract.decimals().toString());

    escrowToken.save();
  }
}

export function loadStakedBalance(accountId: string, rewardTrackerId: string): StakedBalance | null {
  const id = rewardTrackerId + '-' + accountId;
  let stakedBalance = StakedBalance.load(id);
  if(stakedBalance == null) {
    const rewardTracker = RewardTracker.load(rewardTrackerId);
    if(rewardTracker != null) {
      stakedBalance = new StakedBalance(id);
      stakedBalance.rewardTracker = rewardTrackerId;
      stakedBalance.account = accountId;
      stakedBalance.pool = rewardTracker.gsPool;
      stakedBalance.balance = BigInt.fromI32(0);
      stakedBalance.isRewardTracker = RewardTracker.load(accountId) != null;

      const depositTokens = rewardTracker.depositTokens;
      if(depositTokens != null) {
        let _depositTokens: Bytes[] = [];
        for (let i = 0; i < depositTokens.length; i ++) {
          _depositTokens = _depositTokens.concat([depositTokens[i]]);
        }
        stakedBalance.depositTokens = _depositTokens;

        let depositBalances: BigInt[] = [];
        for(let i = 0; i < depositTokens.length; i++) {
          depositBalances = depositBalances.concat([BigInt.fromI32(0)]);
        }
        stakedBalance.depositBalances = depositBalances;
      }
      stakedBalance.depositBalanceETH = BigDecimal.fromString('0');
      stakedBalance.depositBalanceUSD = BigDecimal.fromString('0');
      stakedBalance.initialBlock = BigInt.fromI32(0);
      stakedBalance.initialTimestamp = BigInt.fromI32(0);
    }
  }
  return stakedBalance;
}