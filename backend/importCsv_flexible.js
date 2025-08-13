import fs from 'fs';
import { parse } from 'csv-parse';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import path from 'path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node importCsv_flexible.js <path_to_csv_file>');
  process.exit(1);
}


const tableName = path.basename(filePath, '.csv');

const columnMappings = {
  clients: {
    client_id: 'id',
    client_name: 'full_name',
    client_document: 'doc_id',
    client_phone: 'phone',
    client_email: 'email'
  },
  transactions: {
    date_transaction: 'date_transaction',
    transaction_amount: 'transaction_amount',
    transaction_state: 'transaction_status',
    transaction_type: 'transaction_type',
    client_id: 'client_id',
    invoice_id: 'invoice_id'
  },
  invoices: {
    invoice_number: 'invoice_number',
    invoice_date: 'invoice_date',
    invoice_amount: 'invoice_amount',
    amount_paid: 'amount_paid',
    platform_id: 'platform_id'
  },
  platforms: {
    platform_id: 'id',
    platform_name: 'name'
  }
};

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'bd6vf7oy4ftjd9jiw1o3-mysql.services.clever-cloud.com',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'u0d4rbxx4gzbzcyn',
  password: process.env.MYSQL_PASSWORD || 'I1IyJJyhOJFvCiyefSVH',
  database: process.env.MYSQL_DB || 'bd6vf7oy4ftjd9jiw1o3'
});

const rows = [];
fs.createReadStream(filePath)
  .pipe(parse({ columns: true, trim: true }))
  .on('data', (row) => {
    rows.push(row);
  })
  .on('end', async () => {
    if (rows.length === 0) {
      console.log('No rows to import.');
      process.exit(0);
    }

    const tableMapping = columnMappings[tableName] || {};
    const csvHeaders = Object.keys(rows[0]);
    const dbColumns = csvHeaders.map(header => tableMapping[header]).filter(Boolean);

    if (dbColumns.length === 0) {
        console.error("No columns to import. Check your mapping.");
        process.exit(1);
    }

    const sql = `INSERT IGNORE INTO ${tableName} (${dbColumns.map(c => `\`${c}\``).join(', ')}) VALUES ?`;

    const values = rows.map(row => {
        return dbColumns.map(dbCol => {
            const csvHeader = Object.keys(tableMapping).find(key => tableMapping[key] === dbCol);
            return row[csvHeader];
        });
    });

    try {
      await pool.query('START TRANSACTION');
      await pool.query(sql, [values]);
      await pool.query('COMMIT');
      console.log(`CSV import to '${tableName}' table: DONE ✅`);
      process.exit(0);
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error(`CSV import to '${tableName}' table: FAILED ❌`, e);
      process.exit(1);
    }
  });
