const fs = require("fs");
const path = require("path");
const { renderUsersPage } = require("../views/adminRenderer");
const { renderOptionsPage } = require("../views/optionsRenderer");
const {
  listProfiles,
  readProfile,
  writeProfile,
  generateInitialWorldState,
} = require("../lib/state-manager");
const { getSimulationConfig } = require("../lib/config-manager");

const getOptionsPage = (req, res) => {
  res.send(renderOptionsPage());
};

const getUsersPage = (req, res) => {
  // Read guest counter
  const counterPath = path.join(
    __dirname,
    "..",
    "profiles",
    "guest_counter.json"
  );
  let guestCount = 0;
  if (fs.existsSync(counterPath)) {
    try {
      const guestData = JSON.parse(fs.readFileSync(counterPath, "utf8"));
      guestCount = guestData.count || 0;
    } catch (e) {
      console.error("Could not read guest counter.", e);
    }
  }

  const profileNames = listProfiles();
  const users = profileNames
    .map((name) => {
      const profile = readProfile(name);
      // Filter out guest profiles from the user list
      if (!profile || profile.isGuest) {
        return null;
      }
      return {
        name: profile.userName,
        lastLogin: profile.lastLogin,
        isAdmin: profile.isAdmin,
        isPrimeAdmin: profile.isPrimeAdmin,
        age: profile.age,
        sex: profile.sex,
        location: profile.location,
      };
    })
    .filter(Boolean) // Remove nulls from the filtered guests
    .sort((a, b) => a.name.localeCompare(b.name));

  res.send(
    renderUsersPage({
      users,
      adminUserName: req.session.userName,
      guestCount,
    })
  );
};

const postUpdateUsers = (req, res) => {
  const designatedAdmins = Array.isArray(req.body.admins)
    ? req.body.admins
    : req.body.admins
    ? [req.body.admins]
    : [];
  const currentAdmin = req.session.userName;
  const allUserNames = listProfiles();
  const userAges = req.body.age || {};
  const userSexes = req.body.sex || {};
  const userLocations = req.body.location || {};
  const simulationConfig = getSimulationConfig();

  allUserNames.forEach((userName) => {
    const profile = readProfile(userName);
    if (!profile || profile.isGuest) return; // Do not allow editing guest profiles

    const newIsAdmin =
      designatedAdmins.includes(userName) || profile.isPrimeAdmin;
    const newAge = parseInt(userAges[userName], 10) || profile.age;
    const newSex = userSexes[userName] || profile.sex;
    const newLocation = userLocations[userName] || profile.location;

    const aslChanged =
      newAge !== profile.age ||
      newSex !== profile.sex ||
      newLocation !== profile.location;
    const adminStatusChanged = newIsAdmin !== profile.isAdmin;

    if (aslChanged) {
      console.log(
        `[ADMIN] A/S/L change for ${userName} detected by ${currentAdmin}. Resetting profile.`
      );
      // A/S/L change triggers a full regeneration.
      // This will also apply the new admin status.
      const newWorldState = generateInitialWorldState(
        {
          userName: profile.userName,
          realName: profile.realName,
          password: profile.password, // Pass the hashed password object
          age: newAge,
          sex: newSex,
          location: newLocation,
          isAdmin: newIsAdmin,
          isPrimeAdmin: profile.isPrimeAdmin,
          isGuest: profile.isGuest, // Preserve guest status on reset, though unlikely
        },
        simulationConfig
      );
      writeProfile(userName, newWorldState);
    } else if (adminStatusChanged) {
      console.log(
        `[ADMIN] Admin status for ${userName} changed to ${newIsAdmin} by ${currentAdmin}.`
      );
      // Only admin status changed, no regeneration needed.
      profile.isAdmin = newIsAdmin;
      writeProfile(userName, profile);
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

const postResetUser = (req, res) => {
  const { userNameToReset } = req.body;
  const adminUserName = req.session.userName;

  if (!userNameToReset) {
    return res.status(400).send("No user specified for reset.");
  }

  const profile = readProfile(userNameToReset);

  if (profile) {
    console.log(
      `[ADMIN] Profile reset for ${userNameToReset} initiated by ${adminUserName}.`
    );
    const simulationConfig = getSimulationConfig();
    const newWorldState = generateInitialWorldState(
      {
        userName: profile.userName,
        realName: profile.realName,
        password: profile.password, // Pass the hashed password object
        age: profile.age,
        sex: profile.sex,
        location: profile.location,
        isAdmin: profile.isAdmin,
        isPrimeAdmin: profile.isPrimeAdmin,
        isGuest: profile.isGuest, // Preserve guest status on reset
      },
      simulationConfig
    );
    writeProfile(userNameToReset, newWorldState);
  } else {
    console.warn(
      `[ADMIN] Attempted to reset non-existent user: ${userNameToReset}`
    );
  }

  res.redirect("/admin/users");
};

module.exports = {
  getOptionsPage,
  getUsersPage,
  postUpdateUsers,
  postDeleteUser,
  postResetUser,
};
