import fs from "fs/promises";
import path from "path";
import java from "java";
import os from "os";
import { writeTempFile, deleteTempFile } from "./temp-file";

// Ensure java classpath includes the Aspose JARs
const jarsDir = path.join(process.cwd(), "lib");
java.classpath.push(path.join(jarsDir, "aspose-words.jar"));
java.classpath.push(path.join(jarsDir, "aspose-cells.jar"));

// Cache license status
let asposeWordsLicenseLoaded = false;
let asposeCellsLicenseLoaded = false;

export async function loadLicense(type: "words" | "cells") {
  if (type === "words" && asposeWordsLicenseLoaded) return;
  if (type === "cells" && asposeCellsLicenseLoaded) return;

  const licensesDir = path.join(process.cwd(), "licenses");
  
  try {
    if (type === "words") {
      const License = java.import("com.aspose.words.License");
      const license = new License();
      
      const specificPath = path.join(licensesDir, "Aspose.Words.lic");
      const totalPath = path.join(licensesDir, "Aspose.TotalforJava.lic");
      
      let loaded = false;
      try {
        await fs.access(specificPath);
        license.setLicenseSync(specificPath);
        console.log("Aspose.Words license loaded from Aspose.Words.lic");
        loaded = true;
      } catch {
        try {
          await fs.access(totalPath);
          license.setLicenseSync(totalPath);
          console.log("Aspose.Words license loaded from Aspose.TotalforJava.lic");
          loaded = true;
        } catch (e) {
          console.log("No valid Aspose.Words license found, running in evaluation mode");
        }
      }
      if (loaded) asposeWordsLicenseLoaded = true;

    } else if (type === "cells") {
       const License = java.import("com.aspose.cells.License");
       const license = new License();
       
       const specificPath = path.join(licensesDir, "Aspose.Cells.lic");
       const totalPath = path.join(licensesDir, "Aspose.TotalforJava.lic");

       let loaded = false;
       try {
        await fs.access(specificPath);
        license.setLicenseSync(specificPath);
        console.log("Aspose.Cells license loaded from Aspose.Cells.lic");
        loaded = true;
       } catch {
         try {
            await fs.access(totalPath);
            license.setLicenseSync(totalPath);
            console.log("Aspose.Cells license loaded from Aspose.TotalforJava.lic");
            loaded = true;
         } catch (e) {
            console.log("No valid Aspose.Cells license found, running in evaluation mode");
         }
       }
       if (loaded) asposeCellsLicenseLoaded = true;
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

  // Read file to buffer
  const inputBuffer = await fs.readFile(inputPath);
  let outputBuffer: Buffer;

  if (type === "docx" || type === "doc") {
    outputBuffer = await processDocumentBuffer(inputBuffer, "words");
  } else if (type === "xlsx" || type === "xls") {
    outputBuffer = await processDocumentBuffer(inputBuffer, "cells");
  } else {
    throw new Error(`Unsupported file type: ${type}`);
  }

  await fs.writeFile(outputPath, outputBuffer);
}

export async function processDocumentBuffer(
    inputBuffer: Buffer,
    type: "words" | "cells"
): Promise<Buffer> {
    let tempInputPath: string | null = null;
    
    try {
        if (type === "words") {
            await loadLicense("words");
            const Document = java.import("com.aspose.words.Document");
            const ByteArrayOutputStream = java.import("java.io.ByteArrayOutputStream");
            
            // Use temp file instead of ByteArrayInputStream
            tempInputPath = await writeTempFile(inputBuffer, ".docx");
            const doc = new Document(tempInputPath);
            
            const outputStream = new ByteArrayOutputStream();
            const SaveFormat = java.import("com.aspose.words.SaveFormat");
            doc.saveSync(outputStream, SaveFormat.PDF);
            
            return Buffer.from(outputStream.toByteArraySync());
        } else {
            await loadLicense("cells");
            const Workbook = java.import("com.aspose.cells.Workbook");
            const ByteArrayOutputStream = java.import("java.io.ByteArrayOutputStream");
            const FileInputStream = java.import("java.io.FileInputStream");
            
            // Use temp file instead of ByteArrayInputStream
            tempInputPath = await writeTempFile(inputBuffer, ".xlsx");
            const inputStream = new FileInputStream(tempInputPath);
            const workbook = new Workbook(inputStream);
            
            const outputStream = new ByteArrayOutputStream();
            const SaveFormat = java.import("com.aspose.cells.SaveFormat");
            workbook.saveSync(outputStream, SaveFormat.PDF);
            
            inputStream.closeSync();
            
            return Buffer.from(outputStream.toByteArraySync());
        }
    } finally {
        if (tempInputPath) await deleteTempFile(tempInputPath);
    }
}

export async function renderWordTemplate(
  inputPath: string,
  outputPath: string,
  data: Record<string, unknown>,
  config: { preservePlaceholders?: boolean } = { preservePlaceholders: false }
): Promise<void> {
    const inputBuffer = await fs.readFile(inputPath);
    const outputBuffer = await renderWordTemplateBuffer(inputBuffer, data, config);
    await fs.writeFile(outputPath, outputBuffer);
}

export async function renderWordTemplateBuffer(
  inputBuffer: Buffer,
  data: Record<string, unknown>,
  config: { preservePlaceholders?: boolean } = { preservePlaceholders: false }
): Promise<Buffer> {
  let tempInputPath: string | null = null;
  let tempJsonPath: string | null = null;

  try {
    await loadLicense("words");
    const Document = java.import("com.aspose.words.Document");
    const FindReplaceOptions = java.import("com.aspose.words.FindReplaceOptions");
    const DocumentBuilder = java.import("com.aspose.words.DocumentBuilder");
    const NodeType = java.import("com.aspose.words.NodeType");
    const Pattern = java.import("java.util.regex.Pattern");
    const ByteArrayOutputStream = java.import("java.io.ByteArrayOutputStream");
    const FileInputStream = java.import("java.io.FileInputStream");

    // Use temp file instead of ByteArrayInputStream
    tempInputPath = await writeTempFile(inputBuffer, ".docx");
    const doc = new Document(tempInputPath);
    
    const options = new FindReplaceOptions();

    // 1. Handle Top-Level Images first (Custom logic)
    // console.log("Processing top-level images...");
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
    // console.log("Running LINQ Reporting Engine for lists and text...");
    
    // Sanitize invalid LINQ tags (containing $)
    try {
        const ReplaceAction = java.import("com.aspose.words.ReplaceAction");
        const sanitizeCallback = java.newProxy("com.aspose.words.IReplacingCallback", {
            replacing: function(args: any) {
                const match = args.getMatchSync();
                const text = match.groupSync(0);
                args.setReplacementSync("(Invalid Tag: " + text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + ")");
                return ReplaceAction.REPLACE;
            }
        });
        options.setReplacingCallbackSync(sanitizeCallback);
        doc.getRangeSync().replaceSync(
            Pattern.compileSync("<<.*?\\$.*?>>"),
            "",
            options
        );
        options.setReplacingCallbackSync(null); // Reset callback
    } catch (e) {
        console.warn("Sanitization warning", e);
    }

    // Normalize {{key}} to <<[key]>>
    try {
        const ReplaceAction = java.import("com.aspose.words.ReplaceAction");
        const normalizeCallback = java.newProxy("com.aspose.words.IReplacingCallback", {
            replacing: function(args: any) {
                const match = args.getMatchSync();
                const key = match.groupSync(1).trim(); 
                
                const getValue = (obj: any, path: string) => {
                    const parts = path.split('.');
                    let current = obj;
                    for (const part of parts) {
                        if (current === null || current === undefined) return undefined;
                        current = current[part];
                    }
                    return current;
                };

                const value = getValue(data, key);

                if (value !== undefined) {
                    args.setReplacementSync("<<[" + key + "]>>");
                    return ReplaceAction.REPLACE;
                }
                
                if (config.preservePlaceholders) {
                    return ReplaceAction.SKIP;
                }
                
                args.setReplacementSync("");
                return ReplaceAction.REPLACE;
            }
        });
        
        options.setReplacingCallbackSync(normalizeCallback);
        
        doc.getRangeSync().replaceSync(
            Pattern.compileSync("\\{\\{([a-zA-Z0-9_. ]+)\\}\\}"), 
            "", 
            options
        );
        
        options.setReplacingCallbackSync(null); // Reset callback
    } catch (e) {
        console.error("Normalization failed", e);
    }

    // Prepare JSON Data Source using temp file
    let jsonInputStream = null;
    try {
        const JsonDataSource = java.import("com.aspose.words.JsonDataSource");
        const ReportingEngine = java.import("com.aspose.words.ReportingEngine");
        const ReportBuildOptions = java.import("com.aspose.words.ReportBuildOptions");

        const jsonString = JSON.stringify(data);
        const jsonBuffer = Buffer.from(jsonString, "utf-8");
        
        // Use temp file for JSON data
        tempJsonPath = await writeTempFile(jsonBuffer, ".json");
        jsonInputStream = new FileInputStream(tempJsonPath);

        const dataSource = new JsonDataSource(jsonInputStream);
        const engine = new ReportingEngine();
        
        engine.setOptionsSync(ReportBuildOptions.ALLOW_MISSING_MEMBERS);
        engine.buildReportSync(doc, dataSource);
        
    } catch (e) {
        console.error("LINQ Reporting Engine failed", e);
    } finally {
        if (jsonInputStream) {
             try { jsonInputStream.closeSync(); } catch(e) {}
        }
    }

    const outputStream = new ByteArrayOutputStream();
    const SaveFormat = java.import("com.aspose.words.SaveFormat");
    doc.saveSync(outputStream, SaveFormat.PDF);
    
    console.log("Aspose.Words render complete (Buffer)");
    return Buffer.from(outputStream.toByteArraySync());

  } catch (e) {
    console.error("Aspose Words Render Error", e);
    throw e;
  } finally {
      if (tempInputPath) await deleteTempFile(tempInputPath);
      if (tempJsonPath) await deleteTempFile(tempJsonPath);
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

    const ByteArrayOutputStream = java.import("java.io.ByteArrayOutputStream");
    const outputStream = new ByteArrayOutputStream();
    
    doc.saveSync(outputStream, options);
    
    return Buffer.from(outputStream.toByteArraySync()).toString("utf-8");
  } catch (e) {
    console.error("Convert Doc to HTML Error", e);
    throw e;
  }
}

export async function convertHtmlToDoc(htmlContent: string, outputPath: string): Promise<void> {
  let tempHtmlPath: string | null = null;
  try {
    await loadLicense("words");
    const Document = java.import("com.aspose.words.Document");
    
    // Use temp file instead of ByteArrayInputStream to avoid buffer issues
    tempHtmlPath = await writeTempFile(Buffer.from(htmlContent, "utf-8"), ".html");
    const doc = new Document(tempHtmlPath);

    doc.saveSync(outputPath);
  } catch (e) {
    console.error("Convert HTML to Doc Error", e);
    throw e;
  } finally {
      if (tempHtmlPath) await deleteTempFile(tempHtmlPath);
  }
}
