const fs = require("fs");
const path = require("path");
const { verifyPassword } = require("../lib/auth");
const {
  readProfile,
  listProfiles,
  writeProfile,
  generateInitialWorldState,
} = require("../lib/state-manager");
const {
  getSimulationConfig,
  reloadSimulationConfig,
} = require("../lib/config-manager");
const {
  renderPrimeLoginPage,
  renderPrimeDashboardPage,
  renderPrimeDashboardFallbackPage,
} = require("../views/primeAdminRenderer");

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

const getLoginPage = (req, res) => {
  res.send(renderPrimeLoginPage(req.query.error));
};

const postLogin = (req, res) => {
  const { userName, password } = req.body;
  if (!userName || !password) {
    return res.redirect(
      "/primeadmin?error=Username and password are required."
    );
  }

  const worldState = readProfile(userName);

  if (!worldState) {
    return res.redirect("/primeadmin?error=Invalid username or password.");
  }

  if (worldState.isPrimeAdmin !== true) {
    console.warn(
      `[PRIME PORTAL] Non-prime admin user "${userName}" attempted to access prime portal. Denied.`
    );
    return res.redirect(
      "/primeadmin?error=Access Denied. This portal is for the Prime Administrator only."
    );
  }

  const isPasswordCorrect = verifyPassword(worldState.password, password);
  if (!isPasswordCorrect) {
    return res.redirect("/primeadmin?error=Invalid username or password.");
  }

  // Set a specific session flag for this portal
  req.session.isPrimePortalAuthenticated = true;
  req.session.primeAdminUserName = userName; // Store for logging purposes

  req.session.save((err) => {
    if (err) {
      console.error("Prime Portal session save error:", err);
      return res.redirect(
        "/primeadmin?error=A server error occurred during login."
      );
    }
    res.redirect("/primeadmin/dashboard");
  });
};

const getDashboardPage = (req, res) => {
  const simulationConfig = getSimulationConfig();
  if (req.isModernBrowser) {
    res.send(renderPrimeDashboardPage(simulationConfig));
  } else {
    res.send(renderPrimeDashboardFallbackPage(simulationConfig));
  }
};

