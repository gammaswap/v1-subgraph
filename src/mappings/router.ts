import { BigInt, log } from '@graphprotocol/graph-ts';
import { TrackPair } from '../types/UniversalRouter/UniversalRouter';
import { createPairFromRouter } from '../helpers/loader';
import { log } from "@graphprotocol/graph-ts";
import {
    AERO_FACTORY,
    AEROCL_FACTORY,
    SUSHISWAP_FACTORY,
    UNISWAPV2_FACTORY, UNISWAPV3_FACTORY
} from "../helpers/constants";
import { AeroPool } from "../types/templates/AeroPool/AeroPool";

export function handleTrackPair(event: TrackPair): void {
    const pair = event.params.pair;
    const token0 = event.params.token0.toHexString();
    const token1 = event.params.token1.toHexString();
    const pairId = pair.toHexString();
    const factory = event.params.factory.toHexString();
    const fee = BigInt.fromI32(event.params.fee);
    let protocol = "0"
    if(factory == UNISWAPV2_FACTORY) {
        protocol = "1";
    } else if(factory == SUSHISWAP_FACTORY) {
        protocol = "2";
    } else if(factory == AERO_FACTORY) {
        const pairContract = AeroPool.bind(pair);
        const stableResult = pairContract.try_stable();
        if(!stableResult.reverted) {
            if(stableResult.value) {
                protocol = "4";
            } else {
                protocol = "5";
            }
        }
    } else if(factory == AEROCL_FACTORY) {
        protocol = "7";
    } else if(factory == UNISWAPV3_FACTORY) {
        protocol = "6";
    }
    if(protocol != "0") {
        if(!createPairFromRouter(pairId, token0, token1, protocol, fee)) {
            log.error("Failed to create pair {} for tokens: {} {} for protocol {}",[pairId, token0, token1, protocol]);
            return;
        }
    }
}