const authRenderer = require("./authRenderer");
const appRenderer = require("./appRenderer");
const adminRenderer = require("./adminRenderer");
const optionsRenderer = require("./optionsRenderer");

// This file acts as a facade, aggregating all the rendering functions
// from the modularized files. This allows the controllers to continue
// requiring a single file without needing to know about the internal
// view structure.

module.exports = {
  ...authRenderer,
  ...appRenderer,
  ...adminRenderer,
  ...optionsRenderer,
};
