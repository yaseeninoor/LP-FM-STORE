# LP FM Store

Private FM Store tracking website for SAP ECC report imports, stock tracking, cash purchases, receipts, department requests and stock movements.

## Important operating rules
- This is a tracking and reconciliation tool beside SAP ECC. It does not post into SAP.
- SAP remains the official inventory/accounting record.
- Do not count PO-pending or GRN-pending goods as SAP unrestricted stock.
- Do not issue QC-controlled material before required Quality release.
- Emergency issues require the company's written approval process and subsequent SAP reconciliation.
- Do not upload company records to Cloudflare until authorised by company IT/security.

## Stack
- Cloudflare Pages + Pages Functions
- Cloudflare D1
- Cloudflare Access for authentication
- GitHub private repository

## Deploy
1. Create D1 database named lp-fm-store-db.
2. Put its ID into wrangler.toml.
3. Apply migrations: `npx wrangler d1 execute lp-fm-store-db --remote --file=./migrations/0001_init.sql`
4. In Cloudflare Pages connect this repository; framework None; build command blank; output directory public.
5. Add D1 binding named DB.
6. Protect the Pages hostname with Cloudflare Access.
7. Add Pages environment variables:
   - ACCESS_TEAM_DOMAIN (example: team.cloudflareaccess.com)
   - ACCESS_AUD (Access application AUD tag)
   - ADMIN_EMAILS (comma-separated lowercase email addresses)
   - STORE_STAFF_EMAILS (comma-separated lowercase email addresses)
   - DEPARTMENT_EMAILS (comma-separated lowercase email addresses)
8. Import the latest full SAP reports in the SAP Import page.

## SAP import headings
Stock: Material, Material Description, Base Unit of Measure, Unrestricted.
Reservation: Reservation, Item No.Stock Transfer Reserv., Requirement Date, Movement Type, Material, Material Description, Requirement Quantity, Difference Quantity, Base Unit of Measure, Cost Center, User name, Reserv. status, Final Issue.
PR: Purchase Requisition, Item of Requisition, Purchase Order, Processing status, Material, Short Text, Quantity Requested, Unit of Measure, Delivery Date, Requisition Date, Storage Location, Requisitioner.
PO: Purchasing Document, Item, Material, Short Text, Name of Vendor, Order Quantity, Still to be delivered (qty), Net price, Currency, Document Date.
Gate Entry: Gate Entry Number, PO Number, Material No, Material Info, Quantity, UoM, Party Name, Created On, Remarks.
GRN: Posting Date, Purchase Order, Material, Material Description, Movement Type, Movement Type Text, Material Document, Qty in Un. of Entry, Base Unit of Measure, Storage Location, Reservation.

The PR import skips blank/header summary rows without a Purchase Requisition.

## Limitations
- No direct SAP integration. Import SAP XLSX reports manually.
- Department requests are requests only; they do not create SAP reservations.
- Role allow-lists are a starter configuration. Confirm the company identity/access model with IT before production.
- Test with non-sensitive sample data and verify backups before real use.
