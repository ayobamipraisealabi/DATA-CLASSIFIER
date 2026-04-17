import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { v7 as uuidv7 } from 'uuid';
import axios from 'axios';

const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const db = new Database('profiles.db', { verbose: console.log });

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    gender TEXT NOT NULL,
    gender_probability REAL NOT NULL,
    sample_size INTEGER NOT NULL,
    age INTEGER NOT NULL,
    age_group TEXT NOT NULL,
    country_id TEXT NOT NULL,
    country_probability REAL NOT NULL,
    created_at TEXT NOT NULL
  )
`);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const fetchApi = async (url, apiName) => {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch {
    throw new Error(`${apiName} returned an invalid response`);
  }
};

app.post('/api/profiles', async (req, res) => {
  const { name } = req.body;

  if (name === undefined) {
    return res.status(400).json({ status: "error", message: "Missing or empty name" });
  }
  if (typeof name !== 'string') {
    return res.status(422).json({ status: "error", message: "Invalid type" });
  }
  if (name.trim() === '') {
    return res.status(400).json({ status: "error", message: "Missing or empty name" });
  }

  // Check for existing profile (idempotency)
  const existing = db.prepare('SELECT * FROM profiles WHERE name = ?').get(name);
  if (existing) {
    return res.status(200).json({
      status: "success",
      message: "Profile already exists",
      data: existing
    });
  }

  try {
    const [genderData, ageData, nationalData] = await Promise.all([
      fetchApi(`https://api.genderize.io?name=${encodeURIComponent(name)}`, 'Genderize'),
      fetchApi(`https://api.agify.io?name=${encodeURIComponent(name)}`, 'Agify'),
      fetchApi(`https://api.nationalize.io?name=${encodeURIComponent(name)}`, 'Nationalize')
    ]);

    // Edge-case validation
    if (genderData.gender === null || genderData.count === 0) {
      throw new Error('Genderize returned an invalid response');
    }
    if (ageData.age === null) {
      throw new Error('Agify returned an invalid response');
    }
    if (!nationalData.country || nationalData.country.length === 0) {
      throw new Error('Nationalize returned an invalid response');
    }

    // Age group classification
    const age = ageData.age;
    let age_group = 'adult';
    if (age >= 0 && age <= 12) age_group = 'child';
    else if (age >= 13 && age <= 19) age_group = 'teenager';
    else if (age >= 60) age_group = 'senior';

    // Highest probability country
    let country_id = '';
    let country_probability = 0;
    for (const c of nationalData.country) {
      if (c.probability > country_probability) {
        country_probability = c.probability;
        country_id = c.country_id;
      }
    }

    const id = uuidv7();
    const created_at = new Date().toISOString();

    db.prepare(`
      INSERT INTO profiles 
      (id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, genderData.gender, genderData.probability, genderData.count,
      age, age_group, country_id, country_probability, created_at
    );

    const profile = {
      id, name, gender: genderData.gender, gender_probability: genderData.probability,
      sample_size: genderData.count, age, age_group, country_id, country_probability, created_at
    };

    res.status(201).json({ status: "success", data: profile });
  } catch (err) {
    const msg = err.message;
    if (msg.includes('Genderize') || msg.includes('Agify') || msg.includes('Nationalize')) {
      return res.status(502).json({ status: "error", message: msg });
    }
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

app.get('/api/profiles/:id', (req, res) => {
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
  if (!profile) return res.status(404).json({ status: "error", message: "Profile not found" });
  res.json({ status: "success", data: profile });
});

app.get('/api/profiles', (req, res) => {
  const { gender, country_id, age_group } = req.query;
  let sql = 'SELECT id, name, gender, age, age_group, country_id FROM profiles';
  const params = [];
  const where = [];

  if (gender) { where.push('LOWER(gender) = LOWER(?)'); params.push(gender); }
  if (country_id) { where.push('LOWER(country_id) = LOWER(?)'); params.push(country_id); }
  if (age_group) { where.push('LOWER(age_group) = LOWER(?)'); params.push(age_group); }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');

  const data = db.prepare(sql).all(...params);
  res.json({ status: "success", count: data.length, data });
});

app.delete('/api/profiles/:id', (req, res) => {
  const result = db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ status: "error", message: "Profile not found" });
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));