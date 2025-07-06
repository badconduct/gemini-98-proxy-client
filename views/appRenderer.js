const { escapeHtml } = require("../lib/utils");
const {
  ALL_PERSONAS,
  UTILITY_BOTS,
  FRIEND_PERSONAS,
} = require("../config/personas");
const { renderHtmlPage } = require("./pageBuilder");

function renderBuddyListPage(
  worldState,
  onlineFriendKeys,
  offlineFriendKeys,
  isAdmin = false
) {
  const { userName } = worldState;

  const createLinks = (keys, isOffline = false) => {
    return keys
      .map((key) => {
        const persona = ALL_PERSONAS.find((p) => p.key === key);
        if (!persona) return "";

        const isBlocked =
          worldState.moderation[key] && worldState.moderation[key].blocked;
        const useOfflineIcon = isOffline || isBlocked;

        let icon;
        if (isBlocked) {
          icon = "/icq-blocked.gif";
        } else {
          icon = useOfflineIcon ? "/icq-offline.gif" : "/icq-online.gif";
        }

        const statusParam = useOfflineIcon ? "&status=offline" : "";
        const url = `/chat?friend=${persona.key}${statusParam}`;

        let cssClass = "buddy";
        if (isBlocked) cssClass += " blocked-buddy";
        else if (useOfflineIcon) cssClass += " offline-buddy";

        const onclick = isBlocked
          ? `window.open('/apology?friend=${persona.key}', 'apology_${persona.key}', 'width=400,height=300,resizable=yes,scrollbars=yes'); return false;`
          : `window.open('${url}', 'chat_${persona.key}', 'width=520,height=550,resizable=yes,scrollbars=yes'); return false;`;

        const displayName = persona.screenName
          ? persona.screenName
          : persona.name;
        const title = persona.screenName ? persona.name : "";

        return `<div class="${cssClass}"><img src="${icon}" alt="Status"><a href="#" title="${escapeHtml(
          title
        )}" onclick="${onclick}">${escapeHtml(displayName)}</a></div>`;
      })
      .join("");
  };

  const onlineFriends = createLinks(onlineFriendKeys, false);
  const offlineFriends = createLinks(offlineFriendKeys, true);

  const botKeys = UTILITY_BOTS.map((b) => b.key);
  const botLinks = createLinks(botKeys);

  const logoutScript = `if(confirm('Are you sure you want to log out?')){ if(window.opener && !window.opener.closed){ window.opener.location.href='/logout'; } window.close(); } return false;`;

  let adminLinks = "";
  if (isAdmin) {
    adminLinks = `
            <a href="/admin/users" onclick="window.open('/admin/users', 'users_window', 'width=450,height=400,resizable=yes,scrollbars=yes'); return false;">Users</a>
            <a href="/admin/options" onclick="window.open('/admin/options', 'options_window', 'width=450,height=500,resizable=yes,scrollbars=yes'); return false;">Options</a>
        `;
  }

  const styles = `
      html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
      body { background-color: #C0C0C0; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; }
      .container-table { width: 100%; height: 100%; border-collapse: collapse; border: 3px solid #C0C0C0; border-top-color: #FFFFFF; border-left-color: #FFFFFF; border-right-color: #000000; border-bottom-color: #000000; }
      h1 { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin: 0; }
      h1 span { float: left; } h1 img { float: right; }
      #menu-bar { clear: both; background-color: #C0C0C0; border-top: 1px solid #808080; border-bottom: 1px solid #808080; padding: 2px 5px; font-size: 11px; }
      #menu-bar a { text-decoration: none; color: #000000; margin-right: 15px; }
      #menu-bar a:hover { background-color: #000080; color: #FFFFFF; }
      #buddy-list-container { height: 100%; }
      #buddy-list { background-color: #FFFFFF; border: 1px solid #000000; padding: 10px; height: 100%; box-sizing: border-box; overflow-y: auto; }
      .buddy-group { font-weight: bold; margin-top: 10px; margin-bottom: 5px; }
      .buddy-group:first-child { margin-top: 0; }
      .buddy { margin-left: 10px; margin-bottom: 5px; }
      .buddy a { text-decoration: none; color: #000000; }
      .offline-buddy a, .blocked-buddy a { color: #808080; }
      .blocked-buddy a { text-decoration: line-through; }
      .buddy img { vertical-align: middle; margin-right: 5px; width: 16px; height: 16px; }
      .icq-logo { width: 16px; height: 16px; }
    `;
  const body = `
        <table class="container-table" cellpadding="0" cellspacing="0">
            <tr><td style="height: 1px;">
                <h1><span>${escapeHtml(
                  userName
                )}'s List</span><img src="/icq-logo.gif" class="icq-logo" alt="ICQ"></h1>
            </td></tr>
            <tr><td style="height: 1px;">
                <div id="menu-bar">
                    <a href="/files" onclick="window.open('/files', 'files_window', 'width=450,height=400,resizable=yes,scrollbars=yes'); return false;">Files</a>
                    ${adminLinks}
                    <a href="#" onclick="${logoutScript}">Logout</a>
                </div>
            </td></tr>
            <tr><td id="buddy-list-container">
                <div id="buddy-list">
                    <div class="buddy-group">Friends</div>
                    ${onlineFriends}
                    ${offlineFriends}
                    <div class="buddy-group">Bots</div>
                    ${botLinks}
                </div>
            </td></tr>
        </table>
    `;
  return renderHtmlPage({
    title: `${escapeHtml(userName)}'s Buddy List`,
    styles,
    body,
  });
}

