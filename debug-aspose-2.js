const aw = require("@aspose/words");
try {
  console.log("Trying to instantiate IReplacingCallback...");
  const callback = new aw.Replacing.IReplacingCallback();
  console.log("Instantiated IReplacingCallback");
  
  callback.replacing = (args) => {
    console.log("replacing called");
    return aw.Replacing.ReplaceAction.Replace;
  };
  
  const options = new aw.Replacing.FindReplaceOptions();
  options.replacingCallback = callback;
  console.log("Success setting callback instance");
} catch (e) {
  console.log("Error:", e.message);
}
