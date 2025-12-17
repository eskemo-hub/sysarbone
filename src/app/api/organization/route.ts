import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can update organization settings? Assuming yes for now.
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const organization = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { name: body.name.trim() },
  });

  await createAuditLog({
    action: "ORGANIZATION_UPDATED",
    userId: session.user.id,
    details: `Updated name to "${organization.name}"`,
  });

  return NextResponse.json({ organization });
}
