import { prisma } from "@/lib/prisma";

export async function createAuditLog(params: {
  action: string;
  documentId?: string;
  userId?: string;
  details?: string;
}) {
  const { action, documentId, userId, details } = params;

  await prisma.auditLog.create({
    data: {
      action,
      documentId: documentId ?? null,
      userId: userId ?? null,
      details: details ?? null,
    },
  });
}

