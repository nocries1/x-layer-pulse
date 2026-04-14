// Tiny static + SSE server. Tails logs/decisions.jsonl and pushes new lines
// to any connected dashboard. Also serves /dashboard/index.html.
import express from 'express';
import { createReadStream, statSync, watch } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from '../config/index.js';
import { LOG_FILE } from '../log/index.js';

const app = express();
const ROOT = resolve('.');

app.use(express.static(ROOT));

app.get('/', (_req, res) => {
  res.redirect('/dashboard/index.html');
});

app.get('/api/state', async (_req, res) => {
  // Return last 200 events as a JSON array
  try {
    const lines = await tailLines(LOG_FILE, 200);
    res.json(lines.map((l) => safeJson(l)).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`event: hello\ndata: {}\n\n`);

  let lastSize = 0;
  try { lastSize = statSync(LOG_FILE).size; } catch { /* file may not exist yet */ }

  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15_000);

  const watcher = watch(LOG_FILE, { persistent: false }, () => {
    let size = 0;
    try { size = statSync(LOG_FILE).size; } catch { return; }
    if (size <= lastSize) { lastSize = size; return; }
    const stream = createReadStream(LOG_FILE, { start: lastSize, end: size });
    let buf = '';
    stream.on('data', (chunk) => (buf += chunk.toString()));
    stream.on('end', () => {
      lastSize = size;
      const lines = buf.split('\n').filter(Boolean);
      for (const line of lines) {
        const obj = safeJson(line);
        if (obj) res.write(`data: ${JSON.stringify(obj)}\n\n`);
      }
    });
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    watcher.close();
  });
});

function safeJson(line: string): unknown | null {
  try { return JSON.parse(line); } catch { return null; }
}

async function tailLines(file: string, n: number): Promise<string[]> {
  const { readFile } = await import('node:fs/promises');
  try {
    const content = await readFile(file, 'utf8');
    return content.trim().split('\n').slice(-n);
  } catch {
    return [];
  }
}

const port = config.SERVER_PORT;
app.listen(port, () => {
  console.log(`X Layer Pulse dashboard: http://localhost:${port}/dashboard/index.html`);
});
