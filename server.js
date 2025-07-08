require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { loadAsset } = require("./lib/utils");
const { readProfile, listProfiles } = require("./lib/state-manager");
const authController = require("./controllers/authController");
const appController = require("./controllers/appController");
const adminController = require("./controllers/adminController");
const botController = require("./controllers/botController");
const primeAdminController = require("./controllers/primeAdminController");
const { UTILITY_BOTS } = require("./config/personas");

// --- Configuration ---
const port = process.env.PORT || 3000;
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === "true";
const DISABLE_PRIME_ADMIN = process.env.DISABLE_PRIME_ADMIN === "true";
const PUBLIC_GUEST_ONLY_MODE = process.env.PUBLIC_GUEST_ONLY_MODE === "true";

global.imageJobs = {}; // In-memory store for image generation job status

// --- Directory Setup ---
const profilesDir = path.join(__dirname, "profiles");
const imagesDir = path.join(__dirname, "public", "generated-images");
const configDir = path.join(__dirname, "config");
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir);
  console.log(`Created profiles directory at: ${profilesDir}`);
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log(`Created images directory at: ${imagesDir}`);
}
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir);
  console.log(`Created config directory at: ${configDir}`);
}

// --- Asset Loading ---
const ICQ_LOGO_BASE64_DATA = loadAsset("assets/icq-logo.gif.base64");
const ICQ_ONLINE_BASE64_DATA = loadAsset("assets/icq-online.gif.base64");
const ICQ_OFFLINE_BASE64_DATA = loadAsset("assets/icq-offline.gif.base64");
const ICQ_BLOCKED_BASE64_DATA = loadAsset("assets/icq-blocked.gif.base64");
const ICQ_BFF_BASE64_DATA = loadAsset("assets/icq-bff.gif.base64");

// --- Express App Setup ---
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Session Middleware ---
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || crypto.randomBytes(20).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Prevent client-side script access
      secure: false, // Set to true if you're using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // Expires after 1 day
    },
  })
);

// --- Security Middleware ---
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self';"
  );
  next();
});

// --- Browser Detection Middleware ---
const detectModernBrowser = (req, res, next) => {
  const userAgent = req.get("User-Agent") || "";
  // A simple check. If it's not IE, we'll assume it's modern.
  // This allows us to offer the modern-friendly view.
  req.isModernBrowser = !userAgent.includes("MSIE");
  next();
};

// --- Auth Middleware ---
const requireLogin = (req, res, next) => {
  if (req.session && req.session.userName) {
    return next();
  } else {
    return res.redirect("/");
  }
};

// --- Profile Loader Middleware ---
const loadProfile = (req, res, next) => {
  // This middleware assumes requireLogin has already run.
  // It reads the user's profile once and attaches it to the request object.
  const worldState = readProfile(req.session.userName);
  if (!worldState) {
    // This case should be rare, but it protects against a desync
    // where a session exists for a deleted profile.
    console.error(
      `Profile not found for logged-in user: ${req.session.userName}. Forcing logout.`
    );
    return req.session.destroy(() => res.redirect("/"));
  }
  req.worldState = worldState;
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  } else {
    // Redirect non-admins to their buddy list to avoid confusion
    return res.redirect("/buddylist");
  }
};

const requirePrimePortalAuth = (req, res, next) => {
  if (req.session && req.session.isPrimePortalAuthenticated) {
    return next();
  } else {
    return res.redirect("/primeadmin");
  }
};

// --- Chat Dispatcher ---
const botKeys = new Set(UTILITY_BOTS.map((b) => b.key));
const postChatDispatcher = (req, res) => {
  const { friend: friendKey } = req.body;
  if (botKeys.has(friendKey)) {
    return botController.postBotMessage(req, res);
  } else {
    return appController.postChatMessage(req, res);
  }
};

// --- Public Routes ---
app.get("/", detectModernBrowser, (req, res) => {
  if (SINGLE_USER_MODE) {
    return authController.getSingleUserLogin(req, res);
  }
  return authController.getLauncherPage(req, res);
});

if (!PUBLIC_GUEST_ONLY_MODE) {
  app.get("/new-user", detectModernBrowser, authController.getNewUserPage);
  app.post("/create-user", authController.postCreateUser);
  app.post("/login", authController.postLogin);
}

app.get("/guest-login", authController.getGuestLogin);
app.get("/logout", authController.getLogout);

// --- Protected App Routes ---
app.get("/app", requireLogin, appController.getModernAppShell); // New route for the modern shell
app.get(
  "/buddylist",
  requireLogin,
  loadProfile,
  appController.getBuddyListPage
);
app.get("/about", requireLogin, loadProfile, appController.getAboutPage);
app.get("/chat", requireLogin, loadProfile, appController.getChatPage);
app.post("/chat", requireLogin, loadProfile, postChatDispatcher);
app.get("/chat/clear", requireLogin, loadProfile, appController.getClearChat);
app.get("/apology", requireLogin, loadProfile, appController.getApologyPage);
app.post("/apologize", requireLogin, loadProfile, appController.postApology);
app.get("/files", requireLogin, loadProfile, appController.getFilesPage);
app.get(
  "/check-image",
  requireLogin,
  loadProfile,
  appController.getCheckImageStatus
);

