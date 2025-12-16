import fs from "fs/promises";
import path from "path";

export async function loadLicense(type: "words" | "cells") {
  const licensesDir = path.join(process.cwd(), "licenses");
  
  // Try to use the license file directly or via stream
  try {
    if (type === "words") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const aw = require("@aspose/words");
      const licensePath = path.join(licensesDir, "Aspose.Words.lic");
      try {
        await fs.access(licensePath);
        // Important: For Java based node modules, sometimes passing the full absolute path as string works best.
        // However, Aspose.Total for Java license contains multiple products.
        // We need to make sure the license class picks it up correctly.
        
        const license = new aw.License();
        license.setLicense(licensePath);
        console.log("Aspose.Words license loaded");
      } catch (e) {
        console.error("Failed to load Aspose.Words license:", e);
        // Try alternate loading method if file path fails (e.g. read stream)
        try {
            const buffer = await fs.readFile(licensePath);
            // Convert buffer to array/stream if needed, but setLicense usually accepts path or stream
            // Since path failed, maybe it's a permission/format issue.
            // Let's try to be more verbose.
        } catch (readErr) {
             console.error("Could not read license file:", readErr);
        }
        console.log("No Aspose.Words license found or valid, running in evaluation mode");
      }
    } else if (type === "cells") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsposeCells = require("aspose.cells.node");
      const licensePath = path.join(licensesDir, "Aspose.Cells.lic");
      try {
        await fs.access(licensePath);
        const license = new AsposeCells.License();
        license.setLicense(licensePath);
        console.log("Aspose.Cells license loaded");
      } catch (e) {
        console.error("Failed to load Aspose.Cells license:", e);
        console.log("No Aspose.Cells license found or valid, running in evaluation mode");
      }
    }
  } catch (e) {
    console.error(`Error loading ${type} license`, e);
  }
}

export async function processDocument(
  inputPath: string,
  outputPath: string,
  type: "docx" | "doc" | "xlsx" | "xls" | string
): Promise<void> {
  console.log(`Processing ${type} file: ${inputPath} -> ${outputPath}`);

  if (type === "pdf") {
    try {
      if (inputPath !== outputPath) {
        await fs.copyFile(inputPath, outputPath);
      }
      return;
    } catch (e) {
      console.error("PDF handling error", e);
      throw e;
    }
  }

  if (type === "docx" || type === "doc") {
    try {
      await loadLicense("words");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const aw = require("@aspose/words");
      const doc = new aw.Document(inputPath);
      doc.save(outputPath);
      console.log("Aspose.Words processing complete");
    } catch (e) {
      console.error("Aspose Words Error", e);
      throw e;
    }
  } else if (type === "xlsx" || type === "xls") {
    try {
      await loadLicense("cells");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsposeCells = require("aspose.cells.node");
      const { Workbook } = AsposeCells;
      const workbook = new Workbook(inputPath);
      workbook.save(outputPath);
      console.log("Aspose.Cells processing complete");
    } catch (e) {
      console.error("Aspose Cells Error", e);
      throw e;
    }
  } else {
    throw new Error(`Unsupported file type: ${type}`);
  }
}

