// Which browser engine the checks drive. Default: Chromium. BROWSER=webkit runs the same checks in
// WebKit, the engine under every browser on an iPhone. `npm run checks:webkit` sets it for you.
// CHROME (a path to an installed Chromium) applies to Chromium only.
const pw = require("playwright");

const name = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
const type = pw[name];

module.exports = {
  name,
  engine: {
    launch: (options = {}) =>
      type.launch(name === "chromium" ? options : { ...options, executablePath: undefined }),
  },
};
