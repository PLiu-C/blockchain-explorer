import { Router } from 'express';
import { Request, Response } from 'express-serve-static-core';
//import { fileUpload } from 'express-fileupload';
import { Platform } from '../Platform';
import { execSync } from 'child_process';
import { helper } from '../../../common/helper';
import Ajv from 'ajv';
import * as path from 'path';
import fs from 'fs';

/**
 *    SPDX-License-Identifier: Apache-2.0
 */

import * as requtil from '../../../rest/requestutils';

interface ExtRequest extends Request {
	network: string;
}

const logger = helper.getLogger('devops');
const ajv = new Ajv().addSchema(require(`${__dirname}/schema.json`), 'api');

const workdir = process.env.FABTOOL_PATH || '.';

const outfolder = path.join(workdir, 'output');
const out_ccpacks = path.join(outfolder, 'ccpacks');
const out_artifacts = path.join(outfolder, 'artifacts');
const out_cryptos = path.join(outfolder, '../crypto-config');

class OpsError extends Error {
	code: number;

	constructor(code: number, ...params: any) {
		super(...params);
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, OpsError);
		}
		this.name = 'OpsError';
		this.code = code;
	}
}

function sh(cmd: string, args: string[]) {
	const options = { cwd: workdir, shell: '/bin/bash' };
	cmd = `${cmd} ${args.join(' ')}`;
	logger.info(`*** Running ${cmd} ***`);
	try {
		return execSync(cmd, options); // if anything wrong (incl. nonzero exit code), throw exception
	} catch (err) {
		throw new OpsError(500);
	}
}

function set_api(
	path: string,
	router: Router,
	arg_provider: (body: object) => string[] | null
) {
	router.post(path, (req, res) => {
		try {
			const fcn = `api${path.replace('/', '_')}.sh`;
			if (!ajv.validate(`api#/definitions/${fcn}`, req.body)) {
				throw new OpsError(400);
			}
			const args = arg_provider(req.body);
			const stdout = sh(fcn, args);
			logger.info(stdout);
			res.status(201).send(stdout);
		} catch (err) {
			res.status(err.code ?? 500).send(err);
		}
	});
}

/**
 *
 *
 * @param {*} router
 * @param {*} platform
 */
export function opsroutes(router: Router, platform: Platform) {
	/**
	 * Create a new channel
	 * POST /channel/create
	 * curl -i 'http://<host>:<port>/api/ops/fabric/channel/create \
	 *      -d '{"channel":"mychannel","profile":"TwoOrgsChannel"}'\
	 *      -H "Content-Type: appliction/json" \
	 *      -X POST
	 * Response:
	 * {
	 * }
	 */
	set_api('/channel/create', router, (body: any) => {
		return [body.channel, body.profile || ''];
	});

	/**
	 *   -d '{"channel":"mychannel", "org":1, "peers":[0,1,2]}'
	 */
	set_api('/channel/join', router, (body: any) => {
		return [body.channel, body.org, ...body.peers];
	});

	set_api('/channel/update_anchor_peer', router, (body: any) => {
		return [body.channel, body.profile, body.org, ...body.peers];
	});

	/**
	 *  -d '{"channel": "mychannel", "org":1, "peers":[0,1,2], "ccname":"fft", "cclang":"node", "ccdata":"<base64 data>"}
	 */
	set_api('/chaincode/install', router, (body: any) => {
		const content = Buffer.from(body.ccdata, 'base64');
		fs.writeFileSync(
			`${out_ccpacks}/${body.ccname}-${body.ccver}.tar.xz`,
			content
		);
		return [body.org, body.ccname, body.ccver, body.cclang, ...body.peers];
	});

	set_api('/chaincode/instantiate', router, (body: any) => {
		return [
			body.channel,
			body.org,
			body.peer.body.ccname,
			body.ccver,
			body.ccargs ?? '{"Args":[]}'
		];
	});

	set_api('/chaincode/upgrade', router, (body: any) => {
		return [
			body.channel,
			body.org,
			body.peer.body.ccname,
			body.ccver,
			body.ccargs ?? '{"Args":[]}'
		];
	});
}