function renderChatMessagesHtml(history, userName) {
  return history
    .split("\n\n")
    .filter((line) => line.trim())
    .map((line) => {
      const systemMatch = line.match(/^System:\s\(([^)]+)\)\s(.*)$/s);
      if (systemMatch) {
        return `<div class="message message-system">--- ${escapeHtml(
          systemMatch[2].trim()
        )} ---</div>`;
      }

      const imageMatch = line.match(/^Image:\s(.*)$/);
      if (imageMatch) {
        return `<div class="message message-bot"><img src="${escapeHtml(
          imageMatch[1]
        )}" alt="A photo" width="300" border="1"></div>`;
      }

      const parts = line.match(/^([^:]+):\s\(([^)]+)\)\s(.*)$/s);
      if (!parts) return "";

      const [_, sender, time, message] = parts;
      const className =
        sender.trim() === userName ? "message-user" : "message-bot";
      const formattedMessage =
        sender.trim() === userName
          ? `(${escapeHtml(time)}) <b>${escapeHtml(
              sender
            )}:</b><br>${escapeHtml(message.trim())}`
          : `<b>${escapeHtml(sender)}</b> (${escapeHtml(
              time
            )}):<br>${escapeHtml(message.trim())}`;

      return `<div class="message ${className}">${formattedMessage.replace(
        /\n/g,
        "<br />"
      )}</div>`;
    })
    .join("");
}

function renderChatWindowPage({
  persona,
  worldState,
  history,
  isOffline = false,
  isBlocked = false,
  metaRefreshTag = "",
  showScores = false,
}) {
  const { userName } = worldState;
  const friendKey = persona.key;
  const historyBase64 = Buffer.from(history).toString("base64");
  const chatHistoryHtml = renderChatMessagesHtml(history, userName);

  let relationshipScoreText = "";
  const friendPersona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
  if (
    showScores &&
    friendPersona &&
    worldState.userScores[friendKey] !== undefined
  ) {
    relationshipScoreText = `Relationship: ${worldState.userScores[friendKey]}/100`;
  }

  const isDisabled = isOffline || isBlocked || metaRefreshTag !== ""; // Also disable input while polling

  let promptText = "";
  if (isBlocked) {
    promptText = "You have been blocked by this user.";
  } else if (isOffline) {
    promptText = "The user is currently offline.";
  }

  const headerText = friendPersona
    ? `${escapeHtml(persona.name)}${
        relationshipScoreText ? ` (${relationshipScoreText})` : ""
      }`
    : escapeHtml(persona.name);

  const styles = `
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 10px; margin: 0; padding: 0; overflow: hidden; }
      /* Table-based layout for IE6 compatibility */
      #chat-table { width: 100%; height: 100%; border-collapse: collapse; border: 2px solid #000000; border-top-color: #FFFFFF; border-left-color: #FFFFFF; background-color: #C0C0C0; }
      #header-td { height: 1px; padding: 3px 3px 0 3px; }
      #messages-td { height: 100%; padding: 3px; }
      #form-td { height: 1px; padding: 0 3px 3px 3px; }
      
      /* Header styles */
      #header { height: 24px; background: #000080; color: #FFFFFF; font-size: 12px; font-weight: bold; line-height: 24px; padding: 0 8px; }
      #header img { vertical-align: middle; margin-right: 8px; }

      /* Message area styles */
      #chat-messages { width: 100%; height: 100%; box-sizing: border-box; overflow-y: scroll; border: 2px inset #808080; background-color: #FFFFE1; padding: 10px; text-align: left; }
      .message { margin-bottom: 5px; white-space: normal; word-wrap: break-word; }
      .message-user { color: #0000FF; text-align: right; }
      .message-bot { color: #FF0000; text-align: left; }
      .message-system { color: #808080; font-style: italic; text-align: center; }
      .message img { max-width: 100%; height: auto; }

      /* Input form styles */
      #input-form { height: 80px; }
      #prompt-input { width: 100%; height: 50px; box-sizing: border-box; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 10px; border: 2px inset #808080; }
      #prompt-input.disabled { background-color: #C0C0C0; }
      #send-button { float: left; width: 80px; height: 24px; background-color: #C0C0C0; border: 2px outset #FFFFFF; cursor: pointer; margin-top: 3px; }
      #send-button.disabled { border-style: inset; color: #808080; cursor: default; }
      #clear-link { float: right; font-size: 10px; margin-top: 8px; margin-right: 8px; }
    `;
  const clearScript = `if(confirm('Are you sure you want to permanently delete this chat history?')){ window.location.href='/chat/clear?friend=${escapeHtml(
    friendKey
  )}'; } return false;`;
  const body = `
      <table id="chat-table" cellpadding="0" cellspacing="0">
        <tr>
          <td id="header-td">
            <div id="header"><img src="/icq-logo.gif" width="16" height="16">Chat with ${headerText}</div>
          </td>
        </tr>
        <tr>
          <td id="messages-td">
            <div id="chat-messages">${chatHistoryHtml}</div>
          </td>
        </tr>
        <tr>
          <td id="form-td">
            <form id="input-form" action="/chat" method="POST">
              <textarea id="prompt-input" name="prompt" rows="3" class="${
                isDisabled ? "disabled" : ""
              }" ${isDisabled ? "disabled" : ""}>${escapeHtml(
    promptText
  )}</textarea>
              <input type="hidden" name="friend" value="${escapeHtml(
                friendKey
              )}">
              <input type="hidden" name="history" value="${historyBase64}">
              <input type="submit" id="send-button" value="Send" class="${
                isDisabled ? "disabled" : ""
              }" ${isDisabled ? "disabled" : ""}>
              <a id="clear-link" href="#" onclick="${clearScript}">Clear</a>
            </form>
          </td>
        </tr>
      </table>
    `;
  const script = `
        (function() {
          try {
            var chatMessages = document.getElementById('chat-messages');
            chatMessages.scrollTop = chatMessages.scrollHeight;
            var input = document.getElementById('prompt-input');
            if (input && !input.disabled) {
              input.focus();
            }
          } catch(e) {}
        })();
    `;
  return renderHtmlPage({
    title: `Chat with ${escapeHtml(persona.name)}`,
    styles,
    body,
    scripts: script,
    metaRefreshTag,
  });
}

