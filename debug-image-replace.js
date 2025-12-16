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
        
        console.log("Doc text after replace:", doc.getText().trim());
        
        // 2. Find runs
        const runs = doc.getChildNodes(aw.NodeType.Run, true);
        console.log("Runs count:", runs.count);
        
        let found = false;
        let i = 0;
        // Convert to array to avoid live collection issues during iteration if we modify structure
        const runsArray = [];
        // Using get(index) property access or iterator?
        // NodeCollection in aspose-words-node usually supports array access or .get(i)
        // Let's check keys
        // console.log("Runs keys:", Object.keys(runs));
        
        // It seems runs.get(i) failed. Maybe it's just runs.getItem(i) or runs[i]?
        // Or we iterate using iterator
        
        for (let j = 0; j < runs.count; j++) {
            try {
               runsArray.push(runs.get(j));
            } catch(e) {
               console.log("runs.get failed, trying array access");
               // In some bindings it is runs.get_Item(j) or simply runs[j] doesn't work well
            }
        }
        
        for (const run of runsArray) {
            const text = run.text;
            console.log(`Run[${i}] text: '${text}'`);
            
            if (text.indexOf(placeholder) !== -1) {
                console.log("Found placeholder in run!");
                found = true;
                
                // Simulate insertion
                const builder = new aw.DocumentBuilder(doc);
                builder.moveTo(run);
                // Insert a small shape to simulate image
                builder.insertShape(aw.Drawing.ShapeType.Rectangle, 10, 10);
                
                run.text = text.replace(placeholder, "");
                console.log("Replaced text in run");
            }
            i++;
        }
        
        if (!found) {
            console.log("ERROR: Placeholder not found in any run!");
        }
        
        doc.save("debug-output.docx");
        console.log("Done.");
        
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
