const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// DB setup
const db = new Database(path.join(__dirname, 'data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('АКТ','СЧЁТ')),
    date TEXT NOT NULL,
    amount REAL,
    done INTEGER NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
  );
`);

// Seed initial data if empty
const clientCount = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
if (clientCount === 0) {
  const insertClient = db.prepare('INSERT OR IGNORE INTO clients (name) VALUES (?)');
  const insertRecord = db.prepare('INSERT INTO records (client_id, type, date, amount, done, note) VALUES (?, ?, ?, ?, 0, ?)');

  const clients = {
    'ИП Серая Светлана': [],
    'Дандуров Владимир Валериевич': [],
    'Ожинская Татьяна Валерьевна': [],
    'ООО Айрус': [],
  };

  Object.keys(clients).forEach(name => {
    insertClient.run(name);
    clients[name] = db.prepare('SELECT id FROM clients WHERE name = ?').get(name).id;
  });

  const seed = [
    [clients['ИП Серая Светлана'],           'АКТ',  '31.03.2026', null,   'Акт в конце марта'],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.03.2026', 200000, ''],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.04.2026', 200000, ''],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.05.2026', 330000, 'Далее ежемесячно 11-го числа'],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.06.2026', 330000, 'Ежемесячно'],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.07.2026', 330000, 'Ежемесячно'],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.08.2026', 330000, 'Ежемесячно'],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.09.2026', 330000, 'Ежемесячно'],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.10.2026', 330000, 'Ежемесячно'],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.11.2026', 330000, 'Ежемесячно'],
    [clients['Дандуров Владимир Валериевич'], 'СЧЁТ', '11.12.2026', 330000, 'Ежемесячно'],
    [clients['Ожинская Татьяна Валерьевна'],  'АКТ',  '20.02.2026', null,   ''],
    [clients['Ожинская Татьяна Валерьевна'],  'АКТ',  '20.03.2026', null,   ''],
    [clients['Ожинская Татьяна Валерьевна'],  'АКТ',  '20.04.2026', null,   ''],
    [clients['ООО Айрус'],                    'АКТ',  '30.04.2026', null,   '31.04 не существует, перенесено на 30.04'],
  ];

  seed.forEach(row => insertRecord.run(...row));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API: CLIENTS ──────────────────────────────────────────────────────────────
app.get('/api/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY name').all();
  res.json(clients);
});

app.post('/api/clients', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' });
  try {
    const result = db.prepare('INSERT INTO clients (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (e) {
    res.status(409).json({ error: 'Такой клиент уже существует' });
  }
});

app.delete('/api/clients/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: RECORDS ──────────────────────────────────────────────────────────────
app.get('/api/records', (req, res) => {
  const records = db.prepare(`
    SELECT r.*, c.name as client_name
    FROM records r
    JOIN clients c ON r.client_id = c.id
    ORDER BY c.name, r.date
  `).all();
  res.json(records);
});

app.post('/api/records', (req, res) => {
  const { client_id, type, date, amount, note } = req.body;
  if (!client_id || !type || !date) return res.status(400).json({ error: 'Заполните обязательные поля' });
  const result = db.prepare(
    'INSERT INTO records (client_id, type, date, amount, done, note) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(client_id, type, date, amount || null, note || '');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/records/:id', (req, res) => {
  const { client_id, type, date, amount, done, note } = req.body;
  db.prepare(
    'UPDATE records SET client_id=?, type=?, date=?, amount=?, done=?, note=? WHERE id=?'
  ).run(client_id, type, date, amount || null, done ? 1 : 0, note || '', req.params.id);
  res.json({ ok: true });
});

app.patch('/api/records/:id/done', (req, res) => {
  const { done } = req.body;
  db.prepare('UPDATE records SET done=? WHERE id=?').run(done ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/records/:id', (req, res) => {
  db.prepare('DELETE FROM records WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
