import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-key";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN" || !session.user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN" || !session.user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rateLimit = body?.rateLimitPerMin as number | undefined;
  const type = body?.type === "TEST" ? "TEST" : "PRODUCTION";

  const keyValue = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      key: keyValue,
      organizationId: session.user.organizationId,
      rateLimitPerMin: rateLimit && rateLimit > 0 ? rateLimit : 60,
      type,
    },
  });

  await createAuditLog({
    action: "API_KEY_CREATED",
    userId: session.user.id,
    details: `ApiKey ${apiKey.id} (${type})`,
  });

  return NextResponse.json({ key: apiKey, plain: keyValue });
}

