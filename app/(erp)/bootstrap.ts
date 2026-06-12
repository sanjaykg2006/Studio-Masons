"use server";
// App-wide bootstrap loader. ProjectContext used to fire six separate server
// actions on mount; because Next.js serializes server actions, those ran one at
// a time — six sequential round-trips to the database on every page load. This
// batches them into a single action whose queries run concurrently server-side,
// so the client pays one round-trip and the DB does the six reads in parallel.
import { loadAppProjects, loadTeam, loadActivities } from "./data";
import { loadPurchaseOrders } from "./purchase-orders/actions";
import { loadInvoices, loadPaymentRequests } from "./orders/actions";

export async function loadBootstrap() {
  const [projects, team, activities, purchaseOrders, invoices, paymentRequests] = await Promise.all([
    loadAppProjects(),
    loadTeam(),
    loadActivities(),
    loadPurchaseOrders(),
    loadInvoices(),
    loadPaymentRequests(),
  ]);
  return { projects, team, activities, purchaseOrders, invoices, paymentRequests };
}
