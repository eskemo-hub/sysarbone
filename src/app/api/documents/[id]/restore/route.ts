import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { enqueueJob } from "@/lib/queue";
import { JobType } from "@prisma/client";
import path from "path";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { versionId } = body;

  if (!versionId) {
    return NextResponse.json({ error: "Version ID required" }, { status: 400 });
  }

  // Find document
  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Find version
  const version = await prisma.documentVersion.findFirst({
    where: {
      id: versionId,
      documentId: id,
    },
  });

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Restore logic:
  // 1. Update Document with version's fileData
  // 2. Increment version number (create a NEW version that is a copy of the old one)
  // 3. Create a new DocumentVersion for this new state

  const newVersionNumber = doc.version + 1;

  const updatedDoc = await prisma.document.update({
    where: { id: doc.id },
    data: {
      fileData: version.fileData,
      mapping: version.mapping || doc.mapping, // Restore mapping if exists, else keep current
      version: newVersionNumber,
      pdfData: null, // Clear preview
      updatedAt: new Date(),
    },
  });

  // Create history for this restore
  await prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      version: newVersionNumber,
      fileData: version.fileData,
      mapping: version.mapping || doc.mapping,
      createdBy: session.user.id,
    },
  });

  await createAuditLog({
    action: "DOCUMENT_RESTORED",
    documentId: doc.id,
    userId: session.user.id,
    details: `Restored to version ${version.version} (new version ${newVersionNumber})`,
  });

  // Re-process
  const ext = path.extname(doc.name).toLowerCase().replace(".", "") || "docx";
  await enqueueJob(JobType.PROCESS_DOCUMENT, {
    documentId: doc.id,
    ext,
  });

  return NextResponse.json({ success: true, document: updatedDoc });
}