export async function renderWordTemplate(
  inputPath: string,
  outputPath: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await loadLicense("words");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aw = require("@aspose/words");
    const doc = new aw.Document(inputPath);
    
    // LINQ Reporting Engine is not available in this binding/version or requires different usage.
    // Falling back to direct text replacement using Range.replace.
    // We support <<[key]>> (LINQ style) and {{key}} (Handlebars style).

    console.log("Using direct text replacement for template rendering...");

    const options = new aw.Replacing.FindReplaceOptions();
    
    // Flatten data if needed, but for now assuming flat object or top-level keys
    const entries = Object.entries(data);
    
    for (const [key, value] of entries) {
        if (value === null || value === undefined) continue;
        const stringValue = String(value);
        
        if (stringValue.startsWith("data:image/")) {
          try {
            const base64Data = stringValue.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");
            
            // Workaround: replacingCallback is not working reliably in Node.js binding.
            // We use a unique placeholder approach.
            const placeholder = `__IMG_${Math.random().toString(36).substring(7)}__`;
            
            // Replace tags with placeholder
            doc.range.replace("<<[" + key + "]>>", placeholder, options);
            doc.range.replace("{{" + key + "}}", placeholder, options);
            
            // Find runs containing the placeholder and replace with image
             const runs = doc.getChildNodes(aw.NodeType.Run, true);
             // Convert to array using toArray() which seems to work based on debug
             const runsArray = runs.toArray();
             
             for (const run of runsArray) {
               const text = run.getText();
               if (!text) continue;
               const index = text.indexOf(placeholder);
               
               if (index !== -1) {
                 const builder = new aw.DocumentBuilder(doc);
                 builder.moveTo(run); 
                 builder.insertImage(buffer);
                 try {
                    run.range.replace(placeholder, "", options);
                 } catch (e) {
                    console.warn("Could not replace text in run via range, trying fallback", e);
                    // Fallback if range.replace fails (unlikely given debug results)
                    // run.text = text.replace(placeholder, ""); 
                 }
               }
             }
          } catch (e) {
             console.error("Image insertion failed", e);
          }
        } else {
          // Replace <<[key]>>
          doc.range.replace("<<[" + key + "]>>", stringValue, options);
          
          // Replace {{key}}
          doc.range.replace("{{" + key + "}}", stringValue, options);
        }
    }

    doc.save(outputPath);
    console.log("Aspose.Words render complete");
  } catch (e) {
    console.error("Aspose Words Render Error", e);
    throw e;
  }
}

export async function scanDocumentFields(inputPath: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aw = require("@aspose/words");
    const doc = new aw.Document(inputPath);
    
    // Get text content
    const text = doc.range.text;
    
    const keys = new Set<string>();
    
    // Regex for <<[key]>>
    const linqRegex = /<<\[(.*?)\]>>/g;
    let match;
    while ((match = linqRegex.exec(text)) !== null) {
      if (match[1]) keys.add(match[1].trim());
    }

    // Regex for {{key}}
    const hbsRegex = /\{\{(.*?)\}\}/g;
    while ((match = hbsRegex.exec(text)) !== null) {
      if (match[1]) keys.add(match[1].trim());
    }

    return Array.from(keys);
  } catch (e) {
    console.error("Scan Error", e);
    return [];
  }
}

export async function convertDocToHtml(inputPath: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aw = require("@aspose/words");
    const doc = new aw.Document(inputPath);
    
    const options = new aw.Saving.HtmlSaveOptions();
    options.exportImagesAsBase64 = true;
    options.exportFontsAsBase64 = true;
    options.prettyFormat = true;
    // Improve round-trip fidelity
    options.exportRoundtripInformation = true;
    // Use inline styles so the editor is more likely to preserve them
    options.cssStyleSheetType = aw.Saving.CssStyleSheetType.Inline;

    // Use a temporary file to save the HTML
    const tempPath = inputPath + ".temp.html";
    doc.save(tempPath, options);

    // Read the HTML content
    const htmlContent = await fs.readFile(tempPath, "utf-8");

    // Clean up
    await fs.unlink(tempPath);

    return htmlContent;
  } catch (e) {
    console.error("Convert Doc to HTML Error", e);
    throw e;
  }
}

export async function convertHtmlToDoc(htmlContent: string, outputPath: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aw = require("@aspose/words");
    
    // Save HTML to a temporary file because Aspose loads from file path usually or stream
    const tempPath = outputPath + ".temp.html";
    await fs.writeFile(tempPath, htmlContent, "utf-8");

    const doc = new aw.Document(tempPath);
    
    // Save as DOCX
    doc.save(outputPath);

    // Clean up
    await fs.unlink(tempPath);
  } catch (e) {
    console.error("Convert HTML to Doc Error", e);
    throw e;
  }
}

