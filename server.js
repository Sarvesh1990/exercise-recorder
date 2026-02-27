const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --- JSON File Database ---
const DB_PATH = path.join(__dirname, 'data', 'exercises.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading DB:', e.message);
  }
  return [];
}

function saveDB(data) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Initialize data dir
if (!fs.existsSync(DB_PATH)) saveDB([]);

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

// --- API Routes ---

// Get all exercises (optionally filter by name)
app.get('/api/exercises', (req, res) => {
  let data = loadDB();
  const { name, limit, offset } = req.query;

  if (name) {
    data = data.filter(e => e.name.toLowerCase() === name.toLowerCase());
  }

  data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (limit) {
    const start = parseInt(offset) || 0;
    data = data.slice(start, start + parseInt(limit));
  }

  res.json(data);
});

// Get distinct exercise names
app.get('/api/exercises/names', (req, res) => {
  const data = loadDB();
  const counts = {};
  data.forEach(e => {
    const n = e.name.toLowerCase();
    counts[n] = (counts[n] || 0) + 1;
  });
  const names = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  res.json(names);
});

// Get progression data for a specific exercise
app.get('/api/exercises/progression/:name', (req, res) => {
  const data = loadDB()
    .filter(e => e.name.toLowerCase() === req.params.name.toLowerCase())
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(({ weight, reps, sets, unit, created_at }) => ({ weight, reps, sets, unit, created_at }));
  res.json(data);
});

// Add a single exercise entry
app.post('/api/exercises', (req, res) => {
  const { id, name, weight, reps, sets, unit, notes, created_at } = req.body;

  if (!name || weight === undefined) {
    return res.status(400).json({ error: 'name and weight are required' });
  }

  const data = loadDB();
  const entry = {
    id: id || crypto.randomUUID(),
    name: name.trim(),
    weight: parseFloat(weight),
    reps: reps ? parseInt(reps) : null,
    sets: sets ? parseInt(sets) : null,
    unit: unit || 'kg',
    notes: notes || null,
    created_at: created_at || new Date().toISOString(),
    synced_at: new Date().toISOString()
  };

  const idx = data.findIndex(e => e.id === entry.id);
  if (idx >= 0) data[idx] = entry;
  else data.push(entry);

  saveDB(data);
  res.json({ success: true });
});

// Sync endpoint: accepts batch of entries from offline storage
app.post('/api/sync', (req, res) => {
  const entries = req.body.entries;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'entries array required' });
  }

  const data = loadDB();

  for (const e of entries) {
    const entry = {
      id: e.id,
      name: e.name.trim(),
      weight: parseFloat(e.weight),
      reps: e.reps || null,
      sets: e.sets || null,
      unit: e.unit || 'kg',
      notes: e.notes || null,
      created_at: e.created_at,
      synced_at: new Date().toISOString()
    };

    const idx = data.findIndex(x => x.id === entry.id);
    if (idx >= 0) data[idx] = entry;
    else data.push(entry);
  }

  saveDB(data);
  res.json({ success: true, synced: entries.length });
});

// Delete an exercise entry
app.delete('/api/exercises/:id', (req, res) => {
  let data = loadDB();
  data = data.filter(e => e.id !== req.params.id);
  saveDB(data);
  res.json({ success: true });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🏋️ Exercise Recorder running at http://localhost:${PORT}`);
});
