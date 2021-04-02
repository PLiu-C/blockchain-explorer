/*
 *SPDX-License-Identifier: Apache-2.0
 */
import { explorerConst } from '../common/ExplorerConst';
import { explorerError } from '../common/ExplorerMessage';
import { ExplorerError } from '../common/ExplorerError';
import { Sender } from './Sender';
import { SyncPlatform } from '../platform/fabric/sync/SyncPlatform';

/**
 *
 *
 * @class SyncBuilder
 */
export class SyncBuilder {
	/**
	 *
	 *
	 * @static
	 * @param {*} pltfrm
	 * @param {*} persistence
	 * @param {*} sender
	 * @returns
	 * @memberof SyncBuilder
	 */
	static async build(pltfrm: string, persistence: any, sender: Sender) {
		if (pltfrm === explorerConst.PLATFORM_FABRIC) {
			const platform = new SyncPlatform(persistence, sender);
			return platform;
		}
		throw new ExplorerError(explorerError.ERROR_1005, pltfrm);
	}
}
