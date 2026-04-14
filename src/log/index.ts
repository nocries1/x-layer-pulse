import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'logs';
const FILE = join(DIR, 'decisions.jsonl');

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
if (!existsSync(FILE)) writeFileSync(FILE, '');

export function logEvent(event: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
  appendFileSync(FILE, line + '\n');
  console.log(line);
}

export const LOG_FILE = FILE;
