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
  // Pass the error from query params if a login failed
  res.send(renderLauncherPage(profiles, req.query.error));
};

const getNewUserPage = (req, res) => {
  const profiles = listProfiles();
  res.send(renderNewUserPage(null, profiles.length === 0));
};

const postCreateUser = (req, res) => {
  const { userName, realName, password, age, sex, location } = req.body;
  const profiles = listProfiles();
  const isFirstUser = profiles.length === 0;

  if (
    !userName ||
    !userName.trim() ||
    !realName ||
    !realName.trim() ||
    !password ||
    !password.trim() ||
    !age ||
    !sex ||
    !location ||
    !location.trim()
  ) {
    return res.send(renderNewUserPage("All fields are required.", isFirstUser));
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(userName)) {
    return res.send(
      renderNewUserPage(
        "User Name can only contain letters, numbers, underscores, and hyphens.",
        isFirstUser
      )
    );
  }

  const ageNum = parseInt(age, 10);
  if (isNaN(ageNum) || ageNum < 1 || ageNum > 99) {
    return res.send(
      renderNewUserPage("Age must be a number between 1 and 99.", isFirstUser)
    );
  }

  if (sex !== "M" && sex !== "F") {
    return res.send(
      renderNewUserPage("Invalid selection for Sex.", isFirstUser)
    );
  }

  if (location.trim().length > 50) {
    return res.send(
      renderNewUserPage("Location cannot exceed 50 characters.", isFirstUser)
    );
  }

  if (profileExists(userName)) {
    return res.send(
      renderNewUserPage(
        `The user name "${userName}" is already taken.`,
        isFirstUser
      )
    );
  }

  const isAdmin = isFirstUser;
  const isPrimeAdmin = isFirstUser;

  const worldState = generateInitialWorldState(
    userName.trim(),
    realName.trim(),
    password.trim(),
    ageNum,
    sex,
    location.trim(),
    isAdmin,
    isPrimeAdmin
  );
  writeProfile(userName.trim(), worldState);

  res.redirect("/");
};

const postLogin = (req, res) => {
  const { userName, password } = req.body;
  if (!userName || !password) {
    return res.redirect("/?error=Username and password are required.");
  }

  let worldState = readProfile(userName);
  // For backward compatibility, allow login to old profiles without passwords.
  // For new profiles, worldState.password will always exist.
  const isPasswordCorrect =
    worldState &&
    (!worldState.password || verifyPassword(worldState.password, password));

  if (!isPasswordCorrect) {
    return res.redirect("/?error=Invalid username or password.");
  }

  // Check for developer options cookie (applied during login)
  if (req.cookies.icq98_options) {
    try {
      const options = JSON.parse(req.cookies.icq98_options);
      let profileModified = false;

      // Handle Profile Reset
      if (options.resetProfile) {
        console.log(`[OPTIONS] Resetting profile for ${userName}`);
        const isAdmin = worldState.isAdmin || false;
        const isPrimeAdmin = worldState.isPrimeAdmin || false; // Preserve prime admin status on reset
        const age = worldState.age;
        const sex = worldState.sex;
        const location = worldState.location;
        worldState = generateInitialWorldState(
          worldState.userName,
          worldState.realName,
          password,
          age,
          sex,
          location,
          isAdmin,
          isPrimeAdmin
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
      return res.redirect(`/?error=A server error occurred during login.`);
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
