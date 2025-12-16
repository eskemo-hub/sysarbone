import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN" || !session.user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const isActive = body?.isActive as boolean | undefined;

  const apiKey = await prisma.apiKey.findUnique({ where: { id } });

  if (!apiKey || apiKey.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.apiKey.update({
    where: { id },
    data: {
      isActive: isActive ?? apiKey.isActive,
    },
  });

  await createAuditLog({
    action: "API_KEY_UPDATED",
    userId: session.user.id,
    details: `ApiKey ${updated.id} active=${updated.isActive}`,
  });

  return NextResponse.json({ key: updated });
}

