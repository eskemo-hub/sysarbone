import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { saveFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/aspose";
import { createAuditLog } from "@/lib/audit";
import path from "path";

export async function POST(req: NextRequest) {
  const apiKeyHeader = req.headers.get("x-api-key") || undefined;

  if (!apiKeyHeader) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const validation = await validateApiKey(apiKeyHeader);

  if (!validation) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (validation.limited) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const organizationId = validation.key.organizationId;

  const formData = await req.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const { filePath, fileName } = await saveFile(file, organizationId);

    const docName =
      validation.key.type === "TEST" ? `[TEST] ${file.name}` : file.name;

    const doc = await prisma.document.create({
      data: {
        name: docName,
        url: filePath,
        organizationId,
        uploadedById: null,
        status: "PENDING",
      },
    });

    await createAuditLog({
      action: "EXTERNAL_DOCUMENT_UPLOADED",
      documentId: doc.id,
      details: `ApiKey ${validation.key.id}`,
    });

    const ext = path.extname(fileName).toLowerCase().replace(".", "");
    const outputPath = filePath + ".pdf";

    ;(async () => {
      try {
        await prisma.document.update({
          where: { id: doc.id },
          data: { status: "PROCESSING" },
        });

        await processDocument(filePath, outputPath, ext);

        await prisma.document.update({
          where: { id: doc.id },
          data: { status: "COMPLETED" },
        });

        await createAuditLog({
          action: "EXTERNAL_DOCUMENT_PROCESSED",
          documentId: doc.id,
          details: outputPath,
        });
      } catch (e) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { status: "FAILED" },
        });

        await createAuditLog({
          action: "EXTERNAL_DOCUMENT_PROCESSING_FAILED",
          documentId: doc.id,
          details: String(e instanceof Error ? e.message : e),
        });
      }
    })();

    return NextResponse.json({
      id: doc.id,
      status: doc.status,
    });
  } catch (e) {
    console.error("External upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

