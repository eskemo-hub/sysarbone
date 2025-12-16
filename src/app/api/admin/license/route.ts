import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import fs from "fs/promises";
import path from "path";
import { createAuditLog } from "@/lib/audit";
import { loadLicense } from "@/lib/aspose";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN" || !session.user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null; // "words" or "cells"

  if (!file || !type) {
    return NextResponse.json({ error: "Missing file or type" }, { status: 400 });
  }

  const licensesDir = path.join(process.cwd(), "licenses");
  
  try {
    await fs.mkdir(licensesDir, { recursive: true });
  } catch (e) {
    console.error("Error creating licenses directory", e);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  
  if (type === "total") {
    // Save as both licenses since Total covers both
    await fs.writeFile(path.join(licensesDir, "Aspose.Words.lic"), buffer);
    await fs.writeFile(path.join(licensesDir, "Aspose.Cells.lic"), buffer);

    // Try to verify both
    try {
        await loadLicense("words");
        await loadLicense("cells");
    } catch (e) {
        console.error("Error verifying total license", e);
    }
  } else {
    let fileName = "";
    if (type === "words") {
      fileName = "Aspose.Words.lic";
    } else if (type === "cells") {
      fileName = "Aspose.Cells.lic";
    } else {
      return NextResponse.json({ error: "Invalid license type" }, { status: 400 });
    }

    const filePath = path.join(licensesDir, fileName);
    await fs.writeFile(filePath, buffer);

    // Try to load the license immediately to verify
    if (type === "words" || type === "cells") {
        await loadLicense(type as "words" | "cells");
    }
  }

  await createAuditLog({
    action: "LICENSE_UPDATED",
    userId: session.user.id,
    details: `Updated ${type} license`,
  });

  return NextResponse.json({ success: true });
}
