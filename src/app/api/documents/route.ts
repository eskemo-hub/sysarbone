import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const statusParam = searchParams.get("status");

  const documents = await prisma.document.findMany({
    where: {
      organizationId: session.user.organizationId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: statusParam ? (statusParam as any) : undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

