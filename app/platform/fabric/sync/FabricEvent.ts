/*
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FabricClient, SyncServices } from '../../../types';
import type { BlockListener } from 'fabric-network';


import {helper} from '../../../common/helper';

const logger = helper.getLogger('FabricEvent');

/**
 *
 *
 * @class FabricEvent
 */
export class FabricEvent {

	client : FabricClient;
	fabricServices : SyncServices;
	static channelEventHubs : Map<string, BlockListener>;

	/**
	 * Creates an instance of FabricEvent.
	 * @param {*} client
	 * @param {*} fabricServices
	 * @memberof FabricEvent
	 */
	constructor(client: FabricClient, fabricServices: SyncServices) {
		this.client = client;
		this.fabricServices = fabricServices;
	}

	/**
	 *
	 *
	 * @memberof FabricEvent
	 */
	async initialize() {
		// Creating channel event hub
		const channels = this.client.getChannels();
		for (const channel_name of channels) {
			const listener = FabricEvent.channelEventHubs.get(channel_name);

			if (listener) {
				logger.debug(
					'initialize() - Channel event hub already exists for [%s]',
					channel_name
				);
				continue;
			}

			this.createChannelEventHub(channel_name);
		}
	}

	/**
	 *
	 *
	 * @param {*} channel
	 * @memberof FabricEvent
	 */
	async createChannelEventHub(channel_name: string) {
		// Create channel event hub
		try {
			const network = await this.client.fabricGateway.gateway.getNetwork(
				channel_name
			);
			let startBlock = await this.fabricServices.getPersistence().getCrudService().getCurBlockNum(
				this.client.getNetworkId(), this.client.getChannelGenHash(channel_name)
			);
			startBlock = startBlock-1 < 1 ? 1 : startBlock-1;  // have some redundancy
			const listener = await network.addBlockListener(
				async event => {
					// Skip first block, it is process by peer event hub
					if (!(event.blockNumber.low === 0 && event.blockNumber.high === 0)) {
						await this.fabricServices.processBlockEvent(this.client, event.blockData);
					}
				},
				{
					startBlock,
					type: 'full'
				}
			);

			FabricEvent.channelEventHubs.set(channel_name, listener);

			logger.info('Successfully created channel event hub for [%s]', channel_name);
		} catch (error) {
			logger.error(`Failed to add block listener for ${channel_name}`);
		}
	}

	/* eslint-disable */
	/**
	 *
	 *
	 * @param {*} channel_name
	 * @memberof FabricEvent
	 */
	async connectChannelEventHub(channel_name: string) {
		try {
			await this.createChannelEventHub(channel_name);
		} catch (err) {
			logger.error('Failed to get the channel ', err);
		}
	}
	/* eslint-disable */
	/**
	 *
	 *
	 * @param {*} channel_name
	 * @returns
	 * @memberof FabricEvent
	 */
	isChannelEventHubConnected(channel_name: string) {
		const listener = FabricEvent.channelEventHubs.get(channel_name);
		if (listener) {
			return true;
		}
		return false;
	}

	/**
	 *
	 *
	 * @param {*} channel_name
	 * @returns
	 * @memberof FabricEvent
	 */
	async disconnectChannelEventHub(channel_name: string) {
		logger.debug('disconnectChannelEventHub(' + channel_name + ')');
		const listener = FabricEvent.channelEventHubs.get(channel_name);
		const network = await this.client.fabricGateway.gateway.getNetwork(
			channel_name
		);
		network.removeBlockListener(listener);
		FabricEvent.channelEventHubs.delete(channel_name);
		return;
	}

	/**
	 *
	 *
	 * @memberof FabricEvent
	 */
	disconnectEventHubs() {
		logger.debug('disconnectEventHubs()');

		// disconnect all event hubs
		for (const listenerEntry of FabricEvent.channelEventHubs) {
			const channel_name = listenerEntry[0];
			const status = this.isChannelEventHubConnected(channel_name);
			if (status) {
				this.disconnectChannelEventHub(channel_name);
			} else {
				logger.debug('disconnectEventHubs(), no connection found ', channel_name);
			}
		}
	}
}

// static class variable
FabricEvent.channelEventHubs = new Map();
