import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import path from "path";
import { renderWordTemplate } from "@/lib/aspose";
import { createAuditLog } from "@/lib/audit";
import { deleteFile } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ document: doc });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dataToUpdate: any = {};
  
  if (body.name && typeof body.name === "string") {
    dataToUpdate.name = body.name;
    // Increment version on rename
    dataToUpdate.version = { increment: 1 };
  }

  if (body.mapping && typeof body.mapping === "string") {
    dataToUpdate.mapping = body.mapping;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: dataToUpdate,
  });

  if (body.name && typeof body.name === "string" && body.name !== doc.name) {
    await createAuditLog({
      action: "DOCUMENT_RENAMED",
      documentId: doc.id,
      userId: session.user.id,
      details: `Renamed from "${doc.name}" to "${body.name}"`,
    });
  }

  try {
    if (updated.mapping && body.mapping) {
      const raw = JSON.parse(updated.mapping);
      const ext = path.extname(updated.url).toLowerCase().replace(".", "");
      if (ext === "docx" || ext === "doc") {
        const inputPath = updated.url;
        const outputPath = `${updated.url}.pdf`;
        await renderWordTemplate(inputPath, outputPath, raw);
      }
    }
  } catch (e) {
    console.error("Mapping render error", e);
  }

  return NextResponse.json({ document: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.auditLog.updateMany({
    where: { documentId: doc.id },
    data: { documentId: null },
  });

  if (doc.url) {
    await deleteFile(doc.url);
    await deleteFile(`${doc.url}.pdf`);
  }

  await prisma.document.delete({ where: { id: doc.id } });

  return NextResponse.json({ success: true });
}
