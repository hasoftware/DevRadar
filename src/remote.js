import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import spawn from 'cross-spawn';

const GIT_URL_RE =
  /^(?:https?:\/\/|git@|ssh:\/\/|git:\/\/).+/i;

export function isRemoteUrl(input) {
  return GIT_URL_RE.test(input);
}

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git ${args[0]} failed (exit ${code}): ${stderr.trim()}`));
    });
    child.on('error', reject);
  });
}

export async function cloneToTemp(url) {
  const id = randomBytes(6).toString('hex');
  const tempDir = path.join(tmpdir(), `devradar-${id}`);
  await fs.mkdir(tempDir, { recursive: true });
  await runGit(['clone', '--depth', '1', url, tempDir], tmpdir());
  return tempDir;
}

export async function cleanup(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}
