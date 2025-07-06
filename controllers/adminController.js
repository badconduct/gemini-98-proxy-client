const fs = require("fs");
const path = require("path");
const { renderUsersPage, renderOptionsPage } = require("../views/renderer");
const {
  listProfiles,
  readProfile,
  writeProfile,
} = require("../lib/state-manager");

const getOptionsPage = (req, res) => {
  res.send(renderOptionsPage());
};

const getUsersPage = (req, res) => {
  const profileNames = listProfiles();
  const users = profileNames
    .map((name) => {
      const profile = readProfile(name);
      return {
        name: profile ? profile.userName : name,
        lastLogin: profile ? profile.lastLogin : null,
        isAdmin: profile ? profile.isAdmin : false,
        isPrimeAdmin: profile ? profile.isPrimeAdmin : false,
        age: profile ? profile.age : "N/A",
        sex: profile ? profile.sex : "N/A",
        location: profile ? profile.location : "N/A",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  res.send(renderUsersPage({ users, adminUserName: req.session.userName }));
};

const postUpdateUsers = (req, res) => {
  const designatedAdmins = Array.isArray(req.body.admins)
    ? req.body.admins
    : req.body.admins
    ? [req.body.admins]
    : [];
  const currentAdmin = req.session.userName;
  const allUserNames = listProfiles();

  allUserNames.forEach((userName) => {
    const profile = readProfile(userName);
    if (profile) {
      let shouldBeAdmin = designatedAdmins.includes(userName);
      // The prime admin MUST always be an admin. This is the authoritative check.
      if (profile.isPrimeAdmin) {
        shouldBeAdmin = true;
      }

      if (profile.isAdmin !== shouldBeAdmin) {
        profile.isAdmin = shouldBeAdmin;
        writeProfile(userName, profile);
        console.log(
          `[ADMIN] Admin status for ${userName} set to ${shouldBeAdmin} by ${currentAdmin}.`
        );
      }
    }
  });

  res.redirect("/admin/users");
};

const postDeleteUser = (req, res) => {
  const { userNameToDelete } = req.body;
  const adminUserName = req.session.userName;

  if (!userNameToDelete) {
    return res.status(400).send("No user specified for deletion.");
  }

  const profileToDelete = readProfile(userNameToDelete);

  if (profileToDelete && profileToDelete.isPrimeAdmin) {
    console.error(
      `[SECURITY] Admin ${adminUserName} attempted to delete prime admin ${userNameToDelete}. Operation blocked.`
    );
    return res.status(403).send("The prime administrator cannot be deleted.");
  }

  // This check remains useful for non-prime admins trying to delete themselves.
  if (userNameToDelete === adminUserName) {
    return res
      .status(403)
      .send("Administrators cannot delete their own accounts.");
  }

  const profilePath = path.resolve(
    __dirname,
    "..",
    "profiles",
    `${userNameToDelete}.json`
  );

  try {
    if (fs.existsSync(profilePath)) {
      // First, read the profile to get a list of associated images for cleanup
      if (
        profileToDelete &&
        profileToDelete.receivedFiles &&
        profileToDelete.receivedFiles.length > 0
      ) {
        console.log(
          `[ADMIN] Deleting ${profileToDelete.receivedFiles.length} image(s) for user ${userNameToDelete}.`
        );
        profileToDelete.receivedFiles.forEach((file) => {
          const imageFilename = path.basename(file.url);
          const imagePath = path.resolve(
            __dirname,
            "..",
            "public",
            "generated-images",
            imageFilename
          );
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        });
      }

      // Now, delete the profile file itself
      fs.unlinkSync(profilePath);
      console.log(
        `[ADMIN] User "${userNameToDelete}" has been deleted by ${adminUserName}.`
      );
    } else {
      console.warn(
        `[ADMIN] Attempted to delete non-existent user: ${userNameToDelete}`
      );
    }
  } catch (err) {
    console.error(`[ADMIN] Error deleting user ${userNameToDelete}:`, err);
    // We can't really render an error page here easily, so we just log and redirect.
  }

  res.redirect("/admin/users");
};

module.exports = {
  getOptionsPage,
  getUsersPage,
  postUpdateUsers,
  postDeleteUser,
};
