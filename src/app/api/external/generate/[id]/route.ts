import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { prisma } from "@/lib/prisma";
import { renderWordTemplateBuffer } from "@/lib/aspose";
import { createAuditLog } from "@/lib/audit";
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

  if (!doc.fileData) {
    return NextResponse.json({ error: "Template content missing" }, { status: 404 });
  }

  try {
    // In-memory processing
    const buffer = await renderWordTemplateBuffer(Buffer.from(doc.fileData), body);
    
    await createAuditLog({
      action: "EXTERNAL_DOCUMENT_GENERATED",
      documentId: doc.id,
      details: `ApiKey ${validation.key.id}`,
    });

    return new NextResponse(buffer as any, {
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
