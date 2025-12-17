import fs from "fs/promises";
import path from "path";
import os from "os";

export async function writeTempFile(buffer: Buffer, extension: string): Promise<string> {
  const tempDir = os.tmpdir();
  // Ensure extension has dot or not, handle both
  const safeExt = extension.startsWith(".") ? extension : `.${extension}`;
  const fileName = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}${safeExt}`;
  const filePath = path.join(tempDir, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readTempFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (e) {
    // Ignore error if file doesn't exist
  }
}
