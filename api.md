# Studio Masons ERP — API Reference

## Authentication
All routes except `/api/auth/*` require a valid NextAuth session cookie.
Role-based access is enforced per route.

---

## Projects
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/projects` | All | List all projects |
| POST | `/api/projects` | ADMIN, PM | Create project |
| GET | `/api/projects/:id` | All | Get project details |
| PATCH | `/api/projects/:id` | ADMIN, PM | Update project |

## Site Surveys
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/surveys?projectId=` | List surveys for project |
| POST | `/api/surveys` | Create survey (multipart/form-data for media) |

## Design Files
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/designs?projectId=` | List design files |
| POST | `/api/designs` | Upload design file |
| PATCH | `/api/designs/:id/approve` | Approve / request changes |

## Orders & Expenses
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/orders/invoices?projectId=` | Vendor invoices |
| POST | `/api/orders/invoices` | Create invoice |
| GET | `/api/orders/expenses?projectId=` | Site expenses |
| POST | `/api/orders/expenses` | Log expense |

## Snags
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/snags?projectId=` | List snags |
| POST | `/api/snags` | Raise snag |
| PATCH | `/api/snags/:id` | Update status/assignee |

## Site Progress
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/progress/boq?projectId=` | BOQ items |
| PATCH | `/api/progress/boq/:id` | Update installed qty |
| POST | `/api/progress/grn` | Log GRN entry |

## ERP Integration (ADMIN only)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/erp/sync-scope` | Queue scope data sync to ERP |
| GET | `/api/erp/fetch-po?projectId=` | Fetch POs from ERP |
| GET | `/api/erp/status?projectId=` | Check sync status |
