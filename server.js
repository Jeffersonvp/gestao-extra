/* Minimal Express server with JSON-file persistence */
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(express.json({ limit: '256kb' }));

// Serve static frontend
app.use(express.static(__dirname));

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = { seq: { entries: 1, vacations: 1 }, entries: [], vacations: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Entries endpoints
app.get('/api/entries', (req, res) => {
  const db = readDb();
  res.json(db.entries || []);
});

app.post('/api/entries', (req, res) => {
  const { name, reason, type, date, hours } = req.body || {};
  if (!name || !reason || typeof hours !== 'number' || !date) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const db = readDb();
  const id = db.seq.entries++;
  const item = { id, name: String(name), reason: String(reason), type: String(type || 'extra'), date: new Date(date), hours: Number(hours) };
  db.entries.unshift(item);
  writeDb(db);
  res.status(201).json(item);
});

app.delete('/api/entries/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = readDb();
  const idx = (db.entries || []).findIndex(e => Number(e.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = db.entries.splice(idx, 1);
  writeDb(db);
  res.json(removed);
});

// Vacations endpoints
app.get('/api/vacations', (req, res) => {
  const db = readDb();
  res.json(db.vacations || []);
});

app.post('/api/vacations', (req, res) => {
  const { name, startDate, endDate, notes } = req.body || {};
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const db = readDb();
  const id = db.seq.vacations++;
  const item = { id, name: String(name), startDate: new Date(startDate), endDate: new Date(endDate), notes: String(notes || '') };
  db.vacations.push(item);
  writeDb(db);
  res.status(201).json(item);
});

app.delete('/api/vacations/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = readDb();
  const idx = (db.vacations || []).findIndex(v => Number(v.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = db.vacations.splice(idx, 1);
  writeDb(db);
  res.json(removed);
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`Server running on http://localhost:${PORT}`);
});


