// server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { nanoid } = require('nanoid');
const bodyParser = require('body-parser');
const path = require('path');

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// Simple file DB (db.json). In production use Postgres/MySQL.
const DB_FILE = path.join(__dirname, 'db.json');
function readDb() {
  if (!fs.existsSync(DB_FILE)) return { users: {}, transactions: {} };
  return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
}
function writeDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

// Initialize DB if missing
if (!fs.existsSync(DB_FILE)) writeDb({ users: {}, transactions: {} });

// Helper: credit user
function creditUser(userId, credits) {
  const db = readDb();
  db.users[userId] = db.users[userId] || { credits: 0, email: null };
  db.users[userId].credits += Number(credits);
  writeDb(db);
}

// API: recruiter submits a payment attempt (from frontend)
app.post('/api/payments/submit', upload.single('proof'), (req, res) => {
  // In real app: authenticate user; here we accept x-user-id header for demo
  const userId = req.headers['x-user-id'] || 'demo-user';
  const { reference, expected_amount, credits } = req.body;
  if (!reference || !expected_amount || !credits) {
    return res.status(400).json({ ok:false, message:'reference, expected_amount and credits required' });
  }
  const txId = nanoid(10);
  const db = readDb();
  db.transactions[txId] = {
    txId,
    userId,
    reference,
    amount: Number(expected_amount),
    credits: Number(credits),
    proofPath: req.file ? req.file.path : null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    matchedBy: null,
    matchedAt: null
  };
  writeDb(db);
  return res.json({ ok:true, txId, message:'submitted' });
});

// Admin: upload bank CSV to attempt auto-match
// Accepts multipart form file 'bankcsv'
app.post('/api/admin/import-csv', upload.single('bankcsv'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok:false, message:'no file uploaded' });
  const csvPath = req.file.path;
  const raw = fs.readFileSync(csvPath);
  // Try parsing CSV flexibly - user should provide CSV exported from bank
  let records = [];
  try {
    records = parse(raw, { columns: true, skip_empty_lines: true });
  } catch (e) {
    // fallback: try without headers
    try {
      const rows = parse(raw, { relax_column_count: true });
      records = rows;
    } catch(err) {
      return res.status(400).json({ ok:false, message:'CSV parse error', error: err.message });
    }
  }

  const db = readDb();
  const transactions = db.transactions;
  const matches = [];
  const unmatchedRows = [];

  // Normalize CSV rows: try to find fields that look like reference / amount
  for (const row of records) {
    // Convert row object keys to lowercase to search for likely fields
    const keys = Object.keys(row).reduce((acc,k)=> { acc[k.toLowerCase()] = row[k]; return acc; }, {});
    // heuristics for amount and reference fields
    let maybeRef = keys['reference'] || keys['ref'] || keys['payment reference'] || keys['narration'] || keys['description'] || keys['transaction details'] || keys['payee'] || '';
    let maybeAmount = keys['amount'] || keys['amount (zars)'] || keys['debit'] || keys['credit'] || keys['value'] || keys['transaction amount'] || '';

    // Clean amount: remove currency, commas
    const amountNum = parseFloat((maybeAmount||'').toString().replace(/[^0-9.-]/g,''));
    const refText = (maybeRef||'').toString().trim();

    // Try exact matching against pending transactions
    let found = null;
    for (const txId in transactions) {
      const tx = transactions[txId];
      if (tx.status !== 'pending') continue;
      // Check if reference substring exists in CSV refText OR exact equals user-supplied reference
      // AND amount equals expected
      if (refText && refText.includes(tx.reference) && !isNaN(amountNum) && Math.abs(amountNum - tx.amount) < 0.001) {
        found = { txId, tx, row, amountNum, refText };
        break;
      }
      // Also check if narration contains tx.reference or tx.reference contains a token from narration
      if (!found && (refText && tx.reference.includes(refText)) && !isNaN(amountNum) && Math.abs(amountNum - tx.amount) < 0.001) {
        found = { txId, tx, row, amountNum, refText };
        break;
      }
    }

    if (found) {
      // mark verified
      transactions[found.txId].status = 'verified';
      transactions[found.txId].matchedBy = 'csv-import';
      transactions[found.txId].matchedAt = new Date().toISOString();
      transactions[found.txId].bankRow = found.row;
      creditUser(transactions[found.txId].userId, transactions[found.txId].credits);
      matches.push({ txId: found.txId, reference: transactions[found.txId].reference, amount: transactions[found.txId].amount });
    } else {
      unmatchedRows.push(row);
    }
  }

  db.transactions = transactions;
  writeDb(db);

  // cleanup uploaded CSV file
  try { fs.unlinkSync(csvPath); } catch(e){}

  return res.json({ ok:true, matches, unmatchedRowsCount: unmatchedRows.length });
});

// Admin: list pending transactions (for admin UI)
app.get('/api/admin/pending', (req, res) => {
  const db = readDb();
  const pending = Object.values(db.transactions).filter(t => t.status === 'pending');
  res.json({ ok:true, pending });
});

// Admin: manual verify
app.post('/api/admin/transactions/:txId/verify', (req, res) => {
  const txId = req.params.txId;
  const db = readDb();
  const tx = db.transactions[txId];
  if (!tx) return res.status(404).json({ ok:false, message:'tx not found' });
  tx.status = 'verified';
  tx.matchedBy = 'admin-manual';
  tx.matchedAt = new Date().toISOString();
  db.transactions[txId] = tx;
  writeDb(db);
  creditUser(tx.userId, tx.credits);
  res.json({ ok:true, txId });
});

// Admin: list all transactions and users (debug)
app.get('/api/admin/db', (req,res) => {
  const db = readDb();
  res.json(db);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server started on ${PORT}`));