const postSaveChanges = (req, res) => {
  const {
    initialScores_sameGroup,
    initialScores_differentGroup,
    initialScores_elion,
    scoreModifiers_insultInterests,
    scoreModifiers_complimentInterests,
    scoreModifiers_flirtFail,
    scoreModifiers_flirtSuccess,
    scoreModifiers_liePenalty,
    scoreModifiers_honestyPenalty,
    datingRules_minPairs,
    datingRules_maxPairs,
    datingRules_maxCrushes,
    datingRules_cheatingPenaltyScore,
    datingRules_breakupForgivenessBonus,
    socialRules_creepyAgeThreshold,
    socialRules_creepyAgePenalty,
    socialRules_patronizingAgeThreshold,
    socialRules_gossipChance,
    socialRules_gossipScope,
    socialRules_bffThreshold,
    socialRules_hostileThreshold,
    systemSettings_historyCondensationThreshold,
  } = req.body;

  const featureToggles = {
    enableGuestMode: !!req.body.featureToggles_enableGuestMode,
    enableHistoryCondensation:
      !!req.body.featureToggles_enableHistoryCondensation,
    enableHonestySystem: !!req.body.featureToggles_enableHonestySystem,
    enableRRatedFilter: !!req.body.featureToggles_enableRRatedFilter,
  };

  const datingLockouts = {
    towniesAndStudents: !!req.body.datingLockouts_towniesAndStudents,
    jocksAndGoths: !!req.body.datingLockouts_jocksAndGoths,
    prepsAndSlackers: !!req.body.datingLockouts_prepsAndSlackers,
  };

  // Build the new config object from form data
  const newConfig = {
    initialScores: {
      sameGroup: parseInt(initialScores_sameGroup, 10),
      differentGroup: parseInt(initialScores_differentGroup, 10),
      elion: parseInt(initialScores_elion, 10),
    },
    scoreModifiers: {
      insultInterests: parseInt(scoreModifiers_insultInterests, 10),
      complimentInterests: parseInt(scoreModifiers_complimentInterests, 10),
      flirtFail: parseInt(scoreModifiers_flirtFail, 10),
      flirtSuccess: parseInt(scoreModifiers_flirtSuccess, 10),
      liePenalty: parseInt(scoreModifiers_liePenalty, 10),
      honestyPenalty: parseInt(scoreModifiers_honestyPenalty, 10),
    },
    datingRules: {
      minPairs: parseInt(datingRules_minPairs, 10),
      maxPairs: parseInt(datingRules_maxPairs, 10),
      maxCrushes: parseInt(datingRules_maxCrushes, 10),
      cheatingPenaltyScore: parseInt(datingRules_cheatingPenaltyScore, 10),
      breakupForgivenessBonus: parseInt(
        datingRules_breakupForgivenessBonus,
        10
      ),
    },
    datingLockouts: datingLockouts,
    socialRules: {
      creepyAgeThreshold: parseInt(socialRules_creepyAgeThreshold, 10),
      creepyAgePenalty: parseInt(socialRules_creepyAgePenalty, 10),
      patronizingAgeThreshold: parseInt(
        socialRules_patronizingAgeThreshold,
        10
      ),
      gossipChance: parseFloat(socialRules_gossipChance),
      gossipScope: parseInt(socialRules_gossipScope, 10),
      bffThreshold: parseInt(socialRules_bffThreshold, 10),
      hostileThreshold: parseInt(socialRules_hostileThreshold, 10),
    },
    featureToggles: featureToggles,
    systemSettings: {
      historyCondensationThreshold: parseInt(
        systemSettings_historyCondensationThreshold,
        10
      ),
    },
  };

  // Save the new config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  console.log(
    `[PRIME PORTAL] New simulation config saved by ${req.session.primeAdminUserName}.`
  );

  // Reload the config for the running application
  const reloadedConfig = reloadSimulationConfig();

  // Trigger Simulation Restart for all non-admin users
  console.log(
    `[PRIME PORTAL] Triggering simulation restart for all non-admin users...`
  );
  const allUserNames = listProfiles();
  allUserNames.forEach((userName) => {
    const profile = readProfile(userName);
    if (profile && !profile.isAdmin) {
      console.log(`   - Resetting profile for ${userName}`);
      const newWorldState = generateInitialWorldState(
        {
          userName: profile.userName,
          realName: profile.realName,
          password: profile.password,
          age: profile.age,
          sex: profile.sex,
          location: profile.location,
          isAdmin: profile.isAdmin,
          isPrimeAdmin: profile.isPrimeAdmin,
          isGuest: profile.isGuest,
        },
        reloadedConfig
      );
      // Preserve chat histories and other non-social state
      newWorldState.chatHistories = profile.chatHistories;
      newWorldState.receivedFiles = profile.receivedFiles;
      writeProfile(userName, newWorldState);
    } else if (profile && profile.isAdmin) {
      console.log(`   - Skipping admin profile ${userName}`);
    }
  });
  console.log(`[PRIME PORTAL] Simulation restart complete.`);

  res.redirect("/primeadmin/dashboard");
};

const postResetToDefaults = (req, res) => {
  // Copy default config over current config
  const defaultConfigContent = fs.readFileSync(DEFAULT_CONFIG_PATH, "utf8");
  fs.writeFileSync(CONFIG_PATH, defaultConfigContent);
  console.log(
    `[PRIME PORTAL] Simulation config reset to defaults by ${req.session.primeAdminUserName}.`
  );

  // Reload the config for the running application
  const reloadedConfig = reloadSimulationConfig();

  // Trigger Simulation Restart for all non-admin users
  console.log(
    `[PRIME PORTAL] Triggering simulation restart for all non-admin users...`
  );
  const allUserNames = listProfiles();
  allUserNames.forEach((userName) => {
    const profile = readProfile(userName);
    if (profile && !profile.isAdmin) {
      console.log(`   - Resetting profile for ${userName}`);
      const newWorldState = generateInitialWorldState(
        {
          userName: profile.userName,
          realName: profile.realName,
          password: profile.password,
          age: profile.age,
          sex: profile.sex,
          location: profile.location,
          isAdmin: profile.isAdmin,
          isPrimeAdmin: profile.isPrimeAdmin,
          isGuest: profile.isGuest,
        },
        reloadedConfig
      );
      // Preserve chat histories and other non-social state
      newWorldState.chatHistories = profile.chatHistories;
      newWorldState.receivedFiles = profile.receivedFiles;
      writeProfile(userName, newWorldState);
    } else if (profile && profile.isAdmin) {
      console.log(`   - Skipping admin profile ${userName}`);
    }
  });
  console.log(`[PRIME PORTAL] Simulation restart complete.`);

  res.redirect("/primeadmin/dashboard");
};

module.exports = {
  getLoginPage,
  postLogin,
  getDashboardPage,
  postSaveChanges,
  postResetToDefaults,
};
