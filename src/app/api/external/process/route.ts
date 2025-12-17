import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { enqueueJob } from "@/lib/queue";
import { JobType } from "@prisma/client";
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

        // Enqueue Job instead of async IIFE
        await enqueueJob(JobType.PROCESS_DOCUMENT, {
          documentId: doc.id,
          ext,
          // We don't need to pass file buffer if it's in DB, or we can pass reference
        });

        return NextResponse.json({
          id: doc.id,
          status: "PENDING", // It is pending until worker picks it up
        });
      } catch (e) {
    console.error("External upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

