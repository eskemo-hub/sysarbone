const aw = require("@aspose/words");
console.log("aw keys:", Object.keys(aw));
console.log("aw.Replacing keys:", Object.keys(aw.Replacing));
try {
  const options = new aw.Replacing.FindReplaceOptions();
  console.log("options keys:", Object.keys(options));
  // check if we can set it
  options.replacingCallback = { replacing: () => {} };
  console.log("Success setting plain object");
} catch (e) {
  console.log("Error setting plain object:", e.message);
}
