const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const CAPTURE_TOKEN = process.env.CAPTURE_TOKEN || 'w0WqCO3CWyIZkcQmCHqDR6GjNnMGiVRS';
const PORT = process.env.PORT || 3006;
const CAPTURES_DIR = path.join(__dirname, 'captures');

fs.mkdirSync(CAPTURES_DIR, { recursive: true });

const captures = new Map();
const activeFeeds = new Set();

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
    const device = (req.query.device || 'default').replace(/[^a-zA-Z0-9_-]/g, '');

    if (!activeFeeds.has(device)) {
      console.log(`Capture ignored for device '${device}'; active feeds: ${Array.from(activeFeeds).join(', ') || 'none'}`);
      return res.json({ ok: false, ignored: true, reason: 'Feed not active' });
    }

    const etag = crypto.createHash('md5').update(buffer).digest('hex');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `${device}_${timestamp}_${etag}.${ext}`;
    const filepath = path.join(CAPTURES_DIR, filename);

    const existing = fs.readdirSync(CAPTURES_DIR).filter(f => f.startsWith(`${device}_`));
    const saved = existing.length < 10;
    if (saved) {
      fs.writeFileSync(filepath, buffer);
    }
    captures.set(device, { buffer, contentType, etag, timestamp: new Date().toISOString() });

    res.json({ ok: true, device, size: buffer.length, saved, timestamp: captures.get(device).timestamp, filename });
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

app.post('/api/capture/wipe', (req, res) => {
  try {
    const files = fs.readdirSync(CAPTURES_DIR).filter(f => fs.statSync(path.join(CAPTURES_DIR, f)).isFile());
    for (const file of files) fs.unlinkSync(path.join(CAPTURES_DIR, file));
    res.json({ ok: true, removed: files.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/captures', (req, res) => {
  try {
    const files = fs.readdirSync(CAPTURES_DIR)
      .filter(f => fs.statSync(path.join(CAPTURES_DIR, f)).isFile())
      .map(f => ({ filename: f, url: `/api/captures/${f}` }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/captures/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(CAPTURES_DIR, filename);
  if (!filepath.startsWith(CAPTURES_DIR)) return res.status(403).send('Forbidden');
  if (!fs.existsSync(filepath)) return res.status(404).send('Not found');

  const ext = path.extname(filename).toLowerCase();
  const ct = ext === '.png' ? 'image/png' : 'image/jpeg';
  res.set('Content-Type', ct);
  res.send(fs.readFileSync(filepath));
});

app.post('/api/feed/start', (req, res) => {
  const device = (req.query.device || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  activeFeeds.add(device);
  res.json({ ok: true, active: true });
});

app.post('/api/feed/stop', (req, res) => {
  const device = (req.query.device || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  activeFeeds.delete(device);
  res.json({ ok: true, active: false });
});

app.listen(PORT, () => {
  console.log(`MV Guard server listening on http://localhost:${PORT}`);
  console.log(`Captures dir:     ${CAPTURES_DIR}`);
  console.log(`Capture endpoint: POST http://localhost:${PORT}/api/capture?device=<SERIAL>`);
  console.log(`Latest image:     GET  http://localhost:${PORT}/api/latest?device=<SERIAL>`);
});