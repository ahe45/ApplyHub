const fs = require("fs");
const path = require("path");
const { renderIndexScriptTags } = require("./index-script-assets");

const indexModalMarkup = fs.readFileSync(path.join(__dirname, "index-modals.html"), "utf-8").trimEnd();

function injectIndexPagePartials(markup) {
  return String(markup || "")
    .replace("<!-- admit-card:index-modals -->", indexModalMarkup)
    .replace("<!-- admit-card:index-scripts -->", renderIndexScriptTags());
}

module.exports = {
  injectIndexPagePartials,
};
