import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import os from 'os';
import { prisma } from '../../../config/database.js';

/**
 * Which release is running and when it started. The commit comes from GIT_COMMIT (set by the build), or from the
 * checked-out repository when there is one. Every start is written to the database: that is the restart history, and
 * the first start of a commit is when it was rolled out.
 */

const packageVersion = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version;

const gitCommit = () => {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.slice(0, 12);
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString().trim() || null;
  } catch {
    return null;
  }
};

const startedAt = new Date();
const identity = {
  version: process.env.APP_VERSION || packageVersion,
  commit: gitCommit(),
  nodeVersion: process.version,
  hostname: os.hostname(),
  environment: process.env.NODE_ENV || 'development',
};

export const recordBoot = () => prisma.systemBoot.create({ data: { ...identity, startedAt } });

const toBoot = (boot) => ({ id: boot.id, startedAt: boot.startedAt, version: boot.version, commit: boot.commit, nodeVersion: boot.nodeVersion });

export const getRelease = async () => {
  const [rolledOut, boots] = await Promise.all([
    identity.commit ? prisma.systemBoot.findFirst({ where: { commit: identity.commit }, orderBy: { startedAt: 'asc' }, select: { startedAt: true } }) : null,
    prisma.systemBoot.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
  ]);
  return {
    ...identity,
    startedAt,
    deployedAt: rolledOut?.startedAt ?? startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    restarts: boots.map(toBoot),
  };
};

export default { recordBoot, getRelease };
