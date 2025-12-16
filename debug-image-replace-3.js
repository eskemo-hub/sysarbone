const aw = require("@aspose/words");
const fs = require("fs");

async function run() {
    try {
        console.log("Creating dummy doc...");
        const doc = new aw.Document();
        const builder = new aw.DocumentBuilder(doc);
        builder.writeln("Hello <<[myImage]>> World");
        
        const key = "myImage";
        // Shortened base64 for brevity in log, but using valid PNG header
        const base64String = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        
        const base64Data = base64String.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");
        
        const placeholder = `__IMG_${Math.random().toString(36).substring(7)}__`;
        console.log("Placeholder:", placeholder);
        
        const options = new aw.Replacing.FindReplaceOptions();
        
        // 1. Replace with placeholder
        const count = doc.range.replace("<<[" + key + "]>>", placeholder, options);
        console.log("Replacements made:", count);
        
        // 2. Find runs
        const runs = doc.getChildNodes(aw.NodeType.Run, true);
        
        // Use toArray()
        let runsArray = [];
        try {
            runsArray = runs.toArray();
            console.log("Runs array length:", runsArray.length);
        } catch(e) {
            console.error("toArray failed:", e);
        }

        let found = false;
        let k = 0;
        for (const run of runsArray) {
            k++;
            const text = run.text;
            console.log(`Run ${k} keys:`, Object.keys(run));
            console.log(`Run ${k} prototype keys:`, Object.keys(Object.getPrototypeOf(run)));
            
            try {
                  console.log(`Run ${k} getText():`, run.getText());
             } catch(e) {
                  console.log(`Run ${k} getText() failed`);
             }
             
             // Use getText() if text property is missing
             const actualText = text !== undefined ? text : run.getText();
             
             if (!actualText) {
                 console.log(`Run ${k} has no text (value: ${text})`);
                 // continue; 
             } else {
                  console.log(`Run ${k} text: '${actualText}'`);
             }
             
             // ... (rest of logic)
             const index = actualText.indexOf(placeholder);
             
             if (index !== -1) {
                console.log("Found placeholder at index:", index);
                found = true;
                
                try {
                    const builder = new aw.DocumentBuilder(doc);
                    builder.moveTo(run);
                    console.log("Inserting image...");
                    builder.insertImage(buffer);
                    console.log("Image inserted.");
                    
                    const newText = actualText.replace(placeholder, "");
                    console.log(`Replacing text with '${newText}'`);
                    
                    try {
                         // Check run.range
                         if (run.range) {
                             console.log("Run has range.");
                             try {
                                 run.range.replace(placeholder, "");
                                 console.log("run.range.replace success.");
                             } catch(e) {
                                 console.log("run.range.replace failed:", e.message);
                             }
                         } else {
                             console.log("Run has no range property exposed directly.");
                         }
                         
                         // If we can't change text, maybe we can remove the run if it equals the placeholder?
                         if (actualText === placeholder) {
                             console.log("Run text equals placeholder exactly. Removing run...");
                             run.remove();
                             console.log("Run removed.");
                         }
                     } catch(e) {
                         console.log("strategies failed:", e.message);
                     }
                    
                } catch(e) {
                    console.error("Error during insertion/replacement:", e);
                }
            }
        }
        
        if (!found) {
            console.log("ERROR: Placeholder not found in any run!");
        } else {
             console.log("SUCCESS: Image inserted and placeholder removed.");
             console.log("Final Doc Text: " + doc.getText().trim());
        }
        
        doc.save("debug-output-3.docx");
        
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
