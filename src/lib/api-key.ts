import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function validateApiKey(apiKey: string) {
  const key = await prisma.apiKey.findUnique({
    where: { key: apiKey },
  });

  if (!key || !key.isActive) {
    return null;
  }

  const now = new Date();
  const windowMillis = 60 * 1000;
  const windowStart = key.windowStart ?? new Date(0);
  const isSameWindow = now.getTime() - windowStart.getTime() < windowMillis;

  if (isSameWindow && key.windowCount >= key.rateLimitPerMin) {
    return { key, limited: true } as const;
  }

  if (!isSameWindow) {
    await prisma.apiKey.update({
      where: { id: key.id },
      data: {
        windowStart: now,
        windowCount: 1,
        usageCount: { increment: 1 },
        lastUsedAt: now,
      },
    });
  } else {
    await prisma.apiKey.update({
      where: { id: key.id },
      data: {
        windowCount: { increment: 1 },
        usageCount: { increment: 1 },
        lastUsedAt: now,
      },
    });
  }

  const updated = await prisma.apiKey.findUnique({
    where: { id: key.id },
    include: { organization: true },
  });

  if (!updated) {
    return null;
  }

  return { key: updated, limited: false } as const;
}

export function generateApiKey() {
  return randomBytes(32).toString("hex");
}
