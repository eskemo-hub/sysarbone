import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/aspose";
import { createAuditLog } from "@/lib/audit";
import { writeTempFile, deleteTempFile } from "@/lib/temp-file";
import path from "path";
import fs from "fs/promises";

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
    const buffer = Buffer.from(await file.arrayBuffer());

    const docName =
      validation.key.type === "TEST" ? `[TEST] ${file.name}` : file.name;

    const doc = await prisma.document.create({
      data: {
        name: docName,
        url: file.name,
        fileData: buffer,
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

    const ext = path.extname(file.name).toLowerCase().replace(".", "");

    ;(async () => {
      let tempInput: string | null = null;
      let tempOutput: string | null = null;

      try {
        await prisma.document.update({
          where: { id: doc.id },
          data: { status: "PROCESSING" },
        });

        tempInput = await writeTempFile(buffer, ext);
        tempOutput = tempInput + ".pdf";

        await processDocument(tempInput, tempOutput, ext);

        const pdfBuffer = await fs.readFile(tempOutput);

        await prisma.document.update({
          where: { id: doc.id },
          data: { 
              status: "COMPLETED",
              pdfData: pdfBuffer
          },
        });

        await createAuditLog({
          action: "EXTERNAL_DOCUMENT_PROCESSED",
          documentId: doc.id,
          details: "Processed to PDF",
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
      } finally {
        if (tempInput) await deleteTempFile(tempInput);
        if (tempOutput) await deleteTempFile(tempOutput);
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

