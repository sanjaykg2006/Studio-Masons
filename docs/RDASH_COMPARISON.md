
# RDash vs. Studio Masons ERP — Structure, Gap Analysis & Roadmap

_Prepared June 2026. Sources for RDash details are listed at the bottom._

This document maps the full product structure of **RDash** (rdash.io / rdash.ai), inventories what **Studio Masons ERP** already has, and lays out what we could add — ranked by how easy it is, given our current codebase.

---

## 1. RDash — full product structure

RDash positions itself as "the simplest construction management software" for interior designers, design-&-build firms, contractors, and developers. Its pitch is a **single connected workflow**: design → BOQ → procurement → finance → site, all sharing the same data. The key idea is that **one BOQ document drives the budget, the procurement, the change orders, and the billing milestones**.

### A. Pre-sales / Project setup
- **CRM / Pre-sales** — manage leads, send quotations, convert a won lead into a project.
- **Activity Schedule** — Gantt charts with task dependencies and deadline tracking.

### B. Design
- **Design Management** — share drawings, version control, revision history, client/internal approvals.

### C. BOQ & scope (the spine of the product)
- **BOQ Management** — create the Bill of Quantities; it becomes the single source of truth for budget + procurement + billing.
- **Change Orders** — documented, approved changes to the BOQ.
- **Bill of Materials (BOM)** — break each BOQ scope item down into standard materials.
- **Element Master / Element Libraries** — a master catalog of work elements and specifications that rate contracts and BOQs reference.

### D. Procurement
- **Rate Contracts** — pre-agreed vendor rates linked to the Element Master; these automate procurement.
- **Purchase Requests** — site team requests materials; runs through approval controls.
- **Vendor Orders (POs)** — PO automation with tax configuration.
- **Vendor Invoices** — invoice capture against POs, with a **3-way check** (PO ↔ goods received ↔ invoice).
- **AI reverse bidding & quote comparison** — vendors bid, system compares quotes.

### E. Materials / Site stores
- **Material Management** — Goods Receipt Notes (GRN) and site-store issuance.
- **Installed Progress Tracking** — measure work value actually installed (drives cashflow).

### F. Finance
- **Invoicing & Payments** — vendor billing, approvals, payments.
- **Site Expense Tracking** — capture and control site expenses via mobile app.
- **Cashflow dashboards** — invoice aging, installed-progress-based cash visibility.

### G. Site management
- **Site Survey** — mobile site assessment.
- **DPR (Daily Progress Report)** — automated real-time progress reporting.
- **Snag Management** — quality issues, linked back to the supplier order responsible.
- **Joint Measurement / Handover** — record joint measurements, manage handover documents.

### H. Platform / cross-cutting
- **Approval Hierarchy** — configurable multi-stage approvals for POs, invoices, payments, expenses.
- **RDash AI Copilot** — analytics + "get things done with prompts".
- **Task Manager** — contextual collaboration workspace.
- **Third-party collaborators** — supplier/client login access.
- **Analytics** — 50+ customizable dashboards/reports.
- **Integrations** — Tally, Zoho, Odoo, SAP, Microsoft Business Central, Oracle, OpenERP.

---

## 2. Studio Masons ERP — what we have today

Modules currently in the app (from the sidebar + pages):

| Module | Route | What it does today |
|---|---|---|
| **Dashboard** | `/dashboard` | Project overview, **Add Vendor + PO** flow, PO acceptance + advance approval, payables view, activity feed |
| **Site Survey** | `/site-survey` | Site assessment records |
| **Design Management** | `/design` | Drawing/design file uploads, versions, approval status |
| **Orders & Expense** | `/orders` | 4 tabs: **Vendor Invoices**, **Vendor Payment Requests**, **Site Expense Tracking**, **Vendor Scope & Progress** — with PO-gated invoice upload, GST/TDS/retention/advance math, multi-stage approval chains (PM → Billing → Accounts) |
| **Quality Checks** | `/quality` | Quality checklists |
| **Snags** | `/snags` | Snag logging (priority, status, photos, assignee) |
| **Site Progress** | `/site-progress` | Completion % logging |
| **Audit** | `/audit` | Audit checklist sign-off |
| **DLP** | `/dlp` | Defect Liability Period tickets / AMC due dates |
| **ERP Integration** | `/erp-integration` | Sync scope/PO status to external ERP (stub) |
| **Settings** | `/settings` | Team & Roles (invite, role assignment, removal), Profile (photo, password) |

