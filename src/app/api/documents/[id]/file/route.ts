import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
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

  // Prefer PDF data if available (completed status), otherwise original file
  const buffer = doc.pdfData || doc.fileData;
  
  if (!buffer) {
     return new NextResponse("File content missing", { status: 404 });
  }

  const isPdf = !!doc.pdfData;
  const ext = isPdf ? ".pdf" : path.extname(doc.name).toLowerCase();
  const contentType =
    isPdf || ext === ".pdf"
      ? "application/pdf"
      : "application/octet-stream";
  
  // If we are serving the generated PDF, append .pdf to the name for download
  const filename = isPdf && !doc.name.toLowerCase().endsWith(".pdf") 
    ? `${doc.name}.pdf` 
    : doc.name;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(
        filename
      )}"`,
    },
  });
}
