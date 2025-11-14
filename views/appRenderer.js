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
  isAdmin = false,
  isFrameView = false
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
        const score = worldState.userScores[key];
        const isBFF = score === 100;

        let icon;
        if (useOfflineIcon) {
          icon = isBlocked ? "/icq-blocked.gif" : "/icq-offline.gif";
        } else {
          icon = isBFF ? "/icq-bff.gif" : "/icq-online.gif";
        }

        const statusParam = useOfflineIcon ? "&status=offline" : "";

        let url = `/chat?friend=${persona.key}${statusParam}`;
        if (isFrameView) url += "&view=frame";

        let cssClass = "buddy";
        if (isBFF && !useOfflineIcon) {
          cssClass += " bff-buddy";
        } else if (isBlocked) {
          cssClass += " blocked-buddy";
        } else if (useOfflineIcon) {
          cssClass += " offline-buddy";
        }

        const onclick = isFrameView
          ? `parent.frames['chat_frame'].location.href='${url}'; return false;`
          : isBlocked
          ? `window.open('/apology?friend=${persona.key}', 'apology_${persona.key}', 'width=400,height=300,resizable=yes,scrollbars=yes'); return false;`
          : `window.open('${url}', 'chat_${persona.key}', 'width=520,height=600,resizable=yes,scrollbars=yes'); return false;`;

        const displayName = persona.screenName
          ? persona.screenName
          : persona.name;
        const title = persona.screenName ? persona.name : "";

        return `<div id="buddy-container-${key}" class="${cssClass}"><img id="buddy-icon-${key}" src="${icon}" alt="Status"><a href="#" title="${escapeHtml(
          title
        )}" onclick="${onclick}">${escapeHtml(displayName)}</a></div>`;
      })
      .join("");
  };

  const friendGroups = [
    { id: "student", name: "Students" },
    { id: "townie_alumni", name: "Townies/Alumni" },
    { id: "online", name: "Online Friends" },
  ];

  let friendsHtml = "";
  friendGroups.forEach((groupInfo) => {
    const groupPersonas = FRIEND_PERSONAS.filter(
      (p) => p.group === groupInfo.id
    );
    if (groupPersonas.length === 0) return;

    const onlineInGroup = groupPersonas
      .map((p) => p.key)
      .filter((key) => onlineFriendKeys.includes(key));
    const offlineInGroup = groupPersonas
      .map((p) => p.key)
      .filter((key) => offlineFriendKeys.includes(key));

    if (onlineInGroup.length > 0 || offlineInGroup.length > 0) {
      friendsHtml += `<div class="buddy-group">${escapeHtml(
        groupInfo.name
      )}</div>`;
      friendsHtml += createLinks(onlineInGroup, false);
      friendsHtml += createLinks(offlineInGroup, true);
    }
  });

  const botKeys = UTILITY_BOTS.map((b) => b.key);
  const botLinks = createLinks(botKeys);

  let logoutScript;
  if (isFrameView) {
    // For the modern frameset view, redirect the top-level window to log out.
    logoutScript = `if(confirm('Are you sure you want to log out?')){ top.location.href = '/logout'; } return false;`;
  } else {
    // For the classic pop-up view, redirect the opener and close the pop-up.
    logoutScript = `if(confirm('Are you sure you want to log out?')){ if(window.opener && !window.opener.closed){ window.opener.location.href='/logout'; } window.close(); } return false;`;
  }
  const aboutScript = `window.open('/about', 'about_window', 'width=350,height=280,resizable=no,scrollbars=no'); return false;`;

  let adminLinks = "";
  if (isAdmin) {
    adminLinks = `
            <a href="/admin/users" onclick="window.open('/admin/users', 'width=700,height=400,resizable=yes,scrollbars=yes'); return false;">Users</a>
            <a href="/admin/options" onclick="window.open('/admin/options', 'options_window', 'width=450,height=500,resizable=yes,scrollbars=yes'); return false;">Options</a>
        `;
  }

  const styles = `
      html, body { height: 100%; margin: 0; padding: 0; }
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
      .bff-buddy a { color: #8B008B; font-weight: bold; }
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
                    <a href="#" onclick="${aboutScript}">About</a>
                    <a href="/files" onclick="window.open('/files', 'files_window', 'width=450,height=400,resizable=yes,scrollbars=yes'); return false;">Files</a>
                    ${adminLinks}
                    <a href="#" onclick="${logoutScript}">Logout</a>
                </div>
            </td></tr>
            <tr><td id="buddy-list-container">
                <div id="buddy-list">
                    ${friendsHtml}
                    <div class="buddy-group">Bots</div>
                    ${botLinks}
                </div>
            </td></tr>
        </table>
    `;

  const scripts = `
      function updateBuddyStatus(friendKey, newIcon, newClassName) {
          try {
              var buddyDiv = document.getElementById('buddy-container-' + friendKey);
              var buddyImg = document.getElementById('buddy-icon-' + friendKey);
              if (buddyDiv && buddyImg) {
                  buddyDiv.className = newClassName;
                  buddyImg.src = newIcon;
              }
          } catch(e) {
              // Fails silently in old browsers
          }
      }
    `;

  if (isFrameView) {
    const frameBodyStyles = `
            html, body { height: 100%; margin: 0; padding: 0; }
            body { 
                background-color: #C0C0C0; 
                font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; 
                font-size: 12px;
                /* Allow the frame's native scrollbars to work */
            }
        `;
    return renderHtmlPage({
      title: `${escapeHtml(userName)}'s Buddy List`,
      styles: styles.replace(/body {[^}]+}/, frameBodyStyles), // Replace the main body style
      body,
      scripts,
      metaRefreshTag: "", // No refresh for framed view
    });
  }

  return renderHtmlPage({
    title: `${escapeHtml(userName)}'s Buddy List`,
    styles,
    body,
    scripts,
    metaRefreshTag: '<meta http-equiv="refresh" content="60">', // Refresh every 60 seconds
  });
}

