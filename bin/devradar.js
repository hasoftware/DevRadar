#!/usr/bin/env node
import { run } from '../src/index.js';

const debug = process.env.DEVRADAR_DEBUG === '1' || process.env.DEVRADAR_DEBUG === 'true';

run(process.argv).catch((err) => {
  let message = 'devradar: unexpected error';
  if (err && err.code === 'ENOENT') {
    message = `devradar: path not found: ${err.path || ''}`.trim();
  } else if (err && err.code === 'EACCES') {
    message = `devradar: permission denied: ${err.path || ''}`.trim();
  } else if (err && err.code === 'ENOTDIR') {
    message = `devradar: not a directory: ${err.path || ''}`.trim();
  } else if (err && err.message) {
    message = `devradar: ${err.message}`;
  }
  console.error(message);
  if (debug && err && err.stack) {
    console.error(err.stack);
  } else if (!debug) {
    console.error('Run with DEVRADAR_DEBUG=1 for a full stack trace.');
  }
  process.exit(1);
});
