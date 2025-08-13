import fs from 'fs';
import { parse } from 'csv-parse';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'bd6vf7oy4ftjd9jiw1o3-mysql.services.clever-cloud.com',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'u0d4rbxx4gzbzcyn',
  password: process.env.MYSQL_PASSWORD || 'I1IyJJyhOJFvCiyefSVH',
  database: process.env.MYSQL_DB || 'bd6vf7oy4ftjd9jiw1o3'
});

async function main() {
  console.log('Starting transaction import...');

  const transactions = await new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream('backend/data/transactions.csv')
      .pipe(parse({ columns: true, trim: true }))
      .on('data', row => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', err => reject(err));
  });

  console.log(`Found ${transactions.length} transactions in CSV.`);

  const connection = await pool.getConnection();
  console.log('Database connection established.');

  try {
    await connection.beginTransaction();
    console.log('Transaction started.');

    for (const r of transactions) {
      console.log(`
Processing transaction ID: ${r.id_transaction}`);

      let [invoiceRows] = await connection.execute('SELECT id, platform_id FROM invoices WHERE invoice_number = ?', [r.invoice_id]);
      const invoiceId = invoiceRows[0]?.id;
      const platformId = invoiceRows[0]?.platform_id;

      console.log(`  Invoice lookup for number ${r.invoice_id}: Found ID ${invoiceId} and Platform ID ${platformId}`);

      if (invoiceId) {
        let [existingTransaction] = await connection.execute('SELECT id FROM transactions WHERE external_ref = ?', [r.id_transaction]);
        console.log(`  Checking for existing transaction with external_ref ${r.id_transaction}: Found ${existingTransaction.length} records.`);

        if (existingTransaction.length === 0) {
            const insertParams = [r.id_transaction, r.date_transaction, r.transaction_amount, r.transaction_state, r.transaction_type, r.client_id, invoiceId];
            console.log('  Preparing to insert transaction with params:', insertParams);

            const [result] = await connection.execute(
              'INSERT INTO transactions (external_ref, date_transaction, transaction_amount, transaction_status, transaction_type, client_id, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
              insertParams
            );
            console.log('  Insert result:', result);
        } else {
            console.log('  Skipping transaction as it already exists.');
        }
      } else {
        console.log(`  Skipping transaction because no matching invoice was found for invoice number ${r.invoice_id}`);
      }
    }

    await connection.commit();
    console.log('Transaction committed.');
    console.log('CSV import: DONE ✅');
  } catch (e) {
    await connection.rollback();
    console.error('Transaction rolled back due to error.');
    console.error('CSV import: FAILED ❌', e);
  } finally {
    connection.release();
    console.log('Database connection released.');
    pool.end();
    console.log('Connection pool closed.');
  }
}

main();