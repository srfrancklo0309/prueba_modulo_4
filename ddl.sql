
CREATE TABLE clients (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(50),
  doc_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clients_doc (doc_id),
  UNIQUE KEY uq_clients_email (email)
);

CREATE TABLE platforms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  UNIQUE KEY uq_platforms_name (name)
);

CREATE TABLE transaction_status (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  UNIQUE KEY uq_platforms_name (name)
);


CREATE TABLE invoices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(255) NOT NULL,
  platform_id BIGINT NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_amount DECIMAL (14,2) NOT NULL,
  amount_paid DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_invoices_platform FOREIGN KEY (platform_id) REFERENCES platforms(id)
);

CREATE TABLE transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  external_ref VARCHAR(255),
  transaction_status BIGINT NOT NULL,
  transaction_type VARCHAR(100) NOT NULL,
  date_transaction DATETIME NOT NULL,
  transaction_amount DECIMAL(14,2) NOT NULL,
  client_id BIGINT NOT NULL,
  invoice_id BIGINT NOT NULL,
  CONSTRAINT fk_txn_transaction_status FOREIGN KEY (transaction_status) REFERENCES transaction_status(id),
    CONSTRAINT fk_txn_client_id FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_txn_invoice_id FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);



-- Basic seed
INSERT INTO platforms (name) VALUES ('Nequi'), ('Daviplata');

INSERT INTO transaction_status (name) VALUES ('pending'), ('failure'), ('complete');
