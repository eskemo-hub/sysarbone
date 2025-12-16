import fs from "fs/promises";
import path from "path";
import java from "java";

// Ensure java classpath includes the Aspose JARs
const jarsDir = path.join(process.cwd(), "lib");
// You might need to adjust the jar names based on what you download
java.classpath.push(path.join(jarsDir, "aspose-words.jar"));
java.classpath.push(path.join(jarsDir, "aspose-cells.jar"));

export async function loadLicense(type: "words" | "cells") {
  const licensesDir = path.join(process.cwd(), "licenses");
  
  try {
    if (type === "words") {
      const licensePath = path.join(licensesDir, "Aspose.TotalforJava.lic"); // Assuming total license
      // If specific license file exists, use it
      const wordsLicensePath = path.join(licensesDir, "Aspose.Words.lic");
      
      const License = java.import("com.aspose.words.License");
      const license = new License();
      
      try {
        // Try specific first
        await fs.access(wordsLicensePath);
        license.setLicenseSync(wordsLicensePath);
        console.log("Aspose.Words license loaded from Aspose.Words.lic");
      } catch {
        // Fallback to total
        try {
           await fs.access(licensePath);
           license.setLicenseSync(licensePath);
           console.log("Aspose.Words license loaded from Aspose.TotalforJava.lic");
        } catch (e) {
           console.log("No valid Aspose.Words license found, running in evaluation mode");
        }
      }

    } else if (type === "cells") {
       // Check if we are using java for cells too
       // Since the user has a Java license, it is best to use Java for Cells too if possible
       // But let's stick to the current aspose.cells.node if it works, OR switch to java if requested.
       // However, to use the Total license, Java is safer.
       
       const License = java.import("com.aspose.cells.License");
       const license = new License();
       const licensePath = path.join(licensesDir, "Aspose.TotalforJava.lic");
       const cellsLicensePath = path.join(licensesDir, "Aspose.Cells.lic");

       try {
        await fs.access(cellsLicensePath);
        license.setLicenseSync(cellsLicensePath);
        console.log("Aspose.Cells license loaded from Aspose.Cells.lic");
       } catch {
         try {
            await fs.access(licensePath);
            license.setLicenseSync(licensePath);
            console.log("Aspose.Cells license loaded from Aspose.TotalforJava.lic");
         } catch (e) {
            console.log("No valid Aspose.Cells license found, running in evaluation mode");
         }
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
      
      const Document = java.import("com.aspose.words.Document");
      const doc = new Document(inputPath);
      doc.saveSync(outputPath);
      console.log("Aspose.Words processing complete");
    } catch (e) {
      console.error("Aspose Words Error", e);
      throw e;
    }
  } else if (type === "xlsx" || type === "xls") {
    try {
      await loadLicense("cells");
      
      const Workbook = java.import("com.aspose.cells.Workbook");
      const workbook = new Workbook(inputPath);
      workbook.saveSync(outputPath);
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

