import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { convertDocToHtml, convertHtmlToDoc } from "@/lib/aspose";

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

  let originalPath = doc.url;
  
  console.log(`[Content] Fetching content for doc ${id}`);
  console.log(`[Content] Original Path: ${originalPath}`);

  // Safety check: If the path points to a PDF, check if there's a source DOCX/DOC file.
  // This prevents editing the generated preview PDF if the URL somehow points to it.
  if (originalPath.toLowerCase().endsWith(".pdf")) {
    const potentialDocx = originalPath.substring(0, originalPath.length - 4); // Remove .pdf (assuming file.docx.pdf pattern)
    // Or if it was just file.pdf and we want to find file.docx? 
    // The preview generation pattern is file.docx -> file.docx.pdf
    
    try {
      await fs.access(potentialDocx);
      console.log(`[Content] Found original source file at ${potentialDocx}, using that instead of PDF.`);
      originalPath = potentialDocx;
    } catch {
      // If exact match not found, try checking if it was a direct PDF upload but a DOCX exists with same base name?
      // Unlikely for now.
    }
  }

  try {
    const html = await convertDocToHtml(originalPath);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (e) {
    console.error("Error converting to HTML", e);
    return new NextResponse("Conversion failed", { status: 500 });
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

  const originalPath = doc.url;

  try {
    await convertHtmlToDoc(htmlContent, originalPath);
    
    // Update updated_at timestamp if it exists
    // await prisma.document.update(...) 

    return new NextResponse("Saved", { status: 200 });
  } catch (e) {
    console.error("Error saving document", e);
    return new NextResponse("Save failed", { status: 500 });
  }
}
