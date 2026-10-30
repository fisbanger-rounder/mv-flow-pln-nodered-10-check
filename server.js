const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const CAPTURE_TOKEN = process.env.CAPTURE_TOKEN || 'w0WqCO3CWyIZkcQmCHqDR6GjNnMGiVRS';
const PORT = process.env.PORT || 3006;

const captures = new Map();

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-None-Match');
  res.set('Access-Control-Expose-Headers', 'ETag, Last-Modified');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname)));

function authCapture(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token !== CAPTURE_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/capture', authCapture, (req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) return res.status(400).json({ error: 'Empty body' });

    const contentType = req.headers['content-type'] || 'image/jpeg';
    const device = req.query.device || 'default';
    const etag = crypto.createHash('md5').update(buffer).digest('hex');
    captures.set(device, { buffer, contentType, etag, timestamp: new Date().toISOString() });

    res.json({ ok: true, device, size: buffer.length, timestamp: captures.get(device).timestamp });
  });
});

app.get('/api/latest', (req, res) => {
  const device = req.query.device || 'default';
  const cap = captures.get(device);
  if (!cap) return res.status(404).json({ error: 'No capture available' });

  const clientEtag = req.headers['if-none-match'];
  if (clientEtag && clientEtag === cap.etag) {
    return res.sendStatus(304);
  }

  res.set('Content-Type', cap.contentType);
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.set('ETag', cap.etag);
  res.set('Last-Modified', new Date(cap.timestamp).toUTCString());
  res.send(cap.buffer);
});

app.get('/api/devices', (req, res) => {
  const list = Array.from(captures.entries()).map(([device, cap]) => ({
    device,
    timestamp: cap.timestamp,
    size: cap.buffer.length
  }));
  res.json(list);
});

app.listen(PORT, () => {
  console.log(`MV Guard server listening on http://localhost:${PORT}`);
  console.log(`Capture endpoint: POST http://localhost:${PORT}/api/capture?device=<SERIAL>`);
  console.log(`Latest image:     GET  http://localhost:${PORT}/api/latest?device=<SERIAL>`);
});