const { escapeHtml } = require("../lib/utils");
const { renderHtmlPage } = require("./pageBuilder");

function renderUsersPage({ users, adminUserName }) {
  const title = "User Management";
  const styles = `
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; margin: 0; padding: 20px; text-align: center; }
      #container { width: 400px; margin: 0 auto; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #C0C0C0; padding: 3px; text-align: left; }
      h1 { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin: 0; }
      #users-container { padding: 10px; background-color: #FFFFFF; border: 1px solid #000000; min-height: 200px; max-height: 300px; overflow-y: auto; }
      .users-table { width: 100%; border-collapse: collapse; }
      .users-table th, .users-table td { border: 1px solid #C0C0C0; padding: 5px; text-align: left; vertical-align: middle; }
      .users-table th { background-color: #E0E0E0; font-weight: bold; }
      .delete-button { font-size: 10px; padding: 1px 3px; }
      .action-buttons { text-align: right; margin-top: 10px; padding: 0 10px 10px; }
      .save-button { font-size: 12px; padding: 3px 8px; }
    `;
  let usersHtml = "<p>No users found.</p>";
  if (users && users.length > 0) {
    const tableRows = users
      .map((user) => {
        const lastLoginStr = user.lastLogin
          ? new Date(user.lastLogin).toLocaleString()
          : "Never";

        // Prime admin cannot be deleted.
        const deleteButtonHtml = user.isPrimeAdmin
          ? ""
          : `
                <form action="/admin/delete-user" method="POST" style="margin:0;" onsubmit="return confirm('Are you sure you want to permanently delete the user ${escapeHtml(
                  user.name
                )}? This cannot be undone.');">
                    <input type="hidden" name="userNameToDelete" value="${escapeHtml(
                      user.name
                    )}">
                    <input type="submit" value="Delete" class="delete-button">
                </form>
            `;

        // Prime admin is always admin and cannot be demoted.
        const isAdminCheckbox = `
                <input type="checkbox" name="admins" value="${escapeHtml(
                  user.name
                )}" 
                    ${user.isAdmin ? "checked" : ""} 
                    ${user.isPrimeAdmin ? "disabled" : ""}>
            `;

        return `<tr>
                        <td>${escapeHtml(user.name)}${
          user.isPrimeAdmin ? " (Prime)" : ""
        }</td>
                        <td>${escapeHtml(lastLoginStr)}</td>
                        <td align="center">${isAdminCheckbox}</td>
                        <td>${deleteButtonHtml}</td>
                    </tr>`;
      })
      .join("");
    usersHtml = `
            <table class="users-table">
                <tr><th>User Name</th><th>Last Login</th><th>Admin</th><th>Actions</th></tr>
                ${tableRows}
            </table>
        `;
  }

  const body = `
        <div id="container">
            <form action="/admin/update-users" method="POST">
                <h1>Registered Users</h1>
                <div id="users-container">
                    ${usersHtml}
                </div>
                <div class="action-buttons">
                    <input type="submit" value="Save Admin Status" class="save-button">
                </div>
            </form>
        </div>
    `;

  return renderHtmlPage({ title, styles, body });
}

module.exports = {
  renderUsersPage,
};
