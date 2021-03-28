import { Router } from 'express';
import { Request, Response } from 'express-serve-static-core';
import multer from 'multer';
import { Platform } from '../Platform';
import { execSync } from 'child_process';
import { helper } from '../../../common/helper';
import Ajv from 'ajv';
import path from 'path';
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

const upload = multer({
  dest: path.join('public', 'uploads'),
  fileFilter: (req, file, callback) => {
    callback(null, ['application/x-gzip'].includes(file.mimetype));
  }
});

const workdir = process.env.FABTOOL_PATH || '.';
const outfolder = path.join(workdir, 'output');
const out_ccpacks = path.join(outfolder, 'ccpacks');
const out_artifacts = path.join(outfolder, 'artifacts');
const out_cryptos = path.join(outfolder, '../crypto-config');


class OpsError extends Error {
	code: number;
	stdout?: string;
	stderr?: string

	constructor(code: number, error: Error|String|undefined) {
		super(error?.toString());
		if (error) {
			const e = error as any;
			if (e.stdout) {
				this.stdout = e.stdout.toString();
			}
			if (e.stderr) {
				this.stderr = e.stderr.toString();
			}
		}
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, OpsError);
		}
		this.name = 'OpsError';
		this.code = code;
	}
}

function sh(cmd: string, args: string[]) {
	const options = { cwd: workdir, shell: '/bin/bash' };
	cmd = `./scripts/${cmd}.sh ${args.join(' ')}`;
	logger.info(`*** Workdir: ${workdir}, Running ${cmd} ***`);
	try {
		return execSync(cmd, options); // if anything wrong (incl. nonzero exit code), throw exception
	} catch (err) {
		throw new OpsError(500, err);
	}
}

function runapi(arg_provider: (req: Request) => string[] | null) {
    return (req: Request, res: Response) => {
		try {
			const path = req.path;
			const fcn = `api${path.replace(/\//g, '_')}`;
			if (!ajv.validate(`api#/definitions/${fcn}`, req.body)) {
				throw new OpsError(400, ajv.errors && ajv.errors.length ? ajv.errors[0].toString() : '');
			}
			const args = arg_provider(req);
			const stdout = sh(fcn, args).toString();
			res.status(201).send(stdout);
		} catch (err) {
			res.status(err.code ?? 500).json({error: err.toString(), console: err.stdout});
		}
	}
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
	router.post('/channel/create', runapi((req: Request) => {
		return [req.body.channel, req.body.profile || ''];
	}));

	/**
	 *   -d '{"channel":"mychannel", "org":1, "peers":[0,1,2]}'
	 */
	router.post('/channel/join', runapi((req: Request) => {
		return [req.body.channel, req.body.org, ...req.body.peers];
	}));

	router.post('/channel/update_anchor_peer', runapi((req: Request) => {
		return [req.body.channel, req.body.profile, req.body.org, ...req.body.peers];
	}));

	/**
	 *  req.body: '{"channel": "mychannel", "org":1, "peers":[0,1,2], "ccname":"fft", "cclang":"node"}
	 */
	router.post('/chaincode/install',
		upload.single('ccpackfile'), 
		(req, res, next) => {
			if (req.body) {
				req.body.org = parseInt(req.body.org);
				req.body.peers = req.body.peers.split(',').map((x) => parseInt(x));
				req.body.ccname = req.body.ccname.trim();
				req.body.ccver = req.body.ccver.trim();
			}
			next();
		},
		runapi((req: Request) => {
			const body = req.body;
			fs.renameSync((req as any).file.path, `${out_ccpacks}/${body.ccname}-${body.ccver}.tar.gz`);
			return [body.org, body.ccname, body.ccver, body.cclang, ...body.peers];
		})
	);

	router.post('/chaincode/instantiate', runapi((req: Request) => {
		return [
			req.body.channel,
			req.body.org,
			req.body.peer,
			req.body.ccname,
			req.body.ccver,
			req.body.ccargs ?? '{"args":["init"]}'
		];
	}));

	router.post('/chaincode/upgrade', runapi((req:Request) => {
		return [
			req.body.channel,
			req.body.org,
			req.body.peer.body.ccname,
			req.body.ccver,
			req.body.ccargs ?? '{"Args":[]}'
		];
	}));
}