function renderChatMessagesHtml(history, userName) {
  const messages = history.split(
    /\n\n(?=(?:System:|Image:|(?:[^:]+:\s\([^)]+\)\s)))/
  );

  return messages
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

      const processedMessage = escapeHtml(message.trim()).replace(
        /\n/g,
        "<br />"
      );

      const formattedMessage =
        sender.trim() === userName
          ? `(${escapeHtml(time)}) <b>${escapeHtml(
              sender
            )}:</b><br>${processedMessage}`
          : `<b>${escapeHtml(sender)}</b> (${escapeHtml(
              time
            )}):<br>${processedMessage}`;

      return `<div class="message ${className}">${formattedMessage}</div>`;
    })
    .join("");
}

function renderChatWindowPage({
  persona,
  worldState,
  history,
  isOffline = false,
  isBlocked = false,
  isTyping = false,
  metaRefreshTag = "",
  showScores = false,
  statusUpdate = null,
  isFrameView = false,
}) {
  const { userName } = worldState;
  const friendKey = persona.key;
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

  const isBot = UTILITY_BOTS.some((p) => p.key === friendKey);
  const isDisabled = isOffline || isBlocked || isTyping; // Input disabled if offline, blocked, or AI is typing

  let promptText = "";
  if (isBlocked) {
    promptText = "You have been blocked by this user.";
  } else if (isOffline) {
    promptText = "The user is currently offline.";
  } else if (isTyping) {
    promptText = ""; // Clear prompt when AI is typing
  }

  const typingIndicatorVerb = isBot ? "thinking" : "typing";
  const typingIndicatorHtml = isTyping
    ? `<div id="typing-indicator">
         <img src="/icq-online.gif" alt="" width="16" height="16">
         <i>${escapeHtml(
           persona.screenName || persona.name
         )} is ${typingIndicatorVerb}...</i>
       </div>`
    : "";

  const displayName = escapeHtml(persona.screenName || persona.name);
  const realNameTooltip = `Real Name: ${escapeHtml(persona.name)}`;

  const headerText = friendPersona
    ? `${displayName}${
        relationshipScoreText ? ` (${relationshipScoreText})` : ""
      }`
    : displayName;

  let postAction = "/chat";
  if (isFrameView) postAction += `?view=frame`;

  const styles = `
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 10px; margin: 0; padding: 0; }
      #chat-table { width: 100%; border-collapse: collapse; border: 2px solid #000000; border-top-color: #FFFFFF; border-left-color: #FFFFFF; background-color: #C0C0C0; }
      #header-td { height: 1px; padding: 3px 3px 0 3px; }
      #messages-td { padding: 3px; }
      #form-td { height: 1px; padding: 0 3px 3px 3px; }
      #header { height: 24px; background: #000080; color: #FFFFFF; font-size: 12px; font-weight: bold; line-height: 24px; padding: 0 8px; }
      #header img { vertical-align: middle; margin-right: 8px; }
      #chat-messages { width: 100%; box-sizing: border-box; overflow-y: scroll; border: 2px inset #808080; background-color: #FFFFE1; padding: 10px; text-align: left; }
      .message { margin-bottom: 5px; white-space: normal; word-wrap: break-word; }
      .message-user { color: #0000FF; text-align: right; }
      .message-bot { color: #FF0000; text-align: left; }
      .message-system { color: #808080; font-style: italic; text-align: center; }
      .message img { max-width: 100%; height: auto; }
      #input-form-container { border: 1px solid #808080; border-top-color: #000; border-left-color: #000; border-right-color: #fff; border-bottom-color: #fff; background: #c0c0c0; padding: 2px; }
      #typing-indicator { font-size: 10px; color: #333; padding: 2px 5px 4px 5px; font-style: italic; }
      #typing-indicator img { vertical-align: bottom; margin-right: 4px; }
      #input-form { height: 80px; }
      #prompt-input { width: 100%; height: 50px; box-sizing: border-box; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 10px; border: 2px inset #808080; }
      #prompt-input.disabled { background-color: #C0C0C0; }
      #send-button { float: left; width: 80px; height: 24px; background-color: #C0C0C0; border: 2px outset #FFFFFF; cursor: pointer; margin-top: 3px; }
      #send-button.disabled { border-style: inset; color: #808080; cursor: default; }
      #clear-link { float: right; font-size: 10px; margin-top: 8px; margin-right: 8px; }
    `;

  let clearUrl = `/chat/clear?friend=${escapeHtml(friendKey)}`;
  if (isFrameView) clearUrl += "&view=frame";
  const clearScript = `if(confirm('Are you sure you want to permanently delete this chat history?')){ window.location.href='${clearUrl}'; } return false;`;

  const body = `
      <table id="chat-table" cellpadding="0" cellspacing="0">
        <tr>
          <td id="header-td">
            <div id="header" title="${realNameTooltip}"><img src="/icq-logo.gif" width="16" height="16">Chat with ${headerText}</div>
          </td>
        </tr>
        <tr>
          <td id="messages-td">
            <div id="chat-messages">${chatHistoryHtml}</div>
          </td>
        </tr>
        <tr>
          <td id="form-td">
            <div id="input-form-container">
              ${typingIndicatorHtml}
              <form id="input-form" action="${postAction}" method="POST">
                <textarea id="prompt-input" name="prompt_display" rows="3" class="${
                  isDisabled ? "disabled" : ""
                }" ${isDisabled ? "disabled" : ""}>${escapeHtml(
    promptText
  )}</textarea>
                <input type="hidden" id="prompt-hidden-input" name="prompt">
                <input type="hidden" name="friend" value="${escapeHtml(
                  friendKey
                )}">
                <input type="button" id="send-button" value="Send" class="${
                  isDisabled ? "disabled" : ""
                }" ${isDisabled ? "disabled" : ""}>
                <a id="clear-link" href="#" onclick="${clearScript}">Clear</a>
              </form>
            </div>
          </td>
        </tr>
      </table>
    `;

  let script = `
        (function() {
          // --- Cookie Helper Functions (ES3 compatible) ---
          function setCookie(name, value, days) {
              var expires = "";
              if (days) {
                  var date = new Date();
                  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                  expires = "; expires=" + date.toUTCString();
              }
              document.cookie = name + "=" + (encodeURIComponent(value) || "") + expires + "; path=/";
          }
          function getCookie(name) {
              var nameEQ = name + "=";
              var ca = document.cookie.split(';');
              for (var i = 0; i < ca.length; i++) {
                  var c = ca[i];
                  while (c.charAt(0) == ' ') c = c.substring(1, c.length);
                  if (c.indexOf(nameEQ) == 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
              }
              return null;
          }
          function eraseCookie(name) {
              document.cookie = name + '=; Max-Age=-99999999; path=/;';
          }

          function resizeLayout() {
            try {
              var viewportHeight = document.compatMode === 'CSS1Compat' ? document.documentElement.clientHeight : document.body.clientHeight;
              var header = document.getElementById('header-td');
              var formContainer = document.getElementById('input-form-container');
              var chatMessagesDiv = document.getElementById('chat-messages');

              if (!header || !formContainer || !chatMessagesDiv) return;
              
              var nonContentHeight = header.offsetHeight + formContainer.offsetHeight;
              var buffer = 18; 
              var newHeight = viewportHeight - nonContentHeight - buffer;

              if (newHeight > 50) {
                  chatMessagesDiv.style.height = newHeight + 'px';
              }
            } catch (e) {}
          }

          function initChat() {
              try {
                  resizeLayout();
                  window.onresize = resizeLayout;

                  var chatMessages = document.getElementById('chat-messages');
                  if (chatMessages) {
                      chatMessages.scrollTop = chatMessages.scrollHeight;
                  }

                  var input = document.getElementById('prompt-input');
                  var form = document.getElementById('input-form');
                  var button = document.getElementById('send-button');
                  var hiddenInput = document.getElementById('prompt-hidden-input');
                  var draftCookieName = 'icq98_draft_${escapeHtml(friendKey)}';

                  // --- Form Submission Logic ---
                  function sendChatMessage() {
                      try {
                          var trimmedValue = input.value.replace(/^\\s+|\\s+$/g, '');
                          if (!trimmedValue || button.disabled) {
                              return; // Don't send empty messages
                          }

                          // 1. Copy value to hidden field for submission
                          if (hiddenInput) {
                              hiddenInput.value = input.value;
                          } else {
                              // Fallback if the hidden input isn't found
                              form.submit();
                              return;
                          }

                          // 2. Clear the visible textarea and the draft cookie
                          eraseCookie(draftCookieName);
                          input.value = '';

                          // 3. Disable controls to prevent resubmission
                          button.disabled = true;
                          button.value = 'Sending...';
                          button.className = 'disabled';
                          input.readOnly = true;
                          input.className = 'disabled';

                          // 4. Submit the form
                          form.submit();

                      } catch (e) {
                          // Ultimate fallback for ancient browsers
                          form.submit();
                      }
                  }
                  
                  if (button) {
                      button.onclick = sendChatMessage;
                  }
                  
                  if (input && !input.disabled) {
                    // --- Draft Persistence Logic ---
                    var savedDraft = getCookie(draftCookieName);
                    if (savedDraft) {
                        input.value = savedDraft;
                    }
                    input.onkeyup = function() {
                        setCookie(draftCookieName, this.value, 1);
                    };

                    // --- Placeholder Text Logic ---
                    var placeholderText = "${escapeHtml(promptText)}";
                    if (placeholderText && input.value === placeholderText) {
                        input.onfocus = function() { if (this.value === placeholderText) this.value = ''; };
                        input.onblur = function() { if (this.value === '') this.value = placeholderText; };
                    }

                    input.focus();
                    input.onkeydown = function(e) {
                      var event = e || window.event;
                      var keyCode = event.keyCode || event.which;
                      if (keyCode === 13 && !event.shiftKey && !event.ctrlKey) {
                        if (event.preventDefault) {
                          event.preventDefault();
                        } else {
                          event.returnValue = false;
                        }
                        sendChatMessage();
                      }
                    };
                  }
              } catch(e) {}
          }
          initChat();
        })();
    `;

  if (statusUpdate) {
    script += `
        try {
            var buddyListFrame = parent.frames['buddy_list_frame'];
            if (buddyListFrame && !buddyListFrame.closed && typeof buddyListFrame.updateBuddyStatus === 'function') {
                buddyListFrame.updateBuddyStatus('${statusUpdate.key}', '${statusUpdate.icon}', '${statusUpdate.className}');
            } else if (window.opener && !window.opener.closed && typeof window.opener.updateBuddyStatus === 'function') {
                window.opener.updateBuddyStatus('${statusUpdate.key}', '${statusUpdate.icon}', '${statusUpdate.className}');
            }
        } catch(e) {}
      `;
  }

  return renderHtmlPage({
    title: `Chat with ${escapeHtml(persona.screenName || persona.name)}`,
    styles,
    body,
    scripts: script,
    metaRefreshTag,
  });
}

