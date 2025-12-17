import { prisma } from "./lib/prisma";
import { JobType, JobStatus } from "@prisma/client";
import { processDocumentBuffer } from "./lib/aspose";
import { createAuditLog } from "./lib/audit";

const POLL_INTERVAL_MS = 1000;

async function processNextJob() {
  // Lock and fetch logic
  // Note: $queryRaw returns objects with properties as they are in DB (likely camelCase if Prisma maps it, but raw query might return snake_case or specific casing depending on driver)
  // Prisma usually maps raw results to JS objects.
  
  const jobs = await prisma.$queryRaw<
    { id: string; type: JobType; payload: any }[]
  >`
    UPDATE "Job"
    SET status = 'PROCESSING', "updatedAt" = NOW()
    WHERE id = (
      SELECT id
      FROM "Job"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload;
  `;

  if (!jobs || jobs.length === 0) {
    return false;
  }

  const job = jobs[0];
  console.log(`Processing job ${job.id} (${job.type})...`);

  try {
    if (job.type === "PROCESS_DOCUMENT") {
        const { documentId, ext } = job.payload;
        
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc || !doc.fileData) throw new Error("Document not found or empty");

        const extension = ext || "docx";
        let type = "words";
        if (extension === "xlsx" || extension === "xls") type = "cells";

        const pdfBuffer = await processDocumentBuffer(Buffer.from(doc.fileData), type as any);

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
          details: "Processed via Worker",
        });

    } else if (job.type === "GENERATE_TEMPLATE") {
        // Implement if needed
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        result: { success: true },
      },
    });
    console.log(`Job ${job.id} completed.`);
    
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return true;
}

async function run() {
    console.log("Worker started. Waiting for jobs...");
    while (true) {
        try {
            const processed = await processNextJob();
            if (!processed) {
                await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            }
        } catch (e) {
            console.error("Worker loop error:", e);
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS * 5));
        }
    }
}

// Check if running directly
if (require.main === module) {
    run();
}

export { run };
