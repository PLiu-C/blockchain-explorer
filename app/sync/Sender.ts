/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { helper } from '../common/helper';
const logger = helper.getLogger('ExplorerHandler');

/**
 *
 *
 * @class Sender
 */
export class Sender {
	/**
	 * Creates an instance of Sender.
	 * @memberof Sender
	 */
	constructor() {
		process.on('message', msg => {
			logger.debug('Message from parent: %j', msg);
		});
	}

	/**
	 *
	 *
	 * @param {*} message
	 * @memberof Sender
	 */
	send(message: any) {
		if (process.send) {
			process.send(message);
		}
	}
}
