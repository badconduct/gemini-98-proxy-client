const crypto = require("crypto");

/**
 * Hashes a password with a salt.
 * @param {string} password The password to hash.
 * @returns {{salt: string, hash: string}} The salt and hash.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return { salt, hash };
}

/**
 * Verifies a password against a stored salt and hash.
 * @param {{salt: string, hash: string}} storedPassword The stored password object.
 * @param {string} submittedPassword The password submitted by the user.
 * @returns {boolean} True if the passwords match.
 */
function verifyPassword(storedPassword, submittedPassword) {
  if (!storedPassword || !storedPassword.salt || !storedPassword.hash) {
    console.error(
      "Attempted to verify a password for a profile with no password stored."
    );
    return false;
  }
  const hash = crypto
    .pbkdf2Sync(submittedPassword, storedPassword.salt, 1000, 64, "sha512")
    .toString("hex");
  return storedPassword.hash === hash;
}

module.exports = {
  hashPassword,
  verifyPassword,
};
