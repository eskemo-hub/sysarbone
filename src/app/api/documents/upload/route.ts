import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { processDocument } from "@/lib/aspose";
import { createAuditLog } from "@/lib/audit";
import { writeTempFile, deleteTempFile } from "@/lib/temp-file";
import path from "path";
import fs from "fs/promises";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate that the user and organization still exist in the database
  // This prevents foreign key constraint violations if the session is stale
  const [user, organization] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.organization.findUnique({ where: { id: session.user.organizationId } })
  ]);

  if (!user || !organization) {
    return NextResponse.json({ error: "Session invalid: User or Organization not found" }, { status: 401 });
  }

  try {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

    const buffer = Buffer.from(await file.arrayBuffer());

    const rootId = req.nextUrl.searchParams.get("rootId");

    let version = 1;

    if (rootId) {
      const latest = await prisma.document.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: file.name,
        },
        orderBy: { version: "desc" },
      });

      if (latest) {
        version = latest.version + 1;
      }
    }

    const doc = await prisma.document.create({
      data: {
        name: file.name,
        url: file.name, // Store filename as reference
        fileData: buffer,
        organizationId: session.user.organizationId,
        uploadedById: session.user.id,
        status: "PENDING",
        version,
      },
    });

    await createAuditLog({
      action: "DOCUMENT_UPLOADED",
      documentId: doc.id,
      userId: session.user.id,
      details: file.name,
    });

    // Determine type
    const ext = path.extname(file.name).toLowerCase().replace(".", "");

    // Start processing in background
    (async () => {
        let tempInput: string | null = null;
        let tempOutput: string | null = null;

        try {
            await prisma.document.update({
                where: { id: doc.id },
                data: { status: "PROCESSING" }
            });
            
            // Write to temp file for processing
            tempInput = await writeTempFile(buffer, ext);
            tempOutput = tempInput + ".pdf";

            await processDocument(tempInput, tempOutput, ext);
            
            // Read processed PDF
            const pdfBuffer = await fs.readFile(tempOutput);

            await prisma.document.update({
                where: { id: doc.id },
                data: { 
                    status: "COMPLETED",
                    pdfData: pdfBuffer
                }
            });

            await createAuditLog({
              action: "DOCUMENT_PROCESSED",
              documentId: doc.id,
              userId: session.user.id,
              details: "Processed to PDF",
            });
        } catch (e) {
            console.error("Background processing error:", e);
            await prisma.document.update({
                where: { id: doc.id },
                data: { status: "FAILED" }
            });
            await createAuditLog({
              action: "DOCUMENT_PROCESSING_FAILED",
              documentId: doc.id,
              userId: session.user.id,
              details: String(e instanceof Error ? e.message : e),
            });
        } finally {
            if (tempInput) await deleteTempFile(tempInput);
            if (tempOutput) await deleteTempFile(tempOutput);
        }
    })();

    return NextResponse.json({ success: true, document: doc });

  } catch (e) {
    console.error("Upload error:", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
