import { BigInt, log } from '@graphprotocol/graph-ts';
import { TrackPair } from '../types/UniversalRouter/UniversalRouter';
import { createPairFromRouter, loadOrCreateAbout, updateProtocolId } from '../helpers/loader';
import { log } from "@graphprotocol/graph-ts";
import {
    AERO_FACTORY,
    AEROCL_FACTORY,
    SUSHISWAP_FACTORY,
    UNISWAPV2_FACTORY, UNISWAPV3_FACTORY
} from "../helpers/constants";
import { AeroPool } from "../types/templates/AeroPool/AeroPool";
import { DeltaSwapPair } from "../types/schema";

export function handleTrackPair(event: TrackPair): void {
    const pair = event.params.pair;
    const pairId = pair.toHexString();
    log.warning("TrackPair Event: {}", [pairId]);
    const token0 = event.params.token0.toHexString();
    const token1 = event.params.token1.toHexString();
    const factory = event.params.factory.toHexString();
    const fee = BigInt.fromString(event.params.fee.toString());
    const protocolId = event.params.protocolId.toString();
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
                protocol = "5";
            } else {
                protocol = "4";
            }
        }
    } else if(factory == AEROCL_FACTORY) {
        protocol = "7";
    } else if(factory == UNISWAPV3_FACTORY) {
        protocol = "6";
    } else {
        const numProtocolId = BigInt.fromString(protocolId);
        if(numProtocolId.ge(BigInt.fromI32(10))) {
            protocol = protocolId
        }
    }
    if(protocol != "0") {
        if(!createPairFromRouter(pairId, token0, token1, protocol, fee)) {
            log.error("Failed to create pair {} for tokens: {} {} for protocol {}",[pairId, token0, token1, protocol]);
            return;
        }
    }
}

export function handleUnTrackPair(event: TrackPair): void {
    const id = event.params.pair.toHexString();
    log.warning("UnTrackPair Event: {}", [id]);
    const pair = DeltaSwapPair.load(id);
    if (pair == null) {
        log.error("DeltaSwap Pair Unavailable: {}", [id]);
        return;
    }

    if(pair.isTracked) {
        const protocolId = event.params.protocolId.toString();
        updateProtocolId(pair.token0, pair.token1, pair.protocol.toString(), protocolId);
        pair.protocol = BigInt.fromString(protocolId);
        pair.isTracked = false;
        pair.save();

        const about = loadOrCreateAbout();
        about.totalPairsUnTracked = about.totalPairsUnTracked.plus(BigInt.fromI32(1));
        about.save();
    }
}