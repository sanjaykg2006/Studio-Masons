/* Removes the demo data inserted by seed-demo.cjs. Targets the seeded rows by the
   exact ids / PO numbers the seed used, so anything you've created yourself is left
   untouched. The pure-template tables (no user-created rows exist for them) are
   cleared fully. Safe to re-run.

   Run with:  node -r dotenv/config prisma/clear-demo.cjs   (loads DATABASE_URL from .env) */
require("dotenv").config();
const { PrismaClient } = require("../app/generated/prisma");
const p = new PrismaClient();

// Seeded primary keys, table by table.
const IDS = {
  appProject: ["proj_1", "proj_2", "proj_3", "proj_4", "proj_5"],
  activityEntry: ["act_seed_1", "act_seed_2", "act_seed_3", "act_seed_4", "act_seed_5", "act_seed_6"],
  snagEntry: ["#SN-102", "#SN-105", "#SN-098", "#SN-110", "#SN-111"],
  designDoc: ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"],
  surveyEntry: ["SS-001", "SS-002", "SS-003", "SS-004"],
  dlpTicketEntry: ["DLP-021", "DLP-020", "DLP-019", "DLP-018", "DLP-017"],
  siteExpenseEntry: ["EXP-001", "EXP-002", "EXP-003", "EXP-004", "EXP-005"],
  vendorScopeEntry: ["VS-001", "VS-002", "VS-003", "VS-004", "VS-005"],
  qualityInspection: ["QC-041", "QC-040", "QC-039", "QC-038", "QC-037"],
  erpIntegration: ["tally", "zoho", "razorpay", "gdrive", "whatsapp", "bim360"],
  erpSyncLog: ["L001", "L002", "L003", "L004", "L005", "L006", "L007", "L008"],
  erpWebhook: ["WH001", "WH002", "WH003", "WH004", "WH005"],
  vendorInvoice: ["SM-INV-4902", "SM-INV-4899", "SM-INV-4885", "SM-INV-4872", "SM-INV-4850", "SM-INV-4833", "SM-INV-4820"],
  paymentRequest: ["PR-001", "PR-002", "PR-003", "PR-004"],
};

const SEED_PO_NUMBERS = ["PO-2841", "PO-2842", "PO-2843", "PO-2844", "PO-2845", "PO-2846", "PO-2847"];

async function main() {
  // Delete by-id rows.
  for (const [model, ids] of Object.entries(IDS)) {
    const res = await p[model].deleteMany({ where: { id: { in: ids } } });
    console.log(`${model}: removed ${res.count}`);
  }

  // Purchase orders: only the seeded PO numbers (lines cascade via the relation).
  const seedPOs = await p.purchaseOrder.findMany({ where: { poNumber: { in: SEED_PO_NUMBERS } }, select: { id: true } });
  if (seedPOs.length) {
    await p.purchaseOrderLine.deleteMany({ where: { poId: { in: seedPOs.map((x) => x.id) } } });
    const res = await p.purchaseOrder.deleteMany({ where: { id: { in: seedPOs.map((x) => x.id) } } });
    console.log(`purchaseOrder: removed ${res.count}`);
  } else {
    console.log("purchaseOrder: removed 0");
  }

  // Pure template/demo tables that have no user-created equivalent — clear fully.
  const templateTables = [
    "teamMember",
    "surveyChecklistCategory",
    "auditEntry",
    "auditProjectRow",
    "amcScheduleEntry",
    "boqProgressItem",
    "qualityChecklistCategory",
    "erpFieldMapping",
  ];
  for (const model of templateTables) {
    const res = await p[model].deleteMany({});
    console.log(`${model}: cleared ${res.count}`);
  }

  console.log("Demo data cleared.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