function renderApologyPage(persona, worldState) {
  const friendKey = persona.key;

  const styles = `
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; margin: 0; padding: 20px; text-align: center; }
      #container { width: 350px; margin: 0 auto; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #C0C0C0; padding: 3px; text-align: left; }
      h1 { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin: 0; }
      #apology-form { padding: 20px; background-color: #FFFFFF; border: 1px solid #000000; }
      p { margin-top: 0; }
      textarea { width: 100%; height: 100px; box-sizing: border-box; margin-bottom: 15px; }
      #submit-button { display: block; margin: 0 auto; width: 120px; }
    `;

  const body = `
      <div id="container">
        <h1>Apology to ${escapeHtml(persona.name)}</h1>
        <form id="apology-form" action="/apologize" method="POST">
          <p>You have been blocked by ${escapeHtml(
            persona.name
          )}. You have one chance to write a sincere apology. If they accept, you will be unblocked.</p>
          <textarea name="apologyText" required></textarea>
          <input type="hidden" name="friend" value="${escapeHtml(friendKey)}">
          <input type="submit" id="submit-button" value="Send Apology">
        </form>
      </div>
    `;

  return renderHtmlPage({
    title: `Apology to ${escapeHtml(persona.name)}`,
    styles,
    body,
  });
}

function renderFilesPage(worldState) {
  const { receivedFiles = [] } = worldState;

  let filesHtml = "";
  if (receivedFiles.length === 0) {
    filesHtml = "<p>You have not received any files yet.</p>";
  } else {
    filesHtml = receivedFiles
      .map((file) => {
        const date = new Date(file.date);
        const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
        return `
                <div class="file-item">
                    <a href="${escapeHtml(
                      file.url
                    )}" target="_blank"><img src="${escapeHtml(
          file.url
        )}" alt="Thumbnail" width="50" height="50" border="1"></a>
                    <div class="file-info">
                        <b>File:</b> <a href="${escapeHtml(
                          file.url
                        )}" target="_blank">${escapeHtml(
          file.url.split("/").pop()
        )}</a><br>
                        <b>From:</b> ${escapeHtml(file.senderName)}<br>
                        <b>Date:</b> ${formattedDate}
                    </div>
                </div>
            `;
      })
      .join("");
  }

  const styles = `
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; margin: 0; padding: 20px; text-align: center; }
      #container { width: 400px; margin: 0 auto; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #C0C0C0; padding: 3px; text-align: left; }
      h1 { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin: 0; }
      #files-container { padding: 20px; background-color: #FFFFFF; border: 1px solid #000000; min-height: 200px; }
      .file-item { display: flex; align-items: center; border-bottom: 1px solid #C0C0C0; padding: 10px 0; }
      .file-item:last-child { border-bottom: none; }
      .file-item img { margin-right: 15px; }
      .file-info { line-height: 1.5; }
      .file-info a { text-decoration: none; color: #0000FF; }
    `;
  const body = `
        <div id="container">
            <h1>Received Files</h1>
            <div id="files-container">
                ${filesHtml}
            </div>
        </div>
    `;

  return renderHtmlPage({ title: "Received Files", styles, body });
}

module.exports = {
  renderBuddyListPage,
  renderChatWindowPage,
  renderApologyPage,
  renderFilesPage,
};
