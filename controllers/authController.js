const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {
  renderLauncherPage,
  renderNewUserPage,
  renderLoginSuccessPage,
} = require("../views/authRenderer");
const {
  generateInitialWorldState,
  readProfile,
  writeProfile,
  listProfiles,
  profileExists,
} = require("../lib/state-manager");
const { verifyPassword } = require("../lib/auth");
const { getSimulationConfig } = require("../lib/config-manager");

const PUBLIC_GUEST_ONLY_MODE = process.env.PUBLIC_GUEST_ONLY_MODE === "true";
const GUEST_NAMES = ["Alex", "Jordan", "Casey", "Taylor", "Morgan", "Sky"];

const getLauncherPage = (req, res) => {
  const profiles = listProfiles();
  const simulationConfig = getSimulationConfig();
  const guestModeEnabled = simulationConfig.featureToggles.enableGuestMode;
  res.send(
    renderLauncherPage(
      profiles,
      req.query.error,
      guestModeEnabled,
      req.isModernBrowser,
      PUBLIC_GUEST_ONLY_MODE
    )
  );
};

const getSingleUserLogin = (req, res) => {
  const profiles = listProfiles();
  const primeAdminProfile = profiles
    .map((p) => readProfile(p))
    .find((p) => p.isPrimeAdmin);

  if (!primeAdminProfile) {
    return res.redirect("/new-user");
  }

  req.session.userName = primeAdminProfile.userName;
  req.session.isAdmin = true;

  req.session.isPrimePortalAuthenticated = true;
  req.session.primeAdminUserName = primeAdminProfile.userName;

  req.session.save((err) => {
    if (err) {
      console.error("Single User Mode session save error:", err);
      return res.redirect(`/?error=A server error occurred during auto-login.`);
    }
    // Single User Mode should use the modern view by default for convenience
    res.send(renderLoginSuccessPage(true));
  });
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

  const simulationConfig = getSimulationConfig();
  const worldState = generateInitialWorldState(
    {
      userName: userName.trim(),
      realName: realName.trim(),
      password: password.trim(),
      age: ageNum,
      sex: sex,
      location: location.trim(),
      isAdmin: isAdmin,
      isPrimeAdmin: isPrimeAdmin,
    },
    simulationConfig
  );
  writeProfile(userName.trim(), worldState);

  res.redirect("/");
};

const postLogin = (req, res) => {
  const { userName, password, view_mode } = req.body;
  if (!userName || !password) {
    return res.redirect("/?error=Username and password are required.");
  }

  let worldState = readProfile(userName);
  const isPasswordCorrect =
    worldState &&
    (!worldState.password || verifyPassword(worldState.password, password));

  if (!isPasswordCorrect) {
    return res.redirect("/?error=Invalid username or password.");
  }

  if (req.cookies.icq98_options) {
    try {
      const options = JSON.parse(req.cookies.icq98_options);
      let profileModified = false;

      if (options.resetApplication) {
        console.log(
          `[OPTIONS] Full application reset triggered by ${userName}. Deleting all data.`
        );

        const profilesDir = path.join(__dirname, "..", "profiles");
        const imagesDir = path.join(
          __dirname,
          "..",
          "public",
          "generated-images"
        );

        const clearDir = (dir) => {
          if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach((file) => {
              if (file !== "guest_counter.json") {
                fs.unlinkSync(path.join(dir, file));
              }
            });
          }
        };

        clearDir(profilesDir);
        clearDir(imagesDir);

        console.log(
          `[OPTIONS] All profiles and images deleted. Redirecting to setup.`
        );
        res.clearCookie("icq98_options");
        return req.session.destroy(() => res.redirect("/"));
      }

      if (options.relationshipLevel && options.relationshipLevel !== -1) {
        console.log(
          `[OPTIONS] Setting all relationships to ${options.relationshipLevel} for ${userName}`
        );
        Object.keys(worldState.userScores).forEach((key) => {
          worldState.userScores[key] = options.relationshipLevel;
        });
        worldState.userScores["elion_mystic"] = 0;
        profileModified = true;
      }

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

  req.session.userName = worldState.userName;
  req.session.isAdmin = worldState.isAdmin || false;
  worldState.lastLogin = new Date().toISOString();
  writeProfile(userName, worldState);

  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return res.redirect(`/?error=A server error occurred during login.`);
    }
    const useModernView = view_mode === "modern";
    res.send(renderLoginSuccessPage(useModernView));
  });
};

const getGuestLogin = (req, res) => {
  const simulationConfig = getSimulationConfig();
  if (!simulationConfig.featureToggles.enableGuestMode) {
    return res.redirect("/?error=Guest mode is currently disabled.");
  }

  const guestId = uuidv4().split("-")[0];
  const guestUserName = `Guest-${guestId}`;
  const randomName =
    GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
  const randomAge = 14 + Math.floor(Math.random() * 6);
  const randomSex = Math.random() < 0.5 ? "M" : "F";
  const guestPassword = uuidv4();

  const worldState = generateInitialWorldState(
    {
      userName: guestUserName,
      realName: randomName,
      password: guestPassword,
      age: randomAge,
      sex: randomSex,
      location: "The Internet",
      isAdmin: false,
      isPrimeAdmin: false,
      isGuest: true,
    },
    simulationConfig
  );

  worldState.lastLogin = new Date().toISOString();
  writeProfile(guestUserName, worldState);

  const counterPath = path.join(
    __dirname,
    "..",
    "profiles",
    "guest_counter.json"
  );
  let guestData = { count: 0 };
  if (fs.existsSync(counterPath)) {
    try {
      guestData = JSON.parse(fs.readFileSync(counterPath, "utf8"));
    } catch (e) {
      console.error("Error reading guest counter, resetting.", e);
    }
  }
  guestData.count = (guestData.count || 0) + 1;
  fs.writeFileSync(counterPath, JSON.stringify(guestData));

  req.session.userName = worldState.userName;
  req.session.isAdmin = worldState.isAdmin;
  req.session.isGuest = true;

  req.session.save((err) => {
    if (err) {
      console.error("Session save error for guest:", err);
      return res.redirect(
        `/?error=A server error occurred during guest login.`
      );
    }
    // Guests on modern browsers should also get the modern view
    const userAgent = req.get("User-Agent") || "";
    const useModernView = !userAgent.includes("MSIE");
    res.send(renderLoginSuccessPage(useModernView));
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
  getGuestLogin,
  getSingleUserLogin,
};
