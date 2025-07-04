const { escapeHtml } = require("../lib/utils");
const {
  ALL_PERSONAS,
  UTILITY_BOTS,
  FRIEND_PERSONAS,
} = require("../config/personas");

/**
 * Creates a complete HTML page with a consistent structure.
 * @param {{title: string, styles: string, body: string, scripts?: string}} options
 * @returns {string} The full HTML document.
 */
function renderHtmlPage({ title, styles, body, scripts = "" }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <link rel="shortcut icon" href="/favicon.ico">
    <meta http-equiv="Content-Type" content="text/html; charset=windows-1252">
    <style type="text/css">${styles}</style>
  </head>
  <body>
    ${body}
    ${scripts ? `<script>${scripts}</script>` : ""}
  </body>
</html>`;
}

function renderLoginPage() {
  const styles = `
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; margin: 0; padding: 20px; text-align: center; }
      #container { width: 300px; margin: 0 auto; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #C0C0C0; padding: 3px; text-align: left; }
      h1 { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin: 0; }
      #login-form { padding: 20px; background-color: #FFFFFF; border: 1px solid #000000; }
      label { display: block; margin-bottom: 5px; margin-top: 10px; }
      input[type="text"] { width: 100%; box-sizing: border-box; }
      #login-button { display: block; margin: 20px auto 0 auto; width: 100px; }
    `;
  const body = `
      <div id="container">
        <h1>Welcome to ICQ 98</h1>
        <form id="login-form" action="/buddylist" method="GET">
          <label for="userName-input">User Name:</label>
          <input type="text" id="userName-input" name="userName" autocomplete="off" required />
          <label for="realName-input">Real Name:</label>
          <input type="text" id="realName-input" name="realName" autocomplete="off" required />
          <input type="submit" id="login-button" value="Login">
        </form>
      </div>
    `;
  return renderHtmlPage({ title: "Gemini 98 - Login", styles, body });
}

function renderBuddyListPage(worldState, onlineFriendKeys, offlineFriendKeys) {
  const { userName, realName } = worldState;

  const createLinks = (keys, isOffline = false) => {
    return keys
      .map((key) => {
        const persona = ALL_PERSONAS.find((p) => p.key === key);
        if (!persona) return "";

        const isBlocked = worldState.moderation[key]?.blocked;
        const useOfflineIcon = isOffline || isBlocked;

        let icon = useOfflineIcon ? "/icq-offline.png" : "/icq-online.png";
        if (isBlocked) icon = "/icq-blocked.png";

        const statusParam = useOfflineIcon ? "&status=offline" : "";
        const url = `/chat?friend=${persona.key}&userName=${encodeURIComponent(
          userName
        )}&realName=${encodeURIComponent(realName)}${statusParam}`;

        let cssClass = "buddy";
        if (isBlocked) cssClass += " blocked-buddy";
        else if (useOfflineIcon) cssClass += " offline-buddy";

        const onclick = isBlocked
          ? `window.open('/apology?friend=${
              persona.key
            }&userName=${encodeURIComponent(
              userName
            )}&realName=${encodeURIComponent(realName)}', 'apology_${
              persona.key
            }', 'width=400,height=300,resizable=yes,scrollbars=yes'); return false;`
          : `window.open('${url}', 'chat_${persona.key}', 'width=520,height=550,resizable=yes,scrollbars=yes'); return false;`;

        const displayName = persona.screenName || persona.name;
        const title = persona.screenName ? persona.name : "";

        return `<div class="${cssClass}"><img src="${icon}" alt="Status"><a href="#" title="${escapeHtml(
          title
        )}" onclick="${onclick}">${escapeHtml(displayName)}</a></div>`;
      })
      .join("");
  };

  const onlineFriends = createLinks(onlineFriendKeys, false);
  const offlineFriends = createLinks(offlineFriendKeys, true);
  const botLinks = createLinks(UTILITY_BOTS.map((b) => b.key));

  const styles = `
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; margin: 0; padding: 20px; text-align: center; }
      #container { width: 250px; margin: 0 auto; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #C0C0C0; padding: 3px; text-align: left; }
      h1 { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin: 0; }
      h1 span { float: left; } h1 img { float: right; }
      #menu-bar { clear: both; background-color: #C0C0C0; border-top: 1px solid #808080; border-bottom: 1px solid #808080; padding: 2px 5px; font-size: 11px; }
      #menu-bar a { text-decoration: none; color: #000000; }
      #menu-bar a:hover { background-color: #000080; color: #FFFFFF; }
      #buddy-list { clear: both; background-color: #FFFFFF; border: 1px solid #000000; padding: 10px; }
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
      <div id="container">
         <h1><span>${escapeHtml(
           userName
         )}'s List</span><img src="/icq-logo.gif" class="icq-logo" alt="ICQ"></h1>
         <div id="menu-bar">
            <a href="#" onclick="if(confirm('Are you sure you want to reset the simulation? All relationships and chat history will be lost.')) { window.location.href = '/reset'; } return false;">Reset Simulation</a>
         </div>
        <div id="buddy-list">
          <div class="buddy-group">Friends</div>
          ${onlineFriends}
          ${offlineFriends}
          <div class="buddy-group">Bots</div>
          ${botLinks}
        </div>
      </div>
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
      return `<div class="message ${className}">${formattedMessage}</div>`;
    })
    .join("");
}

function renderChatWindowPage(
  persona,
  worldState,
  history,
  isOffline,
  isBlocked
) {
  const { userName, realName } = worldState;
  const friendKey = persona.key;
  const historyBase64 = Buffer.from(history).toString("base64");
  const chatHistoryHtml = renderChatMessagesHtml(history, userName);

  const friendPersona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
  const relationshipScore =
    friendPersona && worldState.userScores[friendKey] !== undefined
      ? `Relationship: ${worldState.userScores[friendKey]}/10`
      : "";

  const promptText = isBlocked
    ? "You have been blocked by this user."
    : isOffline
    ? "The user is currently offline."
    : "";

  const isDisabled = isOffline || isBlocked;

  const styles = `
      html, body {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background-color: #008080;
        font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif;
        font-size: 10px;
      }
      #chat-container {
        width: 100%;
        height: 100%;
        border: 2px solid #000000;
        border-top-color: #FFFFFF;
        border-left-color: #FFFFFF;
        background-color: #C0C0C0;
        padding: 3px;
        box-sizing: border-box;
      }
      #header {
        position: absolute;
        top: 3px;
        left: 3px;
        right: 3px;
        height: 24px;
        background: #000080;
        color: #FFFFFF;
        font-size: 12px;
        font-weight: bold;
        line-height: 24px;
        padding: 0 8px;
      }
      #header img { vertical-align: middle; margin-right: 8px; }
      #chat-messages {
        position: absolute;
        top: 30px;
        left: 3px;
        right: 3px;
        bottom: 85px;
        overflow-y: scroll;
        border: 2px inset #808080;
        background-color: #FFFFE1;
        padding: 10px;
        text-align: left;
      }
      .message { margin-bottom: 5px; white-space: pre-wrap; word-wrap: break-word; zoom: 1; }
      .message-user { color: #0000FF; text-align: right; }
      .message-bot { color: #FF0000; text-align: left; }
      .message-system { color: #808080; font-style: italic; text-align: center; }
      #input-form {
        position: absolute;
        bottom: 3px;
        left: 3px;
        right: 3px;
        height: 80px;
      }
      #prompt-input {
        width: 100%;
        height: 50px;
        box-sizing: border-box;
        font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif;
        font-size: 10px;
        border: 2px inset #808080;
      }
      #prompt-input.disabled { background-color: #C0C0C0; }
      #send-button {
        float: left;
        width: 80px;
        height: 24px;
        background-color: #C0C0C0;
        border: 2px outset #FFFFFF;
        cursor: pointer;
        margin-top: 3px;
      }
      #send-button.disabled {
        border-style: inset;
        color: #808080;
        cursor: default;
      }
      #clear-link {
        float: right;
        font-size: 10px;
        margin-top: 8px;
        margin-right: 8px;
      }
    `;

  const body = `
      <div id="chat-container">
        <div id="header"><img src="/icq-logo.gif" width="16" height="16">Chat with ${escapeHtml(
          persona.name
        )}${relationshipScore ? " (" + relationshipScore + ")" : ""}</div>
        <div id="chat-messages">${chatHistoryHtml}</div>
        <form id="input-form" action="/chat" method="POST">
          <textarea id="prompt-input" name="prompt" class="${
            isDisabled ? "disabled" : ""
          }" ${isDisabled ? "disabled" : ""}>${escapeHtml(
    promptText
  )}</textarea>
          <input type="hidden" name="friend" value="${escapeHtml(friendKey)}">
          <input type="hidden" name="userName" value="${escapeHtml(userName)}">
          <input type="hidden" name="realName" value="${escapeHtml(realName)}">
          <input type="hidden" name="history" value="${historyBase64}">
          <input type="submit" id="send-button" value="Send" class="${
            isDisabled ? "disabled" : ""
          }" ${isDisabled ? "disabled" : ""}>
          <a id="clear-link" href="/chat?friend=${encodeURIComponent(
            friendKey
          )}&userName=${encodeURIComponent(
    userName
  )}&realName=${encodeURIComponent(realName)}">Clear</a>
        </form>
      </div>
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
  });
}

function renderApologyPage(persona, worldState) {
  const { userName, realName } = worldState;
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
          <input type="hidden" name="userName" value="${escapeHtml(userName)}">
          <input type="hidden" name="realName" value="${escapeHtml(realName)}">
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

module.exports = {
  renderLoginPage,
  renderBuddyListPage,
  renderChatWindowPage,
  renderApologyPage,
};