// --- Protected Admin Routes ---
app.get(
  "/admin/users",
  requireLogin,
  requireAdmin,
  adminController.getUsersPage
);
app.post(
  "/admin/update-users",
  requireLogin,
  requireAdmin,
  adminController.postUpdateUsers
);
app.post(
  "/admin/delete-user",
  requireLogin,
  requireAdmin,
  adminController.postDeleteUser
);
app.post(
  "/admin/reset-user",
  requireLogin,
  requireAdmin,
  adminController.postResetUser
);
app.get(
  "/admin/options",
  requireLogin,
  requireAdmin,
  adminController.getOptionsPage
);

// --- Prime Admin Portal Routes ---
if (!DISABLE_PRIME_ADMIN) {
  app.get("/primeadmin", primeAdminController.getLoginPage);
  app.post("/primeadmin/login", primeAdminController.postLogin);
  app.get(
    "/primeadmin/dashboard",
    requirePrimePortalAuth,
    primeAdminController.getDashboardPage
  );
  app.post(
    "/primeadmin/save",
    requirePrimePortalAuth,
    primeAdminController.postSaveChanges
  );
  app.post(
    "/primeadmin/reset",
    requirePrimePortalAuth,
    primeAdminController.postResetToDefaults
  );
}

// --- Asset Routes ---
app.get("/icq-logo.gif", (req, res) => {
  if (!ICQ_LOGO_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_LOGO_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/icq-online.gif", (req, res) => {
  if (!ICQ_ONLINE_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_ONLINE_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/icq-offline.gif", (req, res) => {
  if (!ICQ_OFFLINE_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_OFFLINE_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/icq-blocked.gif", (req, res) => {
  if (!ICQ_BLOCKED_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_BLOCKED_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/icq-bff.gif", (req, res) => {
  if (!ICQ_BFF_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_BFF_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/favicon.ico", (req, res) => {
  if (!ICQ_ONLINE_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_ONLINE_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

// --- Static File Handlers ---
app.use(
  "/public/generated-images",
  express.static(path.join(__dirname, "public/generated-images"))
);

// --- Guest Profile Cleanup ---
const GUEST_INACTIVITY_MINUTES = 60;
const CLEANUP_INTERVAL_MINUTES = 30;

function deleteProfileAndAssets(userName, profile) {
  const profilePath = path.join(__dirname, "profiles", `${userName}.json`);
  try {
    // Delete associated images first
    if (profile.receivedFiles && profile.receivedFiles.length > 0) {
      profile.receivedFiles.forEach((file) => {
        const imageFilename = path.basename(file.url);
        const imagePath = path.join(
          __dirname,
          "public",
          "generated-images",
          imageFilename
        );
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
    }
    // Delete the profile file
    if (fs.existsSync(profilePath)) {
      fs.unlinkSync(profilePath);
    }
  } catch (err) {
    console.error(
      `[GUEST_CLEANUP] Error deleting profile and assets for ${userName}:`,
      err
    );
  }
}

function cleanupGuestProfiles() {
  console.log(
    `[GUEST_CLEANUP] Running scheduled task to clean up inactive guest profiles...`
  );
  const profileNames = listProfiles();
  const now = new Date();

  profileNames.forEach((name) => {
    const profile = readProfile(name);
    if (profile && profile.isGuest) {
      const lastLogin = profile.lastLogin ? new Date(profile.lastLogin) : null;
      if (!lastLogin) {
        // Should not happen, but as a safeguard.
        console.log(
          `[GUEST_CLEANUP] Deleting guest profile ${name} with no last login time.`
        );
        deleteProfileAndAssets(name, profile);
        return;
      }

      const diffMinutes = (now - lastLogin) / (1000 * 60);
      if (diffMinutes > GUEST_INACTIVITY_MINUTES) {
        console.log(
          `[GUEST_CLEANUP] Deleting inactive guest profile ${name} (inactive for ${Math.round(
            diffMinutes
          )} minutes).`
        );
        deleteProfileAndAssets(name, profile);
      }
    }
  });
}

// Start the cleanup task
setInterval(cleanupGuestProfiles, CLEANUP_INTERVAL_MINUTES * 60 * 1000);

// --- Start Server ---
const HOST = process.env.HOST || "localhost"; // Use "localhost" for local dev
const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  if (SINGLE_USER_MODE) {
    console.log("--- SINGLE USER MODE is ENABLED ---");
    console.log(
      "Application will automatically log in as the Prime Administrator."
    );
  }
  if (PUBLIC_GUEST_ONLY_MODE) {
    console.log("--- PUBLIC GUEST-ONLY MODE is ENABLED ---");
    console.log("Standard user login and registration are disabled.");
  }
  if (DISABLE_PRIME_ADMIN) {
    console.log("--- PRIME ADMIN PORTAL is DISABLED ---");
  }
  console.log(
    `Guest profile cleanup will run every ${CLEANUP_INTERVAL_MINUTES} minutes.`
  );
});
