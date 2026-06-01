// ERP Integration Service
// Handles all POST/GET communication with the external ERP system

const ERP_BASE_URL = process.env.ERP_BASE_URL!;
const ERP_API_KEY  = process.env.ERP_API_KEY!;

const erpHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ERP_API_KEY}`,
};

// POST: Send scope data to ERP
export async function postScopeToERP(projectId: string, scopeData: ScopePayload) {
  const res = await fetch(`${ERP_BASE_URL}/api/scope`, {
    method: 'POST',
    headers: erpHeaders,
    body: JSON.stringify({ projectId, ...scopeData }),
  });
  if (!res.ok) throw new Error(`ERP POST failed: ${res.status}`);
  return res.json();
}

// GET: Fetch Purchase Orders from ERP
export async function getPOFromERP(projectId: string) {
  const res = await fetch(`${ERP_BASE_URL}/api/purchase-orders?projectId=${projectId}`, {
    headers: erpHeaders,
  });
  if (!res.ok) throw new Error(`ERP GET failed: ${res.status}`);
  return res.json();
}

export interface ScopePayload {
  clientName: string;
  location: string;
  boqItems: { workItem: string; qty: number; rate: number }[];
  totalValue: number;
}
