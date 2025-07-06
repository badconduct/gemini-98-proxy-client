const { renderHtmlPage } = require("./pageBuilder");

/**
 * Renders a standard, centered dialog window for pages like login, new user, etc.
 * @param {string} title The title of the HTML page.
 * @param {string} header The text to display in the dialog's title bar.
 * @param {string} bodyContent The main HTML content to place inside the dialog.
 * @param {string} scripts Optional JavaScript to include.
 * @returns {string} The full HTML page.
 */
function renderDialogWindow({ title, header, bodyContent, scripts = "" }) {
  const styles = `
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; }
      .center-container { width: 100%; height: 100%; }
      #container { width: 450px; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #C0C0C0; padding: 3px; }
      #header { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between; }
      #header img { width: 16px; height: 16px; }
      #content { padding: 20px; background-color: #C0C0C0; border: 1px solid #808080; border-top-color: #000; border-left-color: #000; border-right-color: #fff; border-bottom-color: #fff; }
      .button-container { text-align: center; margin-top: 20px; }
      .button-container input, .button-container a { display: inline-block; width: 120px; margin: 0 5px; text-decoration: none; text-align: center; padding: 5px 0; border-top: 1px solid #fff; border-left: 1px solid #fff; border-right: 1px solid #000; border-bottom: 1px solid #000; background-color: #C0C0C0; color: #000; }
      .error-message { color: #FF0000; text-align: center; margin-bottom: 10px; font-weight: bold; }
    `;

  const body = `
      <table class="center-container" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle">
        <div id="container">
          <div id="header">
            <span>${header}</span>
            <img src="/icq-logo.gif" alt="ICQ">
          </div>
          <div id="content">
            ${bodyContent}
          </div>
        </div>
      </td></tr></table>
    `;

  return renderHtmlPage({ title, styles, body, scripts });
}

module.exports = {
  renderDialogWindow,
};
