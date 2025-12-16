const aw = require("@aspose/words");
try {
  const options = new aw.Replacing.FindReplaceOptions();
  // Try assigning function directly
  options.replacingCallback = (args) => {
    return aw.Replacing.ReplaceAction.Replace;
  };
  console.log("Success setting function");
} catch (e) {
  console.log("Error setting function:", e.message);
}
