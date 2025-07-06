const fs = require("fs");
const path = require("path");
const { FRIEND_PERSONAS } = require("../config/personas");
const { shuffleArray } = require("./utils");
const { hashPassword } = require("./auth");

const PROFILES_DIR = path.resolve(__dirname, "..", "profiles");

/**
 * Generates a new world state object when a user creates a new profile.
 * @param {string} userName The user's screen name.
 * @param {string} realName The user's real name.
 * @param {string} password The user's password.
 * @param {boolean} isAdmin Whether the user should be an administrator.
 * @returns {object} The complete world state.
 */
function generateInitialWorldState(
  userName,
  realName,
  password,
  isAdmin = false
) {
  console.log(
    `Generating new world state for ${userName} (${realName}). Admin status: ${isAdmin}`
  );

  const hashedPassword = hashPassword(password);

  const world = {
    userName: userName,
    realName: realName,
    password: hashedPassword,
    isAdmin: isAdmin,
    lastLogin: null,
    relationships: {},
    userScores: {},
    moderation: {},
    receivedFiles: [],
    chatHistories: {},
  };

  // 1. Generate Relationships between friends, excluding Elion
  const nonMysticFriends = FRIEND_PERSONAS.filter(
    (p) => p.key !== "elion_mystic"
  );
  FRIEND_PERSONAS.forEach((p) => {
    // Initialize for all friends, including Elion
    world.relationships[p.key] = { dating: null, likes: [] };
  });

  let males = shuffleArray(nonMysticFriends.filter((p) => p.gender === "male"));
  let females = shuffleArray(
    nonMysticFriends.filter((p) => p.gender === "female")
  );

  const pairsToCreate = 3 + Math.floor(Math.random() * 3);
  for (
    let i = 0;
    i < pairsToCreate && males.length > 0 && females.length > 0;
    i++
  ) {
    const male = males.pop();
    const female = females.pop();
    world.relationships[male.key].dating = female.key;
    world.relationships[female.key].dating = male.key;
  }

  nonMysticFriends.forEach((persona) => {
    const crushesToAssign = Math.floor(Math.random() * 3);
    const potentialCrushPool =
      persona.gender === "male"
        ? nonMysticFriends.filter((p) => p.gender === "female")
        : nonMysticFriends.filter((p) => p.gender === "male");
    const availableCrushes = shuffleArray(
      potentialCrushPool.filter(
        (p) => p.key !== world.relationships[persona.key].dating
      )
    );
    for (let i = 0; i < crushesToAssign && i < availableCrushes.length; i++) {
      world.relationships[persona.key].likes.push(availableCrushes[i].key);
    }
  });

  // 2. Generate initial relationship scores and moderation status for the user
  FRIEND_PERSONAS.forEach((p) => {
    world.userScores[p.key] = 50; // Start all normal friends at 50
    world.moderation[p.key] = { warning: false, blocked: false };
  });
  // Elion is a special case and starts at 0
  world.userScores["elion_mystic"] = 0;

  return world;
}

/**
 * Reads a user's profile from a file.
 * @param {string} userName The user's screen name.
 * @returns {object | null} The world state object, or null if not found.
 */
function readProfile(userName) {
  const filePath = path.join(PROFILES_DIR, `${userName}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      let worldState = JSON.parse(fileContent);

      // --- Hydration for backward compatibility ---
      if (worldState.receivedFiles === undefined) {
        worldState.receivedFiles = [];
      }
      if (worldState.password === undefined) {
        worldState.password = null; // Profiles from before this change have no password
      }
      if (worldState.chatHistories === undefined) {
        worldState.chatHistories = {};
      }
      if (worldState.isAdmin === undefined) {
        worldState.isAdmin = false;
      }
      if (worldState.lastLogin === undefined) {
        worldState.lastLogin = null;
      }

      return worldState;
    } catch (e) {
      console.error(`Error reading or parsing profile for ${userName}:`, e);
      return null;
    }
  }
  return null;
}

/**
 * Writes a user's profile to a file.
 * @param {string} userName The user's screen name.
 * @param {object} worldState The world state object to save.
 */
function writeProfile(userName, worldState) {
  const filePath = path.join(PROFILES_DIR, `${userName}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(worldState, null, 2));
  } catch (e) {
    console.error(`Error writing profile for ${userName}:`, e);
  }
}

/**
 * Lists all available user profiles.
 * @returns {string[]} An array of user names.
 */
function listProfiles() {
  try {
    const files = fs.readdirSync(PROFILES_DIR);
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -5));
  } catch (e) {
    console.error("Error listing profiles:", e);
    return [];
  }
}

/**
 * Checks if a profile file exists.
 * @param {string} userName The user's screen name.
 * @returns {boolean} True if the profile exists.
 */
function profileExists(userName) {
  const filePath = path.join(PROFILES_DIR, `${userName}.json`);
  return fs.existsSync(filePath);
}

module.exports = {
  generateInitialWorldState,
  readProfile,
  writeProfile,
  listProfiles,
  profileExists,
};
