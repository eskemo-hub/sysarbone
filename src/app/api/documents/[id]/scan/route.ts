import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { scanDocumentFields } from "@/lib/aspose";
import path from "path";

export async function POST(
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

  try {
    const ext = path.extname(doc.name).toLowerCase().replace(".", "") || "docx";
    
    // Only support word documents for scanning
    if (ext !== "docx" && ext !== "doc") {
         return NextResponse.json({ error: "Only Word documents can be scanned" }, { status: 400 });
    }

    if (!doc.fileData) {
        return NextResponse.json({ error: "File content missing" }, { status: 404 });
    }

    // Use temp files for scanning
    const { writeTempFile, deleteTempFile } = await import("@/lib/temp-file");
    
    let tempInput: string | null = null;
    
    try {
        tempInput = await writeTempFile(Buffer.from(doc.fileData), ext);
        const fields = await scanDocumentFields(tempInput);
        
        // Construct JSON object from fields
        const jsonMapping: Record<string, string> = {};
        fields.forEach(field => {
            jsonMapping[field] = `[${field}]`;
        });

        return NextResponse.json({ fields, mapping: jsonMapping });
    } finally {
        if (tempInput) await deleteTempFile(tempInput);
    }
  } catch (e) {
    console.error("Scan error:", e);
    return NextResponse.json({ error: "Failed to scan document" }, { status: 500 });
  }
}
