import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { selfRag } from './self-rag.js';
import { pool } from '../../basic-rag/db.js';

const app = express();
app.use(cors()); // restrict the origin in production
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/ask', async (req, res) => {
  const question =
    typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > 500) {
    return res
      .status(400)
      .json({ error: 'Send JSON { question } with 1 to 500 characters.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stops nginx from buffering the stream
  });
  res.flushHeaders?.();

  // Stop paying for LLM calls if the client disconnects.
  // Listen on `res`, not `req`: in modern Node, req 'close' can fire before the client leaves.
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  const send = (event, data) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await selfRag(question, {
      emit: send,
      signal: controller.signal,
    });
    send('done', { path: result.path, useful: result.useful });
  } catch (e) {
    if (!controller.signal.aborted) {
      console.error('ask failed:', e);
      send('error', { message: 'Something went wrong. Please try again.' });
    }
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT ?? 3000;
const server = app.listen(PORT, () =>
  console.log(`API on http://localhost:${PORT}`),
);

process.on('SIGINT', async () => {
  server.close();
  await pool.end();
  process.exit(0);
});
