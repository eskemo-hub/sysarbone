const aw = require("@aspose/words");
const fs = require("fs");

async function run() {
    try {
        console.log("Creating dummy doc...");
        const doc = new aw.Document();
        const builder = new aw.DocumentBuilder(doc);
        builder.writeln("Hello <<[myImage]>> World");
        
        const key = "myImage";
        const placeholder = `__IMG_${Math.random().toString(36).substring(7)}__`;
        console.log("Placeholder:", placeholder);
        
        const options = new aw.Replacing.FindReplaceOptions();
        
        // 1. Replace with placeholder
        const count = doc.range.replace("<<[" + key + "]>>", placeholder, options);
        console.log("Replacements made:", count);
        
        // 2. Find runs
        const runs = doc.getChildNodes(aw.NodeType.Run, true);
        console.log("Runs count:", runs.count);
        
        // Debug NodeCollection methods
        // Try iterator
        let i = 0;
        let found = false;
        
        // Attempt to convert NodeCollection to array
        let nodes = [];
        try {
            nodes = runs.toArray(); // Some bindings have toArray()
            console.log("Converted to array using toArray(), length:", nodes.length);
        } catch(e) {
            console.log("toArray() failed");
            // Manual iteration
            try {
                // Check if get method exists with different name
                 console.log("runs prototype:", Object.getPrototypeOf(runs));
            } catch(e) {}
        }

        // Try using get_Item(i)
         for (let j = 0; j < runs.count; j++) {
             try {
                 const run = runs.get_Item(j);
                 console.log(`Run[${j}] text: '${run.text}'`);
                 if (run.text.indexOf(placeholder) !== -1) {
                     console.log("Found placeholder!");
                     found = true;
                     const builder = new aw.DocumentBuilder(doc);
                     builder.moveTo(run);
                     builder.insertShape(aw.Drawing.ShapeType.Rectangle, 10, 10);
                     run.text = run.text.replace(placeholder, "");
                 }
             } catch(e) {
                 console.log(`get_Item(${j}) failed:`, e.message);
             }
         }
        
        doc.save("debug-output.docx");
        console.log("Done.");
        
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
