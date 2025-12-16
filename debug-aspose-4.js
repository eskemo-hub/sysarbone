const aw = require("@aspose/words");
try {
  console.log("IReplacingCallback keys:", Object.keys(aw.Replacing.IReplacingCallback));
  if (aw.Replacing.IReplacingCallback.implement) {
      console.log("Has implement method");
  } else {
      console.log("No implement method");
  }
} catch (e) {
  console.log("Error:", e.message);
}