**Auth & roles:** Supabase Auth + Prisma `User` with roles `ADMIN, PROJECT_MANAGER, DESIGNER, SITE_ENGINEER, FINANCE, CLIENT`.

**Database models (Prisma):** `User, Project, SiteSurvey, DesignFile, Order (vendor invoice), VendorPayment, SiteExpense, Snag, BOQItem, ProjectSchedule, GRNEntry, AuditItem, DLPTicket, ERPSync, ActivityLog`.

### ⚠️ Two important realities about our current state
1. **POs, invoices, payment requests, expenses and vendor-scope all live in the browser** (`ProjectContext`, saved to `localStorage`) — **not in the database.** They reset per-browser. The Prisma tables exist for some of these but aren't wired to the UI yet.
2. **`BOQItem` and `ProjectSchedule` and `GRNEntry` tables exist in the schema but have no UI** — they're modelled but unused. This is actually good news: the data foundation for BOQ, scheduling, and GRN is already designed.

---

## 3. Side-by-side gap analysis

Legend: ✅ have it · 🟡 partial · ❌ missing

| RDash capability | Us | Notes |
|---|---|---|
| Project management / overview | ✅ | Dashboard exists |
| Activity Schedule / Gantt | 🟡 | `ProjectSchedule` table exists, no UI |
| Design management + approvals | ✅ | `/design` |
| Site Survey | ✅ | `/site-survey` |
| Snag management | ✅ | `/snags` |
| Site progress / DPR | 🟡 | `/site-progress` exists; not a daily auto-report |
| Quality checks | ✅ | `/quality` (RDash folds this into snags) |
| Audit / sign-off | ✅ | `/audit` (RDash has handover docs instead) |
| DLP / AMC | ✅ | `/dlp` (RDash doesn't headline this — nice differentiator for us) |
| **BOQ management** | 🟡 | `BOQItem` table exists, **no UI** |
| **Change orders** | ❌ | not modelled |
| **Bill of Materials (scope → materials)** | ❌ | not modelled |
| **Element Master / catalog** | ❌ | no vendor or service/element catalog; vendors are free-text |
| **Rate contracts** | 🟡 | "fixed contract period" exists on POs; no rate catalog |
| **Purchase Orders (proper)** | 🟡 | exist in `localStorage` only, not DB |
| Purchase Requests (site-initiated) | ❌ | not built |
| Vendor invoices + PO gating | ✅ | strong — already enforces PO cap, contract window, GST/TDS |
| 3-way check (PO↔GRN↔invoice) | 🟡 | PO↔invoice done; GRN not linked |
| Material management / GRN | 🟡 | `GRNEntry` table exists, no UI |
| Installed progress tracking | 🟡 | Vendor Scope & Progress tab does this loosely |
| Site expense tracking | ✅ | full approval chain |
| Payments | ✅ | payment requests + approvals |
| Cashflow / invoice-aging dashboards | 🟡 | some data, no dedicated analytics |
| Approval hierarchy | ✅ | multi-stage chains already coded |
| Vendor / client login (collaborators) | 🟡 | roles exist (`CLIENT`), no external portal |
| AI copilot / quote comparison | ❌ | none |
| External ERP integrations (Tally etc.) | 🟡 | `/erp-integration` stub |
| CRM / pre-sales | ❌ | none |
| Analytics (many dashboards) | ❌ | only the dashboard |

**Bottom line:** On **site + quality + approvals + invoicing**, we're already comparable to RDash (and DLP is something we have that they don't headline). The biggest structural gap is the **BOQ → BOM → procurement spine**, plus the lack of real **vendor/service master data** and **DB-persisted POs**.

