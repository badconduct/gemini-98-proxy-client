const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.resolve(
  __dirname,
  "..",
  "config",
  "simulation_config.json"
);
const DEFAULT_CONFIG_PATH = path.resolve(
  __dirname,
  "..",
  "config",
  "simulation_config.default.json"
);

let simulationConfig = null;

function loadSimulationConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, "utf8");
      simulationConfig = JSON.parse(fileContent);
    } else {
      // If config doesn't exist, create it from default
      const fileContent = fs.readFileSync(DEFAULT_CONFIG_PATH, "utf8");
      fs.writeFileSync(CONFIG_PATH, fileContent);
      simulationConfig = JSON.parse(fileContent);
      console.log("simulation_config.json not found. Created from default.");
    }
  } catch (e) {
    console.error(
      "CRITICAL: Could not load or parse simulation_config.json. Using defaults.",
      e
    );
    // Fallback to default if parsing fails
    const fileContent = fs.readFileSync(DEFAULT_CONFIG_PATH, "utf8");
    simulationConfig = JSON.parse(fileContent);
  }
  return simulationConfig;
}

function getSimulationConfig() {
  if (!simulationConfig) {
    return loadSimulationConfig();
  }
  return simulationConfig;
}

// Function to force a reload of the config after it has been changed
function reloadSimulationConfig() {
  simulationConfig = null;
  return loadSimulationConfig();
}

// Load config on initial module load
loadSimulationConfig();

module.exports = {
  getSimulationConfig,
  reloadSimulationConfig,
};
