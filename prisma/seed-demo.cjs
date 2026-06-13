/* One-time migration of the app's demo data into the database. Idempotent:
   each table is cleared and recreated, so it can be re-run safely. */
const { PrismaClient } = require("../app/generated/prisma");
const qualityChecklists = require("./quality-checklists.json");
const p = new PrismaClient();

const PROJECTS = {
  p1: "Indiranagar Residence",
  p2: "Whitefield Office",
  p3: "Koramangala Villa",
  p4: "HSR Layout G+3",
  p5: "Jayanagar Apartment",
};

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000);

async function main() {
  // ── Projects ──────────────────────────────────────────────
  await p.appProject.deleteMany({});
  await p.appProject.createMany({
    data: [
      { id: "proj_1", name: PROJECTS.p1, clientName: "Sharma Family", location: "Bengaluru", pct: 65, engineer: "Vikram R.", isDelayed: false, sortOrder: 1 },
      { id: "proj_2", name: PROJECTS.p2, clientName: "TechPark Solutions", location: "Bengaluru", pct: 24, engineer: "Sneha P.", isDelayed: true, sortOrder: 2 },
      { id: "proj_3", name: PROJECTS.p3, clientName: "Reddy Associates", location: "Bengaluru", pct: 89, engineer: "Amit S.", isDelayed: false, sortOrder: 3 },
      { id: "proj_4", name: PROJECTS.p4, clientName: "Prestige Builders", location: "Bengaluru", pct: 42, engineer: "Rahul K.", isDelayed: false, sortOrder: 4 },
      { id: "proj_5", name: PROJECTS.p5, clientName: "Mehta & Sons", location: "Bengaluru", pct: 10, engineer: "Priya M.", isDelayed: false, sortOrder: 5 },
    ],
  });

  // ── Team members ──────────────────────────────────────────
  await p.teamMember.deleteMany({});
  await p.teamMember.createMany({
    data: [
      { name: "Vikram R.", role: "Site Engineer", sortOrder: 1 },
      { name: "Sneha P.", role: "Project Manager", sortOrder: 2 },
      { name: "Amit S.", role: "Site Engineer", sortOrder: 3 },
      { name: "Rahul K.", role: "Site Engineer", sortOrder: 4 },
      { name: "Priya M.", role: "Site Engineer", sortOrder: 5 },
      { name: "Marcus Sterling", role: "Designer", sortOrder: 6 },
      { name: "Elena Rossi", role: "Designer", sortOrder: 7 },
      { name: "Dr. Sarah Laine", role: "Structural Engineer", sortOrder: 8 },
      { name: "Eng. David K.", role: "Site Engineer", sortOrder: 9 },
      { name: "Ar. Sarah Chen", role: "Architect", sortOrder: 10 },
      { name: "Eng. Rajat P.", role: "Site Engineer", sortOrder: 11 },
      { name: "Meera D.", role: "Billing", sortOrder: 12 },
      { name: "Arjun K.", role: "Accounts", sortOrder: 13 },
    ],
  });

  // ── Activity feed ─────────────────────────────────────────
  await p.activityEntry.deleteMany({});
  await p.activityEntry.createMany({
    data: [
      { id: "act_seed_1", icon: "verified", color: "#e30613", route: "/design", text: "Design approved for", bold: PROJECTS.p1, by: "Arjun K.", at: hoursAgo(2), detail: "Design package v3 approved — includes updated floor plans, elevation drawings, and material finishes." },
      { id: "act_seed_2", icon: "priority_high", color: "#ba1a1a", route: "/snags", text: "New snag raised in", bold: PROJECTS.p2, by: "Structural Team", at: hoursAgo(4), detail: "Water seepage on 2nd floor slab. Requires waterproofing inspection before next concrete pour." },
      { id: "act_seed_3", icon: "cloud_upload", color: "#e30613", route: "/orders", text: "Material PO issued for", bold: PROJECTS.p3, by: "Admin", at: hoursAgo(6), detail: "Purchase order #PO-2841 raised for cement and steel — ₹4.6L. Awaiting vendor confirmation." },
      { id: "act_seed_4", icon: "trending_up", color: "#16a34a", route: "/site-progress", text: "Progress updated to 65% on", bold: PROJECTS.p1, by: "Vikram R.", at: hoursAgo(28), detail: "Plastering complete on floors 1–3. Electrical first fix in progress. Next milestone: tiling." },
      { id: "act_seed_5", icon: "receipt_long", color: "#e30613", route: "/orders", text: "Invoice ₹1.2L submitted for", bold: PROJECTS.p3, by: "Accounts", at: hoursAgo(50), detail: "Invoice INV-0092 for tiling works submitted. Payment due in 7 days." },
      { id: "act_seed_6", icon: "check_circle", color: "#16a34a", route: "/quality", text: "Quality check passed for", bold: PROJECTS.p4, by: "Rahul K.", at: hoursAgo(72), detail: "Concrete cube test results within spec — mix design approved for remaining columns." },
    ],
  });

  // ── Snags ─────────────────────────────────────────────────
  await p.snagEntry.deleteMany({});
  await p.snagEntry.createMany({
    data: [
      { id: "#SN-102", projectName: PROJECTS.p1, title: "Master Bedroom", priority: "HIGH PRIORITY", status: "OPEN", description: "Paint peeling near AC duct in the south-west corner of the ceiling. Requires scraping and repaint.", assignee: "Eng. David K.", displayTime: "2 DAYS AGO", closed: false, accent: true, sortOrder: 1 },
      { id: "#SN-105", projectName: PROJECTS.p1, title: "Living Area Balcony", priority: "MEDIUM", status: "OPEN", description: "Alignment issue with the glass railing gaskets. Visual gap of 3mm observed on the left section.", assignee: "Ar. Sarah Chen", displayTime: "5 HOURS AGO", closed: false, accent: false, sortOrder: 2 },
      { id: "#SN-098", projectName: PROJECTS.p2, title: "Kitchen Pantry", priority: "LOW", status: "CLOSED", description: "Hinges for the corner cabinet need tightening and lubrication. Slight squeak on opening.", assignee: "Eng. Rajat P.", displayTime: "RESOLVED 1W AGO", closed: true, accent: false, sortOrder: 3 },
      { id: "#SN-110", projectName: PROJECTS.p3, title: "Bathroom Tiles", priority: "HIGH PRIORITY", status: "OPEN", description: "Cracked tile near shower drain. Water seepage risk if not replaced before waterproofing stage.", assignee: "Eng. David K.", displayTime: "1 DAY AGO", closed: false, accent: true, sortOrder: 4 },
      { id: "#SN-111", projectName: PROJECTS.p4, title: "Staircase Railing", priority: "MEDIUM", status: "OPEN", description: "Railing height is 50mm below code requirement. Needs extension plates welded on top.", assignee: "Ar. Sarah Chen", displayTime: "3 HOURS AGO", closed: false, accent: false, sortOrder: 5 },
    ],
  });

  // ── Design docs ───────────────────────────────────────────
  await p.designDoc.deleteMany({});
  await p.designDoc.createMany({
    data: [
      { id: "f1", icon: "architecture", name: "Master_Plan_V3.pdf", meta: "Architectural Set • 24.5 MB", by: "Marcus Sterling", date: "Oct 24, 2023", status: "Pending Review", feedback: "", sortOrder: 1 },
      { id: "f2", icon: "texture", name: "Material_Specs_Final.rvt", meta: "Revit Model • 142.1 MB", by: "Elena Rossi", date: "Oct 22, 2023", status: "Approved", sortOrder: 2 },
      { id: "f3", icon: "imagesmode", name: "Kitchen_Lighting_Mockups.zip", meta: "Asset Bundle • 89.4 MB", by: "Marcus Sterling", date: "Oct 20, 2023", status: "Changes Needed", feedback: "Lighting temperature does not match spec. Please revise warm-white fixtures on island and peninsula. Reference colour chip #WW3200K.", sortOrder: 3 },
      { id: "f4", icon: "description", name: "Structural_Analysis_B.pdf", meta: "Engineering Report • 5.1 MB", by: "Dr. Sarah Laine", date: "Oct 19, 2023", status: "Approved", sortOrder: 4 },
      { id: "f5", icon: "crop_landscape", name: "Elevation_South_V2.dwg", meta: "CAD Drawing • 8.7 MB", by: "Elena Rossi", date: "Oct 17, 2023", status: "Pending Review", feedback: "", sortOrder: 5 },
      { id: "f6", icon: "bolt", name: "Electrical_Layout_Floor1.pdf", meta: "Engineering Drawing • 3.2 MB", by: "Dr. Sarah Laine", date: "Oct 15, 2023", status: "Approved", sortOrder: 6 },
      { id: "f7", icon: "air", name: "HVAC_Schematic_R1.pdf", meta: "MEP Drawing • 6.9 MB", by: "Marcus Sterling", date: "Oct 13, 2023", status: "Changes Needed", feedback: "Duct routing conflicts with beam on Grid Line C. Coordinate with structural engineer before resubmission.", sortOrder: 7 },
      { id: "f8", icon: "map", name: "Site_Plan_Final.pdf", meta: "Site Layout • 12.3 MB", by: "Elena Rossi", date: "Oct 11, 2023", status: "Approved", sortOrder: 8 },
    ],
  });

  // ── Survey checklist template + surveys ───────────────────
  await p.surveyChecklistCategory.deleteMany({});
  const checklist = [
    { category: "Physical Measurements", items: ["Floor dimensions verified", "Ceiling height measured", "Door/window openings noted", "Structural beam locations marked"], sortOrder: 1 },
    { category: "Site Conditions", items: ["Existing plumbing mapped", "Electrical panel location", "Natural light assessment", "Ventilation points identified"], sortOrder: 2 },
    { category: "Media Documentation", items: ["360° photos captured", "Video walkthrough recorded", "Defect close-ups documented", "Site access points photographed"], sortOrder: 3 },
  ];
  await p.surveyChecklistCategory.createMany({ data: checklist });
  const ALL_ITEMS = checklist.flatMap((c) => c.items);

  await p.surveyEntry.deleteMany({});
  await p.surveyEntry.createMany({
    data: [
      { id: "SS-001", projectName: PROJECTS.p1, date: "Nov 12, 2024", conductor: "Vikram R.", status: "Completed", photos: 18, type: "Initial Recce", notes: "Site access confirmed. All measurements captured. No major structural concerns.", checkedItems: ALL_ITEMS, sortOrder: 1 },
      { id: "SS-002", projectName: PROJECTS.p2, date: "Nov 10, 2024", conductor: "Sneha P.", status: "In Review", photos: 22, type: "Progress Check", notes: "Awaiting sign-off from client. MEP routing flagged for review.", checkedItems: ALL_ITEMS.slice(0, 8), sortOrder: 2 },
      { id: "SS-003", projectName: PROJECTS.p3, date: "Nov 08, 2024", conductor: "Amit S.", status: "Completed", photos: 14, type: "Pre-Handover", notes: "Final walkthrough completed. Snag list shared with client.", checkedItems: ALL_ITEMS, sortOrder: 3 },
      { id: "SS-004", projectName: PROJECTS.p4, date: "Nov 05, 2024", conductor: "Rahul K.", status: "Pending", photos: 0, type: "Initial Recce", notes: "", checkedItems: [], sortOrder: 4 },
    ],
  });

  // ── Audit ─────────────────────────────────────────────────
  await p.auditEntry.deleteMany({});
  const auditSections = [
    { section: "Structural & Civil", items: [
      { label: "Final structural inspection sign-off", signed: true, signedBy: "Vikram R.", date: "Nov 10, 2024" },
      { label: "Waterproofing test completed", signed: true, signedBy: "Amit S.", date: "Nov 09, 2024" },
      { label: "Slab & column compliance verified", signed: false, signedBy: null, date: null },
      { label: "Roof drainage functional test", signed: false, signedBy: null, date: null },
    ]},
    { section: "MEP Commissioning", items: [
      { label: "Electrical load test passed", signed: true, signedBy: "Rahul K.", date: "Nov 11, 2024" },
      { label: "Plumbing pressure test signed", signed: true, signedBy: "Sneha P.", date: "Nov 11, 2024" },
      { label: "HVAC balancing report approved", signed: false, signedBy: null, date: null },
      { label: "Fire suppression system checked", signed: false, signedBy: null, date: null },
    ]},
    { section: "Finishing & Handover", items: [
      { label: "Snag list cleared (zero open snags)", signed: false, signedBy: null, date: null },
      { label: "Client walkthrough conducted", signed: false, signedBy: null, date: null },
      { label: "Measurement book submitted", signed: true, signedBy: "Vikram R.", date: "Nov 12, 2024" },
      { label: "As-built drawings handed over", signed: false, signedBy: null, date: null },
    ]},
    { section: "Documentation", items: [
      { label: "Warranty documents compiled", signed: false, signedBy: null, date: null },
      { label: "Vendor invoices reconciled", signed: true, signedBy: "Sneha P.", date: "Nov 13, 2024" },
      { label: "BOQ vs actual cost statement", signed: false, signedBy: null, date: null },
      { label: "Project closeout report", signed: false, signedBy: null, date: null },
    ]},
  ];
  let auditOrder = 0;
  for (const sec of auditSections) {
    for (const item of sec.items) {
      await p.auditEntry.create({ data: { section: sec.section, label: item.label, signed: item.signed, signedBy: item.signedBy, date: item.date, sortOrder: auditOrder++ } });
    }
  }

  await p.auditProjectRow.deleteMany({});
  await p.auditProjectRow.createMany({
    data: [
      { name: PROJECTS.p1, completion: 78, status: "In Audit", sortOrder: 1 },
      { name: PROJECTS.p3, completion: 95, status: "Near Complete", sortOrder: 2 },
      { name: PROJECTS.p2, completion: 42, status: "Early Stage", sortOrder: 3 },
    ],
  });

  // ── DLP tickets + AMC schedule ────────────────────────────
  await p.dlpTicketEntry.deleteMany({});
  await p.dlpTicketEntry.createMany({
    data: [
      { id: "DLP-021", projectName: PROJECTS.p3, title: "Paint peeling in living room", category: "Finishing", reportedDate: "Nov 01, 2024", dueDate: "Dec 01, 2024", assignee: "Vikram R.", status: "Open", priority: "High", amcDue: null, sortOrder: 1 },
      { id: "DLP-020", projectName: PROJECTS.p1, title: "Door hinge squeak — master bedroom", category: "Joinery", reportedDate: "Oct 28, 2024", dueDate: "Nov 28, 2024", assignee: "Amit S.", status: "In Progress", priority: "Medium", amcDue: null, sortOrder: 2 },
      { id: "DLP-019", projectName: PROJECTS.p2, title: "Annual HVAC filter replacement", category: "AMC", reportedDate: "Oct 20, 2024", dueDate: "Nov 20, 2024", assignee: "Sneha P.", status: "AMC Due", priority: "Scheduled", amcDue: "Nov 20, 2024", sortOrder: 3 },
      { id: "DLP-018", projectName: PROJECTS.p3, title: "Water seepage near window sill", category: "Civil", reportedDate: "Oct 15, 2024", dueDate: "Nov 15, 2024", assignee: "Rahul K.", status: "Resolved", priority: "High", amcDue: null, sortOrder: 4 },
      { id: "DLP-017", projectName: PROJECTS.p1, title: "Electrical socket loose — kitchen", category: "Electrical", reportedDate: "Oct 10, 2024", dueDate: "Nov 10, 2024", assignee: "Vikram R.", status: "Resolved", priority: "Medium", amcDue: null, sortOrder: 5 },
    ],
  });
  await p.amcScheduleEntry.deleteMany({});
  await p.amcScheduleEntry.createMany({
    data: [
      { service: "HVAC Filter Replacement", projectName: PROJECTS.p2, nextDue: "Nov 20, 2024", frequency: "Quarterly", overdue: true, sortOrder: 1 },
      { service: "Elevator Maintenance", projectName: PROJECTS.p4, nextDue: "Dec 05, 2024", frequency: "Monthly", overdue: false, sortOrder: 2 },
      { service: "Fire Extinguisher Check", projectName: PROJECTS.p3, nextDue: "Dec 15, 2024", frequency: "Annual", overdue: false, sortOrder: 3 },
      { service: "Plumbing Inspection", projectName: PROJECTS.p1, nextDue: "Jan 10, 2025", frequency: "Annual", overdue: false, sortOrder: 4 },
    ],
  });

  // ── Site-progress BOQ ─────────────────────────────────────
  await p.boqProgressItem.deleteMany({});
  await p.boqProgressItem.createMany({
    data: [
      { name: "Internal Plastering", category: "Civil Works", status: "In Progress", budgeted: "₹45,000.00", installed: "₹32,400.00", pct: 72, sortOrder: 1 },
      { name: "Electrical Concealing", category: "MEP", status: "In Progress", budgeted: "₹28,000.00", installed: "₹11,200.00", pct: 40, sortOrder: 2 },
      { name: "Brick Work – Floor 4", category: "Civil Works", status: "Completed", budgeted: "₹62,500.00", installed: "₹62,500.00", pct: 100, sortOrder: 3 },
      { name: "Tiling – Bathrooms", category: "Finishing", status: "Delayed", budgeted: "₹18,700.00", installed: "₹1,496.00", pct: 8, sortOrder: 4 },
      { name: "AC Ducting Installation", category: "HVAC", status: "Scheduled", budgeted: "₹84,000.00", installed: "₹0.00", pct: 0, sortOrder: 5 },
    ],
  });

  // ── Site expenses + vendor scope ──────────────────────────
  await p.siteExpenseEntry.deleteMany({});
  await p.siteExpenseEntry.createMany({
    data: [
      { id: "EXP-001", category: "Materials", description: "Cement bags – 120 units", projectName: PROJECTS.p1, amount: "₹6,000", amountNum: 6000, date: "Nov 08, 2024", by: "Vikram R.", status: "Paid", pmApprovedBy: "Vikram R.", billingApprovedBy: "Meera D.", accountsApprovedBy: "Arjun K.", sortOrder: 1 },
      { id: "EXP-002", category: "Labor", description: "Daily labor – 12 workers × 3 days", projectName: PROJECTS.p2, amount: "₹7,200", amountNum: 7200, date: "Nov 07, 2024", by: "Sneha P.", status: "Pending Accounts Approval", pmApprovedBy: "Sneha P.", billingApprovedBy: "Meera D.", sortOrder: 2 },
      { id: "EXP-003", category: "Equipment", description: "Scaffolding rental – 2 weeks", projectName: PROJECTS.p3, amount: "₹4,500", amountNum: 4500, date: "Nov 06, 2024", by: "Amit S.", status: "Pending Billing Approval", pmApprovedBy: "Amit S.", sortOrder: 3 },
      { id: "EXP-004", category: "Miscellaneous", description: "Site permits and fees", projectName: PROJECTS.p4, amount: "₹1,800", amountNum: 1800, date: "Nov 05, 2024", by: "Rahul K.", status: "Pending PM Approval", sortOrder: 4 },
      { id: "EXP-005", category: "Materials", description: "Reinforcement bars – 5 MT", projectName: PROJECTS.p1, amount: "₹18,500", amountNum: 18500, date: "Nov 04, 2024", by: "Vikram R.", status: "Pending PM Approval", sortOrder: 5 },
    ],
  });
  await p.vendorScopeEntry.deleteMany({});
  await p.vendorScopeEntry.createMany({
    data: [
      { id: "VS-001", vendor: "Blackwood Stonemasons Ltd.", projectName: PROJECTS.p1, scope: "Stone cladding – main facade (Ground + 2 floors)", progress: 65, status: "In Progress", dueDate: "Dec 15, 2024", sortOrder: 1 },
      { id: "VS-002", vendor: "Imperial Steel Works", projectName: PROJECTS.p2, scope: "Structural steel frame – Floors 3 to 7", progress: 30, status: "In Progress", dueDate: "Jan 10, 2025", sortOrder: 2 },
      { id: "VS-003", vendor: "Glass & Light Studios", projectName: PROJECTS.p3, scope: "Custom glazing – all openings incl. skylight", progress: 0, status: "Not Started", dueDate: "Feb 05, 2025", sortOrder: 3 },
      { id: "VS-004", vendor: "Oak & Grain Joinery", projectName: PROJECTS.p1, scope: "Joinery and millwork – kitchens and wardrobes", progress: 100, status: "Completed", dueDate: "Oct 30, 2024", sortOrder: 4 },
      { id: "VS-005", vendor: "Elite Electrical Solutions", projectName: PROJECTS.p4, scope: "Electrical first fix – all floors", progress: 20, status: "Delayed", dueDate: "Nov 30, 2024", sortOrder: 5 },
    ],
  });

  // ── Quality inspections + checklist ───────────────────────
  await p.qualityInspection.deleteMany({});
  await p.qualityInspection.createMany({
    data: [
      { id: "QC-041", projectName: PROJECTS.p1, area: "Master Bedroom", category: "Finishing", inspector: "Vikram R.", date: "Nov 14, 2024", result: "Pass", score: 94, remarks: "", sortOrder: 1 },
      { id: "QC-040", projectName: PROJECTS.p2, area: "Reception Lobby", category: "Civil Works", inspector: "Sneha P.", date: "Nov 13, 2024", result: "Fail", score: 61, remarks: "Honeycombing observed on lobby column — rework required.", sortOrder: 2 },
      { id: "QC-039", projectName: PROJECTS.p3, area: "Kitchen", category: "MEP", inspector: "Amit S.", date: "Nov 12, 2024", result: "Pass", score: 88, remarks: "", sortOrder: 3 },
      { id: "QC-038", projectName: PROJECTS.p4, area: "Staircase", category: "Civil Works", inspector: "Rahul K.", date: "Nov 11, 2024", result: "Conditional", score: 74, remarks: "Minor alignment deviation — acceptable with touch-up.", sortOrder: 4 },
      { id: "QC-037", projectName: PROJECTS.p1, area: "Bathrooms", category: "Plumbing", inspector: "Vikram R.", date: "Nov 10, 2024", result: "Pass", score: 91, remarks: "", sortOrder: 5 },
    ],
  });
  // Work-type checklist templates imported from the SMPL quality-control
  // workbook (prisma/quality-checklists.json, generated by import-quality-checklists.cjs).
  await p.qualityChecklistCategory.deleteMany({});
  await p.qualityChecklistTemplate.deleteMany({});
  for (let t = 0; t < qualityChecklists.length; t++) {
    const tpl = qualityChecklists[t];
    await p.qualityChecklistTemplate.create({
      data: {
        id: tpl.id,
        name: tpl.name,
        discipline: tpl.discipline,
        sortOrder: t,
        categories: {
          create: tpl.categories.map((c, i) => ({ name: c.name, items: c.items, sortOrder: i })),
        },
      },
    });
  }

  // ── ERP integration ───────────────────────────────────────
  await p.erpIntegration.deleteMany({});
  await p.erpIntegration.createMany({
    data: [
      { id: "tally", name: "Tally Prime", category: "Accounting", description: "Sync purchase orders, vendor invoices, and ledger entries with Tally.", icon: "account_balance", iconBg: "#1b1c1c", iconColor: "#ffffff", status: "connected", lastSync: "Today, 09:14 AM", recordsSynced: 1284, enabled: true, apiKey: "TP-••••••••3f2a", endpoint: "https://tally.studiomasons.in/api", sortOrder: 1 },
      { id: "zoho", name: "Zoho CRM", category: "Client Management", description: "Push project milestones and pull client details from Zoho CRM.", icon: "contacts", iconBg: "#e30613", iconColor: "#ffffff", status: "connected", lastSync: "Today, 07:30 AM", recordsSynced: 342, enabled: true, apiKey: "ZC-••••••••9d7b", endpoint: "https://crm.zoho.in/api/v2", sortOrder: 2 },
      { id: "razorpay", name: "Razorpay", category: "Payments", description: "Reconcile payment receipts and vendor disbursements automatically.", icon: "payments", iconBg: "#0059a8", iconColor: "#ffffff", status: "error", lastSync: "Yesterday, 11:45 PM", recordsSynced: 89, enabled: true, apiKey: "RZP-••••••••a1c4", endpoint: "https://api.razorpay.com/v1", sortOrder: 3 },
      { id: "gdrive", name: "Google Drive", category: "Documents", description: "Auto-upload approved design files and site images to Drive folders.", icon: "folder_shared", iconBg: "#16a34a", iconColor: "#ffffff", status: "connected", lastSync: "Today, 10:02 AM", recordsSynced: 2031, enabled: true, apiKey: "GD-••••••••b8f1", endpoint: "https://www.googleapis.com/drive/v3", sortOrder: 4 },
      { id: "whatsapp", name: "WhatsApp Business", category: "Communication", description: "Send snag alerts, approval requests, and DPR summaries via WhatsApp.", icon: "chat", iconBg: "#25D366", iconColor: "#ffffff", status: "disconnected", lastSync: null, recordsSynced: 0, enabled: false, apiKey: "", endpoint: "", sortOrder: 5 },
      { id: "bim360", name: "Autodesk BIM 360", category: "Design", description: "Sync RVT models and CAD drawings bi-directionally with BIM 360.", icon: "architecture", iconBg: "#e87722", iconColor: "#ffffff", status: "disconnected", lastSync: null, recordsSynced: 0, enabled: false, apiKey: "", endpoint: "", sortOrder: 6 },
    ],
  });
  await p.erpSyncLog.deleteMany({});
  await p.erpSyncLog.createMany({
    data: [
      { id: "L001", integration: "Tally Prime", event: "Invoice batch pushed (12 records)", status: "success", records: 12, timestamp: "Today, 09:14 AM", duration: "1.2s", sortOrder: 1 },
      { id: "L002", integration: "Google Drive", event: "Design files uploaded (7 files)", status: "success", records: 7, timestamp: "Today, 10:02 AM", duration: "4.8s", sortOrder: 2 },
      { id: "L003", integration: "Razorpay", event: "Payment reconciliation failed", status: "failed", records: 0, timestamp: "Yesterday, 11:45 PM", duration: "—", sortOrder: 3 },
      { id: "L004", integration: "Zoho CRM", event: "Client records pulled (5 updates)", status: "success", records: 5, timestamp: "Today, 07:30 AM", duration: "0.9s", sortOrder: 4 },
      { id: "L005", integration: "Tally Prime", event: "PO sync — 2 items skipped (duplicate)", status: "warning", records: 18, timestamp: "Yesterday, 06:00 PM", duration: "2.1s", sortOrder: 5 },
      { id: "L006", integration: "Google Drive", event: "Site images synced", status: "success", records: 23, timestamp: "Yesterday, 03:15 PM", duration: "6.2s", sortOrder: 6 },
      { id: "L007", integration: "Zoho CRM", event: "Milestone update pushed", status: "success", records: 3, timestamp: "Yesterday, 12:00 PM", duration: "0.5s", sortOrder: 7 },
      { id: "L008", integration: "Razorpay", event: "Webhook signature mismatch — retry 1/3", status: "failed", records: 0, timestamp: "Yesterday, 11:44 PM", duration: "—", sortOrder: 8 },
    ],
  });
  await p.erpFieldMapping.deleteMany({});
  await p.erpFieldMapping.createMany({
    data: [
      { erpField: "Invoice ID", externalField: "invoice_number", integration: "Tally Prime", type: "String", direction: "push", sortOrder: 1 },
      { erpField: "Vendor Name", externalField: "party_name", integration: "Tally Prime", type: "String", direction: "push", sortOrder: 2 },
      { erpField: "Invoice Amount", externalField: "amount", integration: "Tally Prime", type: "Number", direction: "push", sortOrder: 3 },
      { erpField: "Due Date", externalField: "due_date", integration: "Tally Prime", type: "Date", direction: "push", sortOrder: 4 },
      { erpField: "Client Name", externalField: "Account_Name", integration: "Zoho CRM", type: "String", direction: "both", sortOrder: 5 },
      { erpField: "Project Status", externalField: "Deal_Stage", integration: "Zoho CRM", type: "Enum", direction: "push", sortOrder: 6 },
      { erpField: "Project Budget", externalField: "Amount", integration: "Zoho CRM", type: "Number", direction: "pull", sortOrder: 7 },
      { erpField: "Payment Receipt", externalField: "payment_id", integration: "Razorpay", type: "String", direction: "pull", sortOrder: 8 },
      { erpField: "Payment Amount", externalField: "amount", integration: "Razorpay", type: "Number", direction: "pull", sortOrder: 9 },
      { erpField: "Design File URL", externalField: "webViewLink", integration: "Google Drive", type: "URL", direction: "pull", sortOrder: 10 },
    ],
  });
  await p.erpWebhook.deleteMany({});
  await p.erpWebhook.createMany({
    data: [
      { id: "WH001", name: "Invoice Approved", url: "https://hooks.studiomasons.in/invoice-approved", events: ["invoice.approved", "invoice.paid"], status: "active", lastTriggered: "Today, 09:14 AM", successRate: 100, sortOrder: 1 },
      { id: "WH002", name: "Snag Raised", url: "https://hooks.studiomasons.in/snag-created", events: ["snag.created", "snag.updated"], status: "active", lastTriggered: "Yesterday, 04:30 PM", successRate: 97, sortOrder: 2 },
      { id: "WH003", name: "Design Approved", url: "https://hooks.studiomasons.in/design-approval", events: ["design.approved"], status: "active", lastTriggered: "2 days ago", successRate: 100, sortOrder: 3 },
      { id: "WH004", name: "Payment Received", url: "https://hooks.razorpay.com/studiomasons", events: ["payment.captured", "payment.failed"], status: "failing", lastTriggered: "Yesterday, 11:44 PM", successRate: 43, sortOrder: 4 },
      { id: "WH005", name: "BOQ Milestone", url: "https://hooks.studiomasons.in/boq-milestone", events: ["boq.milestone_reached"], status: "inactive", lastTriggered: "Never", successRate: 0, sortOrder: 5 },
    ],
  });

  // ── Purchase orders, invoices, payment requests ───────────
  await p.purchaseOrderLine.deleteMany({});
  await p.purchaseOrder.deleteMany({});
  await p.purchaseOrder.createMany({
    data: [
      { projectId: "proj_1", projectName: PROJECTS.p1, vendorName: "Blackwood Stonemasons Ltd.", poNumber: "PO-2841", poValue: 50000, poFileName: "PO-2841.pdf", acceptanceFileName: "ACC-2841.pdf", advanceRequested: 8000, advanceApproved: true, advanceTdsPct: 2, advancePayable: 7840, advanceConsumed: 0 },
      { projectId: "proj_1", projectName: PROJECTS.p1, vendorName: "Oak & Grain Joinery", poNumber: "PO-2842", poValue: 30000, poFileName: "PO-2842.pdf", acceptanceFileName: "ACC-2842.pdf", advanceRequested: 5000, advanceApproved: true, advanceTdsPct: 2, advancePayable: 4900, advanceConsumed: 0 },
      { projectId: "proj_2", projectName: PROJECTS.p2, vendorName: "Imperial Steel Works", poNumber: "PO-2843", poValue: 40000, poFileName: "PO-2843.pdf" },
      { projectId: "proj_3", projectName: PROJECTS.p3, vendorName: "Glass & Light Studios", poNumber: "PO-2844", poValue: 25000, poFileName: "PO-2844.pdf" },
      { projectId: "proj_3", projectName: PROJECTS.p3, vendorName: "Premier Tiling Co.", poNumber: "PO-2845", poValue: 20000, poFileName: "PO-2845.pdf" },
      { projectId: "proj_4", projectName: PROJECTS.p4, vendorName: "Elite Electrical Solutions", poNumber: "PO-2846", poValue: 15000, poFileName: "PO-2846.pdf" },
      { projectId: "proj_4", projectName: PROJECTS.p4, vendorName: "Blackwood Stonemasons Ltd.", poNumber: "PO-2847", poValue: 20000, poFileName: "PO-2847.pdf" },
    ],
  });

  await p.vendorInvoice.deleteMany({});
  await p.vendorInvoice.createMany({
    data: [
      { id: "SM-INV-4902", vendor: "Blackwood Stonemasons Ltd.", project: PROJECTS.p1, amount: "₹14,250", amountNum: 14250, due: "Oct 24, 2023", status: "Approval Pending", baseValue: 12076, sgstPct: 9, cgstPct: 9, requestedAmount: 0 },
      { id: "SM-INV-4899", vendor: "Imperial Steel Works", project: PROJECTS.p2, amount: "₹8,900", amountNum: 8900, due: "Oct 22, 2023", status: "Approved", baseValue: 7542, sgstPct: 9, cgstPct: 9, amountPayable: 8900, requestedAmount: 8500 },
      { id: "SM-INV-4885", vendor: "Glass & Light Studios", project: PROJECTS.p3, amount: "₹11,420", amountNum: 11420, due: "Oct 15, 2023", status: "Rejected", baseValue: 9678, sgstPct: 9, cgstPct: 9, requestedAmount: 0 },
      { id: "SM-INV-4872", vendor: "Oak & Grain Joinery", project: PROJECTS.p1, amount: "₹6,750", amountNum: 6750, due: "Oct 12, 2023", status: "Approved", baseValue: 5720, sgstPct: 9, cgstPct: 9, amountPayable: 6750, requestedAmount: 0 },
      { id: "SM-INV-4850", vendor: "Elite Electrical Solutions", project: PROJECTS.p4, amount: "₹4,300", amountNum: 4300, due: "Oct 08, 2023", status: "Approved", baseValue: 3644, sgstPct: 9, cgstPct: 9, amountPayable: 4300, requestedAmount: 3000 },
      { id: "SM-INV-4833", vendor: "Premier Tiling Co.", project: PROJECTS.p3, amount: "₹9,800", amountNum: 9800, due: "Oct 05, 2023", status: "Approval Pending", baseValue: 8305, sgstPct: 9, cgstPct: 9, requestedAmount: 0 },
      { id: "SM-INV-4820", vendor: "Blackwood Stonemasons Ltd.", project: PROJECTS.p4, amount: "₹7,100", amountNum: 7100, due: "Oct 02, 2023", status: "Approved", baseValue: 6017, sgstPct: 9, cgstPct: 9, amountPayable: 7100, requestedAmount: 0 },
    ],
  });

  await p.paymentRequest.deleteMany({});
  await p.paymentRequest.createMany({
    data: [
      { id: "PR-001", vendor: "Blackwood Stonemasons Ltd.", project: PROJECTS.p1, amount: "₹8,500", amountNum: 8500, requested: "Nov 05, 2024", status: "Pending Accounts Approval", notes: "Advance for stone cladding – phase 2 materials", invoiceRef: "SM-INV-4899", priority: "Medium" },
      { id: "PR-002", vendor: "Imperial Steel Works", project: PROJECTS.p2, amount: "₹12,300", amountNum: 12300, requested: "Nov 03, 2024", status: "Approved by Accounts", priority: "High" },
      { id: "PR-003", vendor: "Glass & Light Studios", project: PROJECTS.p3, amount: "₹3,200", amountNum: 3200, requested: "Oct 29, 2024", status: "Paid", priority: "Low" },
      { id: "PR-004", vendor: "Elite Electrical Solutions", project: PROJECTS.p4, amount: "₹3,000", amountNum: 3000, requested: "Oct 25, 2024", status: "Pending Accounts Approval", invoiceRef: "SM-INV-4850", priority: "Medium" },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
