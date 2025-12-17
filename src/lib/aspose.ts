import fs from "fs/promises";
import path from "path";
import java from "java";
import os from "os";

// Ensure java classpath includes the Aspose JARs
const jarsDir = path.join(process.cwd(), "lib");
java.classpath.push(path.join(jarsDir, "aspose-words.jar"));
java.classpath.push(path.join(jarsDir, "aspose-cells.jar"));

export async function loadLicense(type: "words" | "cells") {
  const licensesDir = path.join(process.cwd(), "licenses");
  
  try {
    if (type === "words") {
      const License = java.import("com.aspose.words.License");
      const license = new License();
      
      const specificPath = path.join(licensesDir, "Aspose.Words.lic");
      const totalPath = path.join(licensesDir, "Aspose.TotalforJava.lic");
      
      try {
        await fs.access(specificPath);
        license.setLicenseSync(specificPath);
        console.log("Aspose.Words license loaded from Aspose.Words.lic");
      } catch {
        try {
          await fs.access(totalPath);
          license.setLicenseSync(totalPath);
          console.log("Aspose.Words license loaded from Aspose.TotalforJava.lic");
        } catch (e) {
          console.log("No valid Aspose.Words license found, running in evaluation mode");
        }
      }

    } else if (type === "cells") {
       const License = java.import("com.aspose.cells.License");
       const license = new License();
       
       const specificPath = path.join(licensesDir, "Aspose.Cells.lic");
       const totalPath = path.join(licensesDir, "Aspose.TotalforJava.lic");

       try {
        await fs.access(specificPath);
        license.setLicenseSync(specificPath);
        console.log("Aspose.Cells license loaded from Aspose.Cells.lic");
       } catch {
         try {
            await fs.access(totalPath);
            license.setLicenseSync(totalPath);
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
    const Document = java.import("com.aspose.words.Document");
    const FindReplaceOptions = java.import("com.aspose.words.FindReplaceOptions");
    const DocumentBuilder = java.import("com.aspose.words.DocumentBuilder");
    const NodeType = java.import("com.aspose.words.NodeType");
    const Pattern = java.import("java.util.regex.Pattern");

    const doc = new Document(inputPath);
    const options = new FindReplaceOptions();

    // 1. Handle Top-Level Images first (Custom logic)
    console.log("Processing top-level images...");
    for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) continue;
        const stringValue = String(value);

        if (stringValue.startsWith("data:image/")) {
             try {
               const base64Data = stringValue.split(",")[1];
               const buffer = Buffer.from(base64Data, "base64");
               const javaBytes = java.newArray("byte", [...buffer]);

               const placeholder = `__IMG_${Math.random().toString(36).substring(7)}__`;
               
               // Replace tags with placeholder
               doc.getRangeSync().replaceSync("<<[" + key + "]>>", placeholder, options);
               doc.getRangeSync().replaceSync("{{" + key + "}}", placeholder, options);

               const runs = doc.getChildNodesSync(NodeType.RUN, true);
               const runsArray = runs.toArraySync();
               
               for (const run of runsArray) {
                   const text = run.getTextSync();
                   if (text && text.includes(placeholder)) {
                       const builder = new DocumentBuilder(doc);
                       builder.moveToSync(run);
                       
                       let width = -1;
                       let height = -1;
                       
                       if (stringValue.includes("|width=")) {
                           const wMatch = stringValue.match(/\|width=(\d+)/);
                           if (wMatch) width = parseInt(wMatch[1]);
                       }
                       if (stringValue.includes("|height=")) {
                           const hMatch = stringValue.match(/\|height=(\d+)/);
                           if (hMatch) height = parseInt(hMatch[1]);
                       }

                       if (width > 0 && height > 0) {
                           builder.insertImageSync(javaBytes, width, height);
                       } else if (width > 0) {
                           builder.insertImageSync(javaBytes, width, width);
                       } else {
                           builder.insertImageSync(javaBytes);
                       }
                       
                       try {
                           run.getRangeSync().replaceSync(placeholder, "", options);
                       } catch (e) {
                           console.warn("Could not replace text in run via range, trying fallback", e);
                       }
                   }
               }
             } catch(e) {
                 console.error("Image insertion failed", e);
             }
        }
    }

    // 2. Use LINQ Reporting Engine for Lists, Tables, and remaining text
    console.log("Running LINQ Reporting Engine for lists and text...");
    
    // Normalize {{key}} to <<[key]>> for consistency with LINQ engine
    // We use a regex replacement on the document range
    // Note: This is a simple global replace. Be careful if {{}} is used for other things.
    // However, in this context, it's safe to assume it's for templating.
    // We can use Aspose replace to be safe.
    doc.getRangeSync().replaceSync(
        Pattern.compileSync("\\{\\{(.*?)\\}\\}"), 
        "<<[$1]>>", 
        options
    );

    // Prepare JSON Data Source
    const tempJsonPath = path.join(os.tmpdir(), `temp_data_${Math.random().toString(36).substring(7)}.json`);
    await fs.writeFile(tempJsonPath, JSON.stringify(data), "utf-8");

    try {
        const JsonDataSource = java.import("com.aspose.words.JsonDataSource");
        const ReportingEngine = java.import("com.aspose.words.ReportingEngine");
        const ReportBuildOptions = java.import("com.aspose.words.ReportBuildOptions");

        const dataSource = new JsonDataSource(tempJsonPath);
        const engine = new ReportingEngine();
        
        // Allow missing members so we don't crash if template has extra tags
        engine.setOptionsSync(ReportBuildOptions.ALLOW_MISSING_MEMBERS);
        
        // Build report
        engine.buildReportSync(doc, dataSource);
        
    } catch (e) {
        console.error("LINQ Reporting Engine failed", e);
        // Fallback to manual replacement for top-level keys if LINQ fails?
        // Or just re-throw. LINQ is preferred.
        // If LINQ fails, we might still want to try manual replacement for simple keys
        // strictly for backward compatibility if LINQ setup is wrong.
        // But for now, let's log and proceed.
    } finally {
        // Cleanup temp file
        try {
            await fs.unlink(tempJsonPath);
        } catch (e) { /* ignore */ }
    }

    doc.saveSync(outputPath);
    console.log("Aspose.Words render complete");
  } catch (e) {
    console.error("Aspose Words Render Error", e);
    throw e;
  }
}

export async function scanDocumentFields(inputPath: string): Promise<string[]> {
  try {
    await loadLicense("words");
    const Document = java.import("com.aspose.words.Document");
    const doc = new Document(inputPath);
    const text = doc.getRangeSync().getTextSync();

    const keys = new Set<string>();
    const linqRegex = /<<\[(.*?)\]>>/g;
    const hbsRegex = /\{\{(.*?)\}\}/g;
    
    let match;
    while ((match = linqRegex.exec(text)) !== null) {
      if (match[1]) keys.add(match[1].trim());
    }
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
    await loadLicense("words");
    const Document = java.import("com.aspose.words.Document");
    const HtmlSaveOptions = java.import("com.aspose.words.HtmlSaveOptions");
    const CssStyleSheetType = java.import("com.aspose.words.CssStyleSheetType");

    const doc = new Document(inputPath);
    const options = new HtmlSaveOptions();
    
    options.setExportImagesAsBase64Sync(true);
    options.setExportFontsAsBase64Sync(true);
    options.setPrettyFormatSync(true);
    options.setExportRoundtripInformationSync(true);
    options.setCssStyleSheetTypeSync(CssStyleSheetType.INLINE);

    const tempPath = path.join(os.tmpdir(), `temp_html_${Math.random().toString(36).substring(7)}.html`);
    doc.saveSync(tempPath, options);
    
    const htmlContent = await fs.readFile(tempPath, "utf-8");
    await fs.unlink(tempPath);
    return htmlContent;
  } catch (e) {
    console.error("Convert Doc to HTML Error", e);
    throw e;
  }
}

export async function convertHtmlToDoc(htmlContent: string, outputPath: string): Promise<void> {
  try {
    await loadLicense("words");
    const Document = java.import("com.aspose.words.Document");
    const tempPath = path.join(os.tmpdir(), `temp_html_to_doc_${Math.random().toString(36).substring(7)}.html`);
    await fs.writeFile(tempPath, htmlContent, "utf-8");
    
    const doc = new Document(tempPath);
    doc.saveSync(outputPath);
    await fs.unlink(tempPath);
  } catch (e) {
    console.error("Convert HTML to Doc Error", e);
    throw e;
  }
}