function renderApologyPage(persona, worldState) {
  const friendKey = persona.key;
  const displayName = escapeHtml(persona.screenName || persona.name);

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
        <h1>Apology to ${displayName}</h1>
        <form id="apology-form" action="/apologize" method="POST">
          <p>You have been blocked by ${displayName}. You have one chance to write a sincere apology. If they accept, you will be unblocked.</p>
          <textarea name="apologyText" required></textarea>
          <input type="hidden" name="friend" value="${escapeHtml(friendKey)}">
          <input type="submit" id="submit-button" value="Send Apology">
        </form>
      </div>
    `;

  return renderHtmlPage({
    title: `Apology to ${displayName}`,
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

function renderAboutPage(worldState) {
  const { userName, realName, age, sex, location } = worldState;

  const title = "About ICQ98 Proxy";
  const styles = `
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; margin: 0; padding: 20px; text-align: center; }
      #container { width: 300px; margin: 0 auto; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #C0C0C0; padding: 3px; text-align: left; }
      h1 { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin: 0; }
      #content { padding: 15px; background-color: #FFFFFF; border: 1px solid #000000; }
      p { margin-top: 0; margin-bottom: 10px; line-height: 1.4; }
      b { font-weight: bold; }
      hr { border: 0; border-top: 1px solid #808080; margin: 15px 0; }
    `;

  const appDescription =
    "A nostalgic chat simulator with AI-powered friends, designed for retro browsers. Powered by Gemini. For hints or suggestions, ask the Nostalgia Bot.";

  const body = `
        <div id="container">
            <h1>${escapeHtml(title)}</h1>
            <div id="content">
                <p><b>User Name:</b> ${escapeHtml(userName)}</p>
                <p><b>Real Name:</b> ${escapeHtml(realName)}</p>
                <p><b>A/S/L:</b> ${escapeHtml(String(age))} / ${escapeHtml(
    String(sex)
  )} / ${escapeHtml(String(location))}</p>
                <hr>
                <p>${escapeHtml(appDescription)}</p>
            </div>
        </div>
    `;

  return renderHtmlPage({ title, styles, body });
}

function renderModernAppShell() {
  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Frameset//EN" "http://www.w3.org/TR/html4/frameset.dtd">
    <html>
      <head>
        <title>Gemini 98</title>
        <link rel="shortcut icon" href="/favicon.ico">
        <style>
          /* For mobile responsiveness */
          @media (max-width: 700px) {
            #main-frameset {
              rows: 250px, *;
              cols: *;
            }
          }
        </style>
      </head>
      <frameset cols="250,*" id="main-frameset" border="2" framespacing="2" frameborder="yes">
        <frame src="/buddylist?view=frame" name="buddy_list_frame" scrolling="auto">
        <frame src="/chat?friend=gemini_bot&view=frame" name="chat_frame" scrolling="no">
      </frameset>
      <noframes>
        <body>
          <p>This page requires a browser that supports frames.</p>
        </body>
      </noframes>
    </html>`;
}

module.exports = {
  renderBuddyListPage,
  renderChatWindowPage,
  renderApologyPage,
  renderFilesPage,
  renderAboutPage,
  renderModernAppShell,
};
