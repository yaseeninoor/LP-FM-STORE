PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sap_imports (
 id INTEGER PRIMARY KEY AUTOINCREMENT, report_type TEXT NOT NULL,
 imported_by TEXT NOT NULL, imported_at TEXT NOT NULL DEFAULT (datetime('now')),
 row_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS materials (
 material_code TEXT PRIMARY KEY, description TEXT, uom TEXT,
 sap_unrestricted REAL NOT NULL DEFAULT 0,
 stock_date TEXT NOT NULL DEFAULT '2026-11-17',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sap_reservations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, reservation_no TEXT, item_no TEXT,
 requirement_date TEXT, movement_type TEXT, material_code TEXT, description TEXT,
 requirement_qty REAL DEFAULT 0, difference_qty REAL DEFAULT 0, uom TEXT,
 cost_center TEXT, requested_by TEXT, reservation_status TEXT, final_issue TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS sap_pr (
 id INTEGER PRIMARY KEY AUTOINCREMENT, pr_no TEXT, item_no TEXT, po_no TEXT,
 processing_status TEXT, material_code TEXT, description TEXT, requested_qty REAL DEFAULT 0,
 uom TEXT, delivery_date TEXT, pr_date TEXT, storage_location TEXT, requisitioner TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS sap_po (
 id INTEGER PRIMARY KEY AUTOINCREMENT, po_no TEXT, item_no TEXT, material_code TEXT,
 description TEXT, vendor TEXT, order_qty REAL DEFAULT 0, remaining_qty REAL DEFAULT 0,
 unit_price REAL DEFAULT 0, currency TEXT, document_date TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS sap_gate_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT, gate_no TEXT, po_no TEXT, material_code TEXT,
 description TEXT, qty REAL DEFAULT 0, uom TEXT, vendor TEXT, entry_date TEXT, remarks TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS sap_grn (
 id INTEGER PRIMARY KEY AUTOINCREMENT, posting_date TEXT, po_no TEXT, material_code TEXT,
 description TEXT, movement_type TEXT, movement_text TEXT, material_document TEXT,
 qty REAL DEFAULT 0, uom TEXT, storage_location TEXT, reservation_no TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_ref TEXT NOT NULL UNIQUE,
 transaction_date TEXT NOT NULL, transaction_type TEXT NOT NULL, material_code TEXT NOT NULL,
 description TEXT, uom TEXT, qty_in REAL NOT NULL DEFAULT 0, qty_out REAL NOT NULL DEFAULT 0,
 department TEXT, vendor TEXT, pr_no TEXT, po_no TEXT, gate_no TEXT, grn_no TEXT,
 approval_ref TEXT, approval_status TEXT NOT NULL DEFAULT 'Pending',
 qc_status TEXT NOT NULL DEFAULT 'Pending', invoice_no TEXT, created_by TEXT NOT NULL,
 remarks TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cash_purchases (
 id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_ref TEXT NOT NULL UNIQUE,
 purchase_date TEXT NOT NULL, vendor TEXT NOT NULL, invoice_no TEXT, material_code TEXT NOT NULL,
 description TEXT, uom TEXT, qty REAL NOT NULL, unit_price REAL NOT NULL DEFAULT 0,
 currency TEXT NOT NULL DEFAULT 'AED', department TEXT, urgency_reason TEXT,
 approval_status TEXT NOT NULL DEFAULT 'Pending', approved_by TEXT,
 receipt_transaction_ref TEXT, sap_posting_ref TEXT, created_by TEXT NOT NULL,
 remarks TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS department_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT, request_ref TEXT NOT NULL UNIQUE,
 request_date TEXT NOT NULL, department TEXT NOT NULL, material_code TEXT NOT NULL,
 description TEXT, uom TEXT, requested_qty REAL NOT NULL, reservation_no TEXT,
 requested_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', remarks TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, action TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_ref TEXT, details TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_material ON transactions(material_code);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_pr_no ON sap_pr(pr_no);
CREATE INDEX IF NOT EXISTS idx_po_no ON sap_po(po_no);
CREATE INDEX IF NOT EXISTS idx_gate_po ON sap_gate_entries(po_no);
CREATE INDEX IF NOT EXISTS idx_grn_po ON sap_grn(po_no);
