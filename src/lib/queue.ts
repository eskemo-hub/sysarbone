import { prisma } from "@/lib/prisma";
import { JobType, JobStatus, Prisma } from "@prisma/client";

export async function enqueueJob(
  type: JobType,
  payload: any,
  options?: { attempts?: number }
) {
  return prisma.job.create({
    data: {
      type,
      payload: payload ?? {},
      status: JobStatus.PENDING,
      attempts: 0,
    },
  });
}

export async function processNextJob(
  handler: (job: {
    id: string;
    type: JobType;
    payload: any;
  }) => Promise<any>
) {
  // 1. Find a pending job
  // We use a transaction or simple atomic update if possible, but Prisma doesn't support
  // "SELECT FOR UPDATE SKIP LOCKED" natively in a clean way across all DBs easily without raw query.
  // For simplicity/Postgres:
  
  // We'll try to lock a job.
  // Using raw query is safer for concurrency:
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

  if (jobs.length === 0) {
    return null;
  }

  const job = jobs[0];

  try {
    const result = await handler(job);
    
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        result: result ?? {},
      },
    });
    
    return { job, status: "COMPLETED", result };
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    
    return { job, status: "FAILED", error };
  }
}
