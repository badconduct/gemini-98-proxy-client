const { escapeHtml, loadAsset } = require("../lib/utils");
const { renderHtmlPage } = require("./pageBuilder");
const { renderDialogWindow } = require("./components");

function renderLauncherPage(
  profiles = [],
  error = null,
  guestModeEnabled = true,
  isModernBrowser = false,
  isGuestOnlyMode = false,
  isForceRetroView = false
) {
  const title = "Gemini 98 - Launcher";
  const header = "ICQ98 Network Login";

  const modernFriendlyOption =
    isModernBrowser && !isForceRetroView
      ? `
    <div style="text-align: center; margin-bottom: 15px; font-size: 11px;">
        <input type="checkbox" id="modern-view-checkbox" name="view_mode" value="modern" checked>
        <label for="modern-view-checkbox">Use Modern Friendly View (no pop-ups)</label>
    </div>
  `
      : "";

  let formContent = `
        <div style="text-align: center; margin-bottom: 20px;">
          <p>This is a public demo. Please log in as a guest.</p>
        </div>
    `;

  let mainButtonsHtml = `
      <div class="button-container">
          <a href="/guest-login">Login as Guest</a>
      </div>
  `;

  if (!isGuestOnlyMode) {
    formContent = `
        <form action="/login" method="POST">
            ${modernFriendlyOption}
            <table class="form-table" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                    <td style="text-align: right; font-weight: bold; width: 100px;"><label for="userName-input">User Name:</label></td>
                    <td><input type="text" id="userName-input" name="userName" required style="width: 100%; box-sizing: border-box;" autocomplete="off" /></td>
                </tr>
                <tr>
                    <td style="text-align: right; font-weight: bold; width: 100px;"><label for="password-input">Password:</label></td>
                    <td><input type="password" id="password-input" name="password" required style="width: 100%; box-sizing: border-box;" /></td>
                </tr>
            </table>
            <div class="button-container">
                <input type="submit" value="Login">
            </div>
        </form>
      `;

    const newUserButtonText =
      profiles.length === 0 ? "Create Administrator" : "New Profile";

    const guestButtonHtml = guestModeEnabled
      ? `<a href="/guest-login">Login as Guest</a>`
      : `<span style="display:inline-block; width: 120px;"></span>`;

    mainButtonsHtml = `
        <div class="button-container">
            <a href="/new-user">${newUserButtonText}</a>
            ${guestButtonHtml}
        </div>
      `;
  }

  const bodyContent = `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="/icq-logo.gif" alt="ICQ Logo" width="64" height="64">
      </div>
      ${error ? `<div class="error-message">${escapeHtml(error)}</div>` : ""}
      ${formContent}
      ${mainButtonsHtml}
    `;

  return renderDialogWindow({ title, header, bodyContent });
}

function renderNewUserPage(error = null, isFirstUser = false) {
  const title = "Gemini 98 - New User";
  const header = isFirstUser ? "Create Administrator" : "Create New Profile";
  const submitText = isFirstUser ? "Create Admin" : "Create";

  const bodyContent = `
        ${error ? `<div class="error-message">${escapeHtml(error)}</div>` : ""}
        <form action="/create-user" method="POST">
            <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr><td style="text-align: right; width: 100px;"><label for="userName-input">User Name:</label></td><td><input type="text" id="userName-input" name="userName" autocomplete="off" required style="width: 100%; box-sizing: border-box;" /></td></tr>
                <tr><td style="text-align: right; width: 100px;"><label for="realName-input">Real Name:</label></td><td><input type="text" id="realName-input" name="realName" autocomplete="off" required style="width: 100%; box-sizing: border-box;" /></td></tr>
                <tr><td style="text-align: right; width: 100px;"><label for="password-input">Password:</label></td><td><input type="password" id="password-input" name="password" required style="width: 100%; box-sizing: border-box;" /></td></tr>
                <tr><td style="padding-top: 10px; text-align: right; width: 100px;"><label for="age-input">A/S/L - Age:</label></td><td style="padding-top: 10px;"><input type="text" id="age-input" name="age" required style="width: 50px;" maxlength="2" /></td></tr>
                <tr><td style="text-align: right; width: 100px;"><label for="sex-input">Sex:</label></td><td><select id="sex-input" name="sex"><option value="M">M</option><option value="F">F</option></select></td></tr>
                <tr><td style="text-align: right; width: 100px;"><label for="location-input">Location:</label></td><td><input type="text" id="location-input" name="location" autocomplete="off" required style="width: 100%; box-sizing: border-box;" maxlength="50" /></td></tr>
            </table>
          <div class="button-container">
              <input type="submit" value="${submitText}">
          </div>
        </form>
        <div class="button-container">
            <a href="/">Back to Login</a>
        </div>
    `;
  return renderDialogWindow({ title, header, bodyContent });
}

function renderLoginSuccessPage(isModernView = false) {
  const title = "Launch Successful";
  const styles = `
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; }
      .center-container { width: 100%; height: 100%; }
      #container { width: 380px; background-color: #C0C0C0; color: #000000; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; padding: 3px; }
      #content { padding: 20px; text-align: center; border: 1px solid #808080; background: #fff; }
      h2 { font-size: 14px; margin-top: 10px; margin-bottom: 10px; }
      p { font-size: 12px; margin-bottom: 20px; line-height: 1.4; }
      img { margin-bottom: 10px; }
    `;

  let script;
  if (isModernView) {
    // For modern view, just redirect the main window.
    script = `window.location.href = '/app';`;
  } else {
    // For retro view, use the pop-up.
    script = `
          try {
              var buddyWindow = window.open('/buddylist', 'buddy_list_main', 'width=300,height=580,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes');
              if (buddyWindow) {
                  buddyWindow.focus();
              } else {
                   var contentDiv = document.getElementById('content');
                   if(contentDiv) {
                      contentDiv.innerHTML = '<h2>Launch Failed!</h2><p>A popup blocker may have prevented the application from launching. Please allow popups for this site and try again.</p>';
                   }
              }
          } catch (e) {
              var contentDiv = document.getElementById('content');
              if(contentDiv) {
                  contentDiv.innerHTML = '<h2>Launch Failed!</h2><p>An unexpected error occurred while launching the application.</p>';
              }
          }
      `;
  }

  const body = `
      <table class="center-container" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" valign="middle">
            <div id="container">
                <div id="content">
                    <img src="/icq-online.gif" alt="Success" width="32" height="32">
                    <h2>Application Launched</h2>
                    <p>Your buddy list has been opened in a new window.<br>You may now close this launcher window.</p>
                </div>
            </div>
          </td>
        </tr>
      </table>
    `;

  return renderHtmlPage({ title, styles, body, scripts: script });
}

module.exports = {
  renderLauncherPage,
  renderNewUserPage,
  renderLoginSuccessPage,
};
