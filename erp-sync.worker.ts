// BullMQ Worker — runs as a separate process
// Handles async ERP sync jobs so UI never blocks on ERP failures

import { Worker } from 'bullmq';
import { postScopeToERP, getPOFromERP } from './erp-client';
import { prisma } from './lib/prisma';

const worker = new Worker('erp-sync', async (job) => {
  const { projectId, type } = job.data;

  await prisma.eRPSync.upsert({
    where: { projectId },
    update: { status: 'PENDING' },
    create: { projectId, status: 'PENDING' },
  });

  try {
    if (type === 'POST_SCOPE') {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { boqItems: true },
      });
      if (!project) throw new Error('Project not found');

      await postScopeToERP(projectId, {
        clientName: project.clientName,
        location: project.location,
        boqItems: project.boqItems.map((b: { workItem: string; budgetedQty: unknown; unitRate: unknown }) => ({
          workItem: b.workItem,
          qty: Number(b.budgetedQty),
          rate: Number(b.unitRate),
        })),
        totalValue: Number(project.totalBudget),
      });

      await prisma.eRPSync.update({
        where: { projectId },
        data: { status: 'SYNCED', scopeDataSent: true, lastSyncAt: new Date() },
      });
    }

    if (type === 'GET_PO') {
      const po = await getPOFromERP(projectId);
      await prisma.eRPSync.update({
        where: { projectId },
        data: { status: 'SYNCED', poCreated: true, lastSyncAt: new Date() },
      });
      return po;
    }
  } catch (err: any) {
    await prisma.eRPSync.update({
      where: { projectId },
      data: { status: 'FAILED', errorLog: err.message },
    });
    throw err;
  }
}, { connection: { host: 'localhost', port: 6379 } });

console.log('ERP Sync worker running...');
