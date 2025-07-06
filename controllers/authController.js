const {
  renderLauncherPage,
  renderNewUserPage,
  renderLoginSuccessPage,
} = require("../views/renderer");
const {
  generateInitialWorldState,
  readProfile,
  writeProfile,
  listProfiles,
  profileExists,
} = require("../lib/state-manager");
const { verifyPassword } = require("../lib/auth");

const getLauncherPage = (req, res) => {
  const profiles = listProfiles();
  res.send(renderLauncherPage(profiles));
};

const getNewUserPage = (req, res) => {
  const profiles = listProfiles();
  res.send(renderNewUserPage(null, profiles.length === 0));
};

const postCreateUser = (req, res) => {
  const { userName, realName, password } = req.body;
  if (
    !userName ||
    !userName.trim() ||
    !realName ||
    !realName.trim() ||
    !password ||
    !password.trim()
  ) {
    const profiles = listProfiles();
    return res.send(
      renderNewUserPage("All fields are required.", profiles.length === 0)
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(userName)) {
    const profiles = listProfiles();
    return res.send(
      renderNewUserPage(
        "User Name can only contain letters, numbers, underscores, and hyphens.",
        profiles.length === 0
      )
    );
  }

  if (profileExists(userName)) {
    const profiles = listProfiles();
    return res.send(
      renderNewUserPage(
        `The user name "${userName}" is already taken.`,
        profiles.length === 0
      )
    );
  }

  const profiles = listProfiles();
  const isAdmin = profiles.length === 0;

  const worldState = generateInitialWorldState(
    userName.trim(),
    realName.trim(),
    password.trim(),
    isAdmin
  );
  writeProfile(userName.trim(), worldState);

  res.redirect("/");
};

const postLogin = (req, res) => {
  const { userName, password } = req.body;
  if (!userName || !password) {
    const profiles = listProfiles();
    return res.send(
      renderLauncherPage(profiles, "Username and password are required.")
    );
  }

  let worldState = readProfile(userName);
  // For backward compatibility, allow login to old profiles without passwords
  const isPasswordCorrect =
    worldState &&
    (!worldState.password || verifyPassword(worldState.password, password));

  if (!isPasswordCorrect) {
    const profiles = listProfiles();
    return res.send(
      renderLauncherPage(profiles, "Invalid username or password.")
    );
  }

  // Check for developer options cookie (applied during login)
  if (req.cookies.icq98_options) {
    try {
      const options = JSON.parse(req.cookies.icq98_options);
      let profileModified = false;

      // Handle Profile Reset
      if (options.resetProfile) {
        console.log(`[OPTIONS] Resetting profile for ${userName}`);
        const isAdmin = worldState.isAdmin || false; // Preserve admin status on reset
        worldState = generateInitialWorldState(
          worldState.userName,
          worldState.realName,
          password,
          isAdmin
        );
        profileModified = true;
      }

      // Handle Relationship Score Overwrite
      if (options.relationshipLevel && options.relationshipLevel !== -1) {
        console.log(
          `[OPTIONS] Setting all relationships to ${options.relationshipLevel} for ${userName}`
        );
        Object.keys(worldState.userScores).forEach((key) => {
          worldState.userScores[key] = options.relationshipLevel;
        });
        // Elion is always special
        worldState.userScores["elion_mystic"] = 0;
        profileModified = true;
      }

      // Set session flag for showing scores
      if (options.showScores) {
        console.log(
          `[OPTIONS] Enabling score display for ${userName}'s session.`
        );
        req.session.showScores = true;
      } else {
        req.session.showScores = false;
      }

      if (profileModified) {
        writeProfile(userName, worldState);
      }
    } catch (e) {
      console.error("Error parsing options cookie:", e);
    }
    res.clearCookie("icq98_options");
  }

  // Set session data and last login timestamp
  req.session.userName = worldState.userName;
  req.session.isAdmin = worldState.isAdmin || false;
  worldState.lastLogin = new Date().toISOString();
  writeProfile(userName, worldState);

  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      const profiles = listProfiles();
      return res.send(
        renderLauncherPage(profiles, "A server error occurred during login.")
      );
    }
    res.send(renderLoginSuccessPage());
  });
};

const getLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).send("Could not log you out.");
    }
    res.redirect("/");
  });
};

module.exports = {
  getLauncherPage,
  getNewUserPage,
  postCreateUser,
  postLogin,
  getLogout,
};
