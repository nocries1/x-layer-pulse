// Hardened runner for the onchainos CLI. Every Onchain OS skill flows through here.
import { spawn } from 'node:child_process';

const CLI = process.env.ONCHAINOS_BIN ?? 'onchainos';

export interface CliResult<T = unknown> {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  data?: T;
  confirming?: boolean;
}

export async function runCli<T = unknown>(args: string[]): Promise<CliResult<T>> {
  return new Promise((resolve) => {
    const child = spawn(CLI, args, { env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));
    child.on('close', (code) => {
      const exitCode = code ?? -1;
      let data: T | undefined;
      const match = stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as unknown;
          if (parsed && typeof parsed === 'object' && 'data' in (parsed as Record<string, unknown>)) {
            data = (parsed as { data: T }).data;
          } else {
            data = parsed as T;
          }
        } catch { /* ignore */ }
      }
      resolve({ ok: exitCode === 0, exitCode, stdout, stderr, data, confirming: exitCode === 2 });
    });
    child.on('error', (err) => {
      resolve({ ok: false, exitCode: -1, stdout, stderr: stderr + String(err) });
    });
  });
}

export async function runCliOrThrow<T = unknown>(args: string[]): Promise<T> {
  const r = await runCli<T>(args);
  if (!r.ok || r.data === undefined) {
    throw new Error(`onchainos ${args.join(' ')} failed (exit ${r.exitCode}): ${r.stderr || r.stdout}`);
  }
  return r.data;
}
