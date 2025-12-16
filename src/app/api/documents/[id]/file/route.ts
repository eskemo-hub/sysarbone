import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }

  const originalPath = doc.url;
  const pdfPath = originalPath.endsWith(".pdf")
    ? originalPath
    : `${originalPath}.pdf`;

  let filePath = pdfPath;

  try {
    await fs.access(filePath);
  } catch {
    filePath = originalPath;
  }

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          doc.name
        )}"`,
      },
    });
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }
}
