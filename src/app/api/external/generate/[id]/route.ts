import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { prisma } from "@/lib/prisma";
import { renderWordTemplate } from "@/lib/aspose";
import { createAuditLog } from "@/lib/audit";
import fs from "fs/promises";
import path from "path";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const organizationId = validation.key.organizationId;

  // Find the template
  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const originalPath = doc.url;
    // Create a temporary output path
    const tempFileName = `generated-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;
    // Use the same directory as uploads for temp files or a specific temp dir
    // Assuming doc.url is absolute path, we can use its directory
    const outputDir = path.dirname(originalPath);
    const outputPath = path.join(outputDir, tempFileName);

    await renderWordTemplate(originalPath, outputPath, body);

    const buffer = await fs.readFile(outputPath);
    
    // Clean up temp file
    await fs.unlink(outputPath);

    await createAuditLog({
      action: "EXTERNAL_DOCUMENT_GENERATED",
      documentId: doc.id,
      details: `ApiKey ${validation.key.id}`,
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="generated-${doc.name}.pdf"`,
      },
    });

  } catch (e) {
    console.error("Generation error:", e);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
