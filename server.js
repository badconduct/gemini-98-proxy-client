require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { loadAsset } = require("./lib/utils");
const authController = require("./controllers/authController");
const appController = require("./controllers/appController");
const adminController = require("./controllers/adminController");
const botController = require("./controllers/botController");
const { UTILITY_BOTS } = require("./config/personas");

// --- Configuration ---
const port = process.env.PORT || 3000;
global.imageJobs = {}; // In-memory store for image generation job status

// --- Directory Setup ---
const profilesDir = path.join(__dirname, "profiles");
const imagesDir = path.join(__dirname, "public", "generated-images");
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir);
  console.log(`Created profiles directory at: ${profilesDir}`);
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log(`Created images directory at: ${imagesDir}`);
}

// --- Asset Loading ---
const ICQ_LOGO_BASE64_DATA = loadAsset("assets/icq-logo.gif.base64");
const ICQ_ONLINE_BASE64_DATA = loadAsset("assets/icq-online.gif.base64");
const ICQ_OFFLINE_BASE64_DATA = loadAsset("assets/icq-offline.gif.base64");
const ICQ_BLOCKED_BASE64_DATA = loadAsset("assets/icq-blocked.gif.base64");

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
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  );
  next();
});

// --- Auth Middleware ---
const requireLogin = (req, res, next) => {
  if (req.session && req.session.userName) {
    return next();
  } else {
    return res.redirect("/");
  }
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  } else {
    // Redirect non-admins to their buddy list to avoid confusion
    return res.redirect("/buddylist");
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
app.get("/", authController.getLauncherPage);
app.get("/new-user", authController.getNewUserPage);
app.post("/create-user", authController.postCreateUser);
app.post("/login", authController.postLogin);
app.get("/logout", authController.getLogout);

// --- Protected App Routes ---
app.get("/buddylist", requireLogin, appController.getBuddyListPage);
app.get("/about", requireLogin, appController.getAboutPage);
app.get("/chat", requireLogin, appController.getChatPage);
app.post("/chat", requireLogin, postChatDispatcher); // Use the new dispatcher
app.get("/chat/clear", requireLogin, appController.getClearChat);
app.get("/apology", requireLogin, appController.getApologyPage);
app.post("/apologize", requireLogin, appController.postApology);
app.get("/files", requireLogin, appController.getFilesPage);
app.get("/check-image", requireLogin, appController.getCheckImageStatus);

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

// --- Start Server ---
const HOST = process.env.HOST || "localhost"; // Use "localhost" for local dev
const PORT = process.env.PORT || 3000;

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
