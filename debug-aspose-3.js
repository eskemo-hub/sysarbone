const aw = require("@aspose/words");
try {
  console.log("Trying to extend IReplacingCallback...");
  class MyCallback extends aw.Replacing.IReplacingCallback {
      replacing(args) {
          console.log("replacing called");
          return aw.Replacing.ReplaceAction.Replace;
      }
  }
  
  const callback = new MyCallback();
  console.log("Instantiated MyCallback");
  
  const options = new aw.Replacing.FindReplaceOptions();
  options.replacingCallback = callback;
  console.log("Success setting callback instance");
} catch (e) {
  console.log("Error:", e.message);
}
