const fs = require("fs");
const path = require("path");

/**
 * Loads a file's content from a path relative to the project root.
 * @param {string} filePath - The path to the asset file (e.g., 'assets/icon.base64').
 * @returns {string} The content of the file, or an empty string if not found.
 */
function loadAsset(filePath) {
  try {
    // Use path.resolve to get the absolute path from the project root
    return fs.readFileSync(path.resolve(__dirname, "..", filePath), "utf8");
  } catch (e) {
    console.warn(
      `Warning: Asset file not found at ${filePath}. The app will run but may have missing images.`
    );
    return ""; // Return an empty string to prevent crashes
  }
}

/**
 * Escapes special HTML characters in a string to prevent XSS.
 * @param {string} unsafe - The raw string.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
  return unsafe
    ? unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    : "";
}

/**
 * Gets the current time as a formatted string.
 * @returns {string} Formatted time (e.g., "11:28:18 AM").
 */
function getTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Shuffles an array in place.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} The shuffled array.
 */
function shuffleArray(array) {
  let newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} value The number to clamp.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {number} The clamped number.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

module.exports = {
  loadAsset,
  escapeHtml,
  getTimestamp,
  shuffleArray,
  clamp,
};
