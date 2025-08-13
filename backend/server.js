import express from 'express';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import multer from 'multer';
import { parse } from 'csv-parse';

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'bd6vf7oy4ftjd9jiw1o3-mysql.services.clever-cloud.com',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'u0d4rbxx4gzbzcyn',
  password: process.env.MYSQL_PASSWORD || 'I1IyJJyhOJFvCiyefSVH',
  database: process.env.MYSQL_DB || 'bd6vf7oy4ftjd9jiw1o3'
});

// --------- CRUD: clients ---------
app.get('/api/clients', async (_req, res) => {
  const [rows] = await pool.execute('SELECT * FROM clients ORDER BY id DESC');
  res.json(rows);
});

app.get('/api/clients/:id', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM clients WHERE id=?', [req.params.id]);
  if (!rows[0]) return res.sendStatus(404);
  res.json(rows[0]);
});

app.post('/api/clients', upload.single('file'), async (req, res) => {
  if (req.file) {

    const csvData = req.file.buffer.toString('utf8');
    parse(csvData, { columns: true, trim: true }, async (err, records) => {
      if (err) {
        return res.status(400).json({ error: 'Failed to parse CSV file.' });
      }

      try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        for (const record of records) {
          const { client_name, client_email, client_phone, client_document } = record;
          await connection.execute(
            'INSERT INTO clients(full_name, email, phone, doc_id) VALUES(?,?,?,?)',
            [client_name, client_email || null, client_phone || null, client_document || null]
          );
        }

        await connection.commit();
        connection.release();
        res.status(201).json({ message: 'Clients from CSV file imported successfully.' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to import clients from CSV file.' });
      }
    });
  } else {

    const { client_name, client_email, client_phone, client_document } = req.body;
    if (!client_name) return res.status(400).json({ error: 'client_name is required' });
    const [result] = await pool.execute(
      'INSERT INTO clients(full_name, email, phone, doc_id) VALUES(?,?,?,?)',
      [client_name, client_email || null, client_phone || null, client_document || null]
    );
    res.status(201).json({ id: result.insertId, client_name, client_email, client_phone, client_document });
  }
});

app.put('/api/clients/:id', upload.single('file'), async (req, res) => {
  if (req.file) {

    const csvData = req.file.buffer.toString('utf8');
    parse(csvData, { columns: true, trim: true }, async (err, records) => {
      if (err || records.length === 0) {
        return res.status(400).json({ error: 'Failed to parse CSV file or CSV is empty.' });
      }

      const { client_name, client_email, client_phone, client_document } = records[0];

      const [result] = await pool.execute(
        'UPDATE clients SET full_name=?, email=?, phone=?, doc_id=? WHERE id=?',
        [client_name || null, client_email || null, client_phone || null, client_document || null, req.params.id]
      );

      if (result.affectedRows === 0) return res.sendStatus(404);

      const [updatedRow] = await pool.execute('SELECT * FROM clients WHERE id=?', [req.params.id]);
      res.json(updatedRow[0]);
    });
  } else {

    const { client_name, client_email, client_phone, client_document } = req.body;

    const [existingClient] = await pool.execute('SELECT * FROM clients WHERE id=?', [req.params.id]);
    if (!existingClient[0]) return res.sendStatus(404);

    const updatedClient = {
      full_name: client_name || existingClient[0].full_name,
      email: client_email || existingClient[0].email,
      phone: client_phone || existingClient[0].phone,
      doc_id: client_document || existingClient[0].doc_id
    };

    await pool.execute(
      'UPDATE clients SET full_name=?, email=?, phone=?, doc_id=? WHERE id=?',
      [updatedClient.full_name, updatedClient.email, updatedClient.phone, updatedClient.doc_id, req.params.id]
    );

    const [updatedRow] = await pool.execute('SELECT * FROM clients WHERE id=?', [req.params.id]);
    res.json(updatedRow[0]);
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM transactions WHERE client_id=?', [req.params.id]);

    const [result] = await connection.execute('DELETE FROM clients WHERE id=?', [req.params.id]);

    await connection.commit();

    if (result.affectedRows === 0) return res.sendStatus(404);
    res.sendStatus(204);
  } catch (e) {
    await connection.rollback();
    console.error(e);
    res.status(500).json({ error: 'Failed to delete client and associated transactions.' });
  } finally {
    connection.release();
  }
});

// --------- Advanced queries (for Postman) ---------

// 1) Total paid by each client
app.get('/api/queries/total-paid-by-client', async (_req, res) => {
  const [rows] = await pool.execute(`
    SELECT
        c.id AS client_id,
        c.full_name,
        SUM(t.transaction_amount) AS total_paid
    FROM
        clients c
    JOIN
        transactions t ON c.id = t.client_id
    GROUP BY
        c.id, c.full_name
    ORDER BY
        c.full_name;
  `);
  res.json(rows);
});

// 3) Transactions by platform
app.get('/api/queries/transactions-by-platform/:platform', async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT
        t.id AS transaction_id,
        t.external_ref,
        t.date_transaction,
        t.transaction_amount,
        p.name AS platform_name,
        i.invoice_number,
        c.full_name AS client_name
    FROM
        transactions t
    JOIN
        invoices i ON t.invoice_id = i.id
    JOIN
        platforms p ON i.platform_id = p.id
    JOIN
        clients c ON t.client_id = c.id
    WHERE
        p.name = ?
    ORDER BY
        t.date_transaction DESC;
  `, [req.params.platform]);
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
