import { NextRequest, NextResponse } from "next/server";
import { processNextJob } from "@/lib/queue";
import { processDocument, renderWordTemplate } from "@/lib/aspose";
import { createAuditLog } from "@/lib/audit";
import { writeTempFile, deleteTempFile } from "@/lib/temp-file";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60; // Vercel timeout (if applicable)
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Check for a secret CRON_SECRET if desired, but for now we keep it open or assume internal call
  // For security, you should add: if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) ...

  const result = await processNextJob(async (job) => {
    if (job.type === "PROCESS_DOCUMENT") {
      const { documentId, fileBufferBase64, ext } = job.payload;
      
      // We need to fetch the document fresh or just rely on payload
      // Payload might be large if we put base64, so maybe better to store in S3/Blob. 
      // BUT, existing implementation stores file in DB (Document.fileData).
      // So we should just pass documentId.
      
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc || !doc.fileData) throw new Error("Document not found or empty");

      // Logic from original route
      let tempInput: string | null = null;
      let tempOutput: string | null = null;

      try {
        const fileBuffer = doc.fileData; // It's bytes in Prisma
        const extension = ext || "docx";
        
        tempInput = await writeTempFile(Buffer.from(fileBuffer), extension);
        tempOutput = tempInput + ".pdf";

        await processDocument(tempInput, tempOutput, extension);
        const pdfBuffer = await fs.readFile(tempOutput);

        await prisma.document.update({
          where: { id: doc.id },
          data: { 
            status: "COMPLETED",
            pdfData: pdfBuffer 
          }
        });

        await createAuditLog({
          action: "EXTERNAL_DOCUMENT_PROCESSED_ASYNC",
          documentId: doc.id,
          details: "Processed via Job Queue",
        });

        return { success: true };

      } finally {
        if (tempInput) await deleteTempFile(tempInput);
        if (tempOutput) await deleteTempFile(tempOutput);
      }
    } 
    else if (job.type === "GENERATE_TEMPLATE") {
        // Implement template generation logic here if needed
        return { skipped: true };
    }
    
    throw new Error(`Unknown job type: ${job.type}`);
  });

  if (!result) {
    return NextResponse.json({ message: "No jobs pending" });
  }

  return NextResponse.json(result);
}
