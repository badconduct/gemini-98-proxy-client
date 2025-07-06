const fs = require("fs");
const path = require("path");
const { FRIEND_PERSONAS } = require("../config/personas");
const { shuffleArray } = require("./utils");
const { hashPassword } = require("./auth");

const PROFILES_DIR = path.resolve(__dirname, "..", "profiles");

/**
 * Determines the user's social role based on their age.
 * @param {number} age The user's age.
 * @returns {string} The user's role ('student', 'townie_alumni', 'online').
 */
function getUserRole(age) {
  if (age >= 14 && age <= 19) return "student";
  if (age >= 20 && age <= 39) return "townie_alumni";
  return "online"; // Ages <=13 and >=40
}

/**
 * Generates a new world state object when a user creates a new profile.
 * Can accept a plain-text password (for new users) or a pre-hashed password object (for profile resets).
 * @param {string} userName The user's screen name.
 * @param {string} realName The user's real name.
 * @param {string|{salt: string, hash: string}} password The user's plain-text password or a pre-hashed object.
 * @param {number} age The user's age.
 * @param {string} sex The user's sex ('M' or 'F').
 * @param {string} location The user's location.
 * @param {boolean} isAdmin Whether the user should be an administrator.
 * @param {boolean} isPrimeAdmin Whether the user is the first, undeletable admin.
 * @returns {object} The complete world state.
 */
function generateInitialWorldState(
  userName,
  realName,
  password,
  age,
  sex,
  location,
  isAdmin = false,
  isPrimeAdmin = false
) {
  console.log(
    `Generating new world state for ${userName} (${realName}). Age: ${age}, Role: ${getUserRole(
      age
    )}`
  );

  // If password is a string, hash it. If it's an object, assume it's pre-hashed.
  const hashedPassword =
    typeof password === "object" && password.salt && password.hash
      ? password
      : hashPassword(password);

  const userRole = getUserRole(age);

  const world = {
    userName: userName,
    realName: realName,
    password: hashedPassword,
    age: age,
    sex: sex,
    location: location,
    userRole: userRole,
    isAdmin: isAdmin,
    isPrimeAdmin: isPrimeAdmin,
    lastLogin: null,
    relationships: {},
    userScores: {},
    moderation: {},
    receivedFiles: [],
    chatHistories: {},
  };

  // 1. Generate Relationships between friends, excluding Elion and Online friends
  const localFriends = FRIEND_PERSONAS.filter(
    (p) => p.group === "student" || p.group === "townie_alumni"
  );
  FRIEND_PERSONAS.forEach((p) => {
    // Initialize for all friends
    world.relationships[p.key] = { dating: null, likes: [] };
  });

  let males = shuffleArray(localFriends.filter((p) => p.gender === "male"));
  let females = shuffleArray(localFriends.filter((p) => p.gender === "female"));

  const pairsToCreate = 3 + Math.floor(Math.random() * 3);
  for (
    let i = 0;
    i < pairsToCreate && males.length > 0 && females.length > 0;
    i++
  ) {
    const male = males.pop();
    const female = females.pop();

    // Alumni can date students, but not townies (assuming townies are the only other local group)
    if (male.group === "townie_alumni" && female.group === "townie_alumni")
      continue;
    if (female.group === "townie_alumni" && male.group === "townie_alumni")
      continue;

    world.relationships[male.key].dating = female.key;
    world.relationships[female.key].dating = male.key;
  }

  localFriends.forEach((persona) => {
    const crushesToAssign = Math.floor(Math.random() * 3);
    const potentialCrushPool =
      persona.gender === "male"
        ? localFriends.filter((p) => p.gender === "female")
        : localFriends.filter((p) => p.gender === "male");
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
    // Elion is a special case and always starts at 0
    if (p.key === "elion_mystic") {
      world.userScores[p.key] = 0;
    } else if (p.group === userRole) {
      // If the friend is in the same social group as the user, give a starting bonus
      world.userScores[p.key] = 60 + Math.floor(Math.random() * 11); // 60-70
    } else {
      world.userScores[p.key] = 50; // Default score for everyone else
    }
    world.moderation[p.key] = { warning: false, blocked: false };
  });

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
      if (worldState.isPrimeAdmin === undefined) {
        worldState.isPrimeAdmin = false;
      }
      if (worldState.age === undefined) {
        worldState.age = null;
      }
      if (worldState.sex === undefined) {
        worldState.sex = null;
      }
      if (worldState.location === undefined) {
        worldState.location = null;
      }
      if (worldState.userRole === undefined) {
        worldState.userRole = worldState.age
          ? getUserRole(worldState.age)
          : "online";
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