---

## 4. What we could add — ranked by effort

### 🟢 Easy (days) — high value, builds on what exists

1. **Persist POs (and invoices/expenses) to the database.**
   Move `VendorPO` out of `localStorage` into a real `PurchaseOrder` table. This is the prerequisite for almost everything below and fixes the "data resets per browser" problem. _Foundational._

2. **BOQ module UI.**
   The `BOQItem` table is already designed (`workItem, unit, budgetedQty, installedQty, unitRate`). Add a `/boq` page to create/import/edit BOQ lines per project, with budget rollups. Mostly UI over an existing table.

3. **Vendor + Service/Element master.**
   Add `Vendor` and `Service`/`Element` tables so vendors and scopes stop being free-text. Unlocks dropdowns, rate contracts, and reliable BOQ→PO mapping.

4. **Flow 1 — "pick vendor + service → generate PO."**
   A form that turns a selected vendor + service + qty × rate into a saved PO (and optional PDF). Small once #1 and #3 exist.

### 🟡 Medium (1–2 weeks)

5. **Flow 2 — "upload BOQ → generate POs."**
   Parse an uploaded BOQ spreadsheet → map rows to vendors (auto if the sheet has a vendor column, otherwise a quick mapping screen) → **review screen** → bulk-create POs. Reuses the PO model from #4.

6. **Bill of Materials (scope → materials).**
   Break each BOQ line into component materials; feeds purchase requests and GRN.

7. **GRN / Material management UI.**
   `GRNEntry` table already exists — add the receiving screen and link it to POs to complete the **3-way check** (PO ↔ GRN ↔ invoice).

8. **Project schedule / Gantt.**
   `ProjectSchedule` table (with parent/child tasks) already exists — add a Gantt/timeline UI.

9. **Purchase Requests.**
   Site-initiated material requests with an approval step, flowing into POs.

### 🔴 Larger (multi-week / strategic)

10. **Change Orders** — versioned, approved changes to a BOQ with budget impact.
11. **Rate Contracts** — vendor rate catalog linked to the Element Master, auto-pricing POs.
12. **Client/Vendor portal** — external collaborator logins (roles already exist).
13. **Analytics suite** — invoice-aging, cashflow, installed-progress dashboards.
14. **AI copilot / quote comparison** — natural-language analytics; vendor quote comparison.
15. **Real external ERP sync** (Tally/Zoho/etc.) — flesh out `/erp-integration`.
16. **CRM / pre-sales** — leads → quotation → project.

---

## 5. Recommended sequence

The cleanest path that turns us into a "BOQ-driven" product like RDash, without throwing away what works:

1. **Persist POs to DB** (#1) — unblocks everything.
2. **BOQ UI** (#2) + **Vendor/Service master** (#3) — the spine + clean data.
3. **Flow 1: vendor+service → PO** (#4) — quick win, immediately useful.
4. **Flow 2: BOQ → POs** (#5) — the headline feature you asked about.
5. **GRN + 3-way check** (#7) — closes the procurement loop.

Steps 1–4 are the answer to your original question ("auto-generate POs from a service+vendor, or from an uploaded BOQ"), and each step is independently shippable.

---

## Sources
- [RDash homepage (rdash.ai)](https://rdash.ai/)
- [RDash homepage (rdash.io)](https://rdash.io/)
- [RDash Project Management](https://rdash.io/project-management/)
- [RDash AI & Power Features](https://rdash.ai/power-features/)
- [RDash Pricing & Plans](https://rdash.io/pricing/)
- [BOQ Management: The Complete Guide (RDash, Medium)](https://medium.com/rdash-ai/boq-management-the-complete-guide-for-construction-teams-17758de18a24)
- Studio Masons ERP — own codebase (`prisma/schema.prisma`, `components/layout/Sidebar.tsx`, `app/(erp)/**`, `contexts/ProjectContext.tsx`)
