import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import { convertDocToHtml, convertHtmlToDoc } from "@/lib/aspose";
import { writeTempFile, deleteTempFile } from "@/lib/temp-file";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!doc.fileData) {
     return new NextResponse("Document content missing", { status: 404 });
  }
  
  let tempPath: string | null = null;

  try {
    const ext = path.extname(doc.name) || ".docx";
    tempPath = await writeTempFile(Buffer.from(doc.fileData), ext);
    const html = await convertDocToHtml(tempPath);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (e) {
    console.error("Error converting to HTML", e);
    return new NextResponse("Conversion failed", { status: 500 });
  } finally {
    if (tempPath) await deleteTempFile(tempPath);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const htmlContent = await req.text();

  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!doc.fileData) {
      return new NextResponse("Document content missing", { status: 404 });
  }

  let tempPath: string | null = null;

  try {
    // Write original to temp (convertHtmlToDoc might need structure? 
    // Actually convertHtmlToDoc usually creates a NEW doc or overwrites.
    // If it overwrites, we need a target path.
    // If it merges, we need source.
    // Looking at convertHtmlToDoc implementation: it writes HTML to temp, then opens it, then saves to outputPath.
    // It doesn't seem to use the *original* doc as template in the current impl (it creates `new Document(tempPath)`).
    // So we just need a temp output path.
    
    // However, if we want to preserve styles from original, we might need a different approach.
    // Assuming convertHtmlToDoc is sufficient as is.
    
    const ext = path.extname(doc.name) || ".docx";
    // We need a temp file to write the result to
    // We can reuse writeTempFile with empty buffer just to get a path? Or just create one.
    // Better: writeTempFile with original content, then overwrite it?
    // convertHtmlToDoc(html, outputPath)
    
    // Let's create a temp path for output
    tempPath = await writeTempFile(Buffer.from([]), ext); // Create empty temp file
    
    await convertHtmlToDoc(htmlContent, tempPath);
    
    const newBuffer = await fs.readFile(tempPath);
    
    await prisma.document.update({
        where: { id: doc.id },
        data: {
            fileData: newBuffer,
            // We should probably clear pdfData so it regenerates?
            // pdfData: null, 
            // status: "PENDING" ?
        }
    });

    return new NextResponse("Saved", { status: 200 });
  } catch (e) {
    console.error("Error saving document", e);
    return new NextResponse("Save failed", { status: 500 });
  } finally {
      if (tempPath) await deleteTempFile(tempPath);
  }
}
