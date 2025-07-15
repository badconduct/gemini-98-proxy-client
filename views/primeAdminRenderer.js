const { escapeHtml } = require("../lib/utils");
const { renderDialogWindow } = require("./components");
const { renderHtmlPage } = require("./pageBuilder");

function renderPrimeLoginPage(error = null) {
  const title = "Prime Administration - Login";
  const header = "Prime Admin Portal";

  const bodyContent = `
        ${
          error
            ? `<p style="color:red; text-align:center;">${escapeHtml(
                error
              )}</p>`
            : ""
        }
        <form action="/primeadmin/login" method="POST">
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
                <input type="submit" value="Authenticate">
            </div>
        </form>
         <div class="button-container">
            <a href="/">Return to Main Site</a>
        </div>
    `;

  return renderDialogWindow({ title, header, bodyContent });
}

function renderPrimeDashboardPage(config) {
  const title = "Prime Admin - Simulation Control";
  const styles = `
    body { font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; background-color: #C0C0C0; margin: 0; padding: 10px; }
    h1 { font-size: 16px; margin-top: 0; }
    form { margin: 0; }
    fieldset { margin-bottom: 15px; border: 1px solid #808080; padding: 10px; }
    legend { font-weight: bold; color: #000080; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px; vertical-align: top; }
    td.label { width: 350px; text-align: right; font-weight: bold; padding-right: 10px; }
    input[type="text"], input[type="number"] { width: 80px; }
    .button-bar { text-align: right; padding: 10px; border-top: 2px solid #fff; background: #C0C0C0; margin-top: 10px; }
    .button-bar input, .button-bar a { margin-left: 10px; width: 220px; font-size: 12px; padding: 4px; border-top: 1px solid #fff; border-left: 1px solid #fff; border-right: 1px solid #000; border-bottom: 1px solid #000; background-color: #C0C0C0; text-decoration: none; color: #000; text-align: center; }
    .warning { font-style: italic; color: #555; font-size: 11px; }
    .checkbox-group label { margin-right: 15px; }
    .note-box { background-color: #FFFFE1; border: 1px solid #808080; padding: 10px; margin-bottom: 15px; line-height: 1.4; }
    .note-box b { color: #000080; }
    .note-box code { background-color: #E0E0E0; font-family: "Courier New", monospace; }
    .safety-warning { border: 2px solid red; padding: 10px; background-color: #FFC0CB; }
    .safety-warning p { margin: 0; font-size: 11px; color: #333; }
    `;

  const body = `
    <h1>Prime Administration Portal</h1>
    <p class="warning">Warning: Saving these settings will reset the social world for all non-admin users. This cannot be undone.</p>

    <div class="note-box">
        <b>Note on Server-Operator Settings:</b> To disable the global Gemini safety filters (which also disables the "creepy age" penalty), stop the server, add <code>DISABLE_SAFETY_FILTERS=true</code> to your <code>.env</code> file, and restart the server. This setting has been moved from the UI for security.
    </div>

    <form action="/primeadmin/save" method="POST" onsubmit="return confirm('Saving these settings will reset the social world for all non-admin users. This cannot be undone. Are you sure you want to proceed?');">
        
        <fieldset>
            <legend>Global System Toggles</legend>
            <table>
                 <tr>
                    <td class="label"><label for="featureToggles_enableGuestMode">Enable Guest Mode:</label></td>
                    <td><input type="checkbox" id="featureToggles_enableGuestMode" name="featureToggles_enableGuestMode" value="true" ${
                      config.featureToggles.enableGuestMode ? "checked" : ""
                    }></td>
                </tr>
                 <tr>
                    <td class="label"><label for="featureToggles_enableHistoryCondensation">Enable Chat History Condensation:</label></td>
                    <td><input type="checkbox" id="featureToggles_enableHistoryCondensation" name="featureToggles_enableHistoryCondensation" value="true" ${
                      config.featureToggles.enableHistoryCondensation
                        ? "checked"
                        : ""
                    }></td>
                </tr>
                <tr>
                    <td class="label"><label for="featureToggles_enableHonestySystem">Enable Preference & Honesty System:</label></td>
                    <td><input type="checkbox" id="featureToggles_enableHonestySystem" name="featureToggles_enableHonestySystem" value="true" ${
                      config.featureToggles.enableHonestySystem ? "checked" : ""
                    }></td>
                </tr>
                <tr>
                    <td class="label"><label for="featureToggles_enableRRatedFilter">Enable R-Rated Content Filter:</label></td>
                    <td><input type="checkbox" id="featureToggles_enableRRatedFilter" name="featureToggles_enableRRatedFilter" value="true" ${
                      config.featureToggles.enableRRatedFilter ? "checked" : ""
                    }></td>
                </tr>
                <tr>
                    <td class="label"><label for="featureToggles_forceRetroView">Force Retro (Pop-up) View for All Users:</label></td>
                    <td><input type="checkbox" id="featureToggles_forceRetroView" name="featureToggles_forceRetroView" value="true" ${
                      config.featureToggles.forceRetroView ? "checked" : ""
                    }></td>
                </tr>
            </table>
        </fieldset>

        <fieldset>
            <legend>Initial Relationship Scores</legend>
            <table>
                <tr>
                    <td class="label"><label for="initialScores_sameGroup">Score for same social group (e.g., student-student):</label></td>
                    <td><input type="number" id="initialScores_sameGroup" name="initialScores_sameGroup" value="${
                      config.initialScores.sameGroup
                    }" min="0" max="100"></td>
                </tr>
                <tr>
                    <td class="label"><label for="initialScores_differentGroup">Score for different social groups:</label></td>
                    <td><input type="number" id="initialScores_differentGroup" name="initialScores_differentGroup" value="${
                      config.initialScores.differentGroup
                    }" min="0" max="100"></td>
                </tr>
                <tr>
                    <td class="label"><label for="initialScores_elion">Score for Elion (The Watcher):</label></td>
                    <td><input type="number" id="initialScores_elion" name="initialScores_elion" value="${
                      config.initialScores.elion
                    }" min="0" max="100"></td>
                </tr>
            </table>
        </fieldset>

        <fieldset>
            <legend>Relationship Score Modifiers</legend>
            <table>
                 <tr>
                    <td class="label"><label for="scoreModifiers_insultInterests">Insulting Interests Penalty:</label></td>
                    <td><input type="number" id="scoreModifiers_insultInterests" name="scoreModifiers_insultInterests" value="${
                      config.scoreModifiers.insultInterests
                    }" min="-10" max="0"></td>
                </tr>
                <tr>
                    <td class="label"><label for="scoreModifiers_complimentInterests">Complimenting Interests Bonus:</label></td>
                    <td><input type="number" id="scoreModifiers_complimentInterests" name="scoreModifiers_complimentInterests" value="${
                      config.scoreModifiers.complimentInterests
                    }" min="0" max="10"></td>
                </tr>
                 <tr>
                    <td class="label"><label for="scoreModifiers_flirtFail">Flirting (Low Score) Penalty:</label></td>
                    <td><input type="number" id="scoreModifiers_flirtFail" name="scoreModifiers_flirtFail" value="${
                      config.scoreModifiers.flirtFail
                    }" min="-10" max="0"></td>
                </tr>
                 <tr>
                    <td class="label"><label for="scoreModifiers_flirtSuccess">Flirting (High Score) Bonus:</label></td>
                    <td><input type="number" id="scoreModifiers_flirtSuccess" name="scoreModifiers_flirtSuccess" value="${
                      config.scoreModifiers.flirtSuccess
                    }" min="0" max="10"></td>
                </tr>
                 <tr>
                    <td class="label"><label for="scoreModifiers_liePenalty">Social Lie Penalty (e.g. "we're friends"):</label></td>
                    <td><input type="number" id="scoreModifiers_liePenalty" name="scoreModifiers_liePenalty" value="${
                      config.scoreModifiers.liePenalty
                    }" min="-10" max="0"></td>
                </tr>
                 <tr>
                    <td class="label"><label for="scoreModifiers_honestyPenalty">Honesty Contradiction Penalty:</label></td>
                    <td><input type="number" id="scoreModifiers_honestyPenalty" name="scoreModifiers_honestyPenalty" value="${
                      config.scoreModifiers.honestyPenalty
                    }" min="-10" max="0"></td>
                </tr>
            </table>
        </fieldset>
        
        <fieldset>
            <legend>Initial Dating & Crush Rules</legend>
             <table>
                <tr>
                    <td class="label"><label for="datingRules_minPairs">Minimum initial dating pairs:</label></td>
                    <td><input type="number" id="datingRules_minPairs" name="datingRules_minPairs" value="${
                      config.datingRules.minPairs
                    }" min="0" max="6"></td>
                </tr>
                <tr>
                    <td class="label"><label for="datingRules_maxPairs">Maximum initial dating pairs:</label></td>
                    <td><input type="number" id="datingRules_maxPairs" name="datingRules_maxPairs" value="${
                      config.datingRules.maxPairs
                    }" min="0" max="6"></td>
                </tr>
                <tr>
                    <td class="label"><label for="datingRules_maxCrushes">Maximum crushes per character:</label></td>
                    <td><input type="number" id="datingRules_maxCrushes" name="datingRules_maxCrushes" value="${
                      config.datingRules.maxCrushes
                    }" min="0" max="5"></td>
                </tr>
                <tr>
                    <td class="label"><label for="datingRules_cheatingPenaltyScore">Relationship score after cheating is detected:</label></td>
                    <td><input type="number" id="datingRules_cheatingPenaltyScore" name="datingRules_cheatingPenaltyScore" value="${
                      config.datingRules.cheatingPenaltyScore
                    }" min="0" max="50"></td>
                </tr>
                 <tr>
                    <td class="label"><label for="datingRules_breakupForgivenessBonus">Score bonus for ex-partner after breakup:</label></td>
                    <td><input type="number" id="datingRules_breakupForgivenessBonus" name="datingRules_breakupForgivenessBonus" value="${
                      config.datingRules.breakupForgivenessBonus
                    }" min="0" max="50"></td>
                </tr>
                <tr>
                    <td class="label">Dating Lockouts:</td>
                    <td class="checkbox-group">
                        <input type="checkbox" id="datingLockouts_towniesAndStudents" name="datingLockouts_towniesAndStudents" value="true" ${
                          config.datingLockouts.towniesAndStudents
                            ? "checked"
                            : ""
                        }><label for="datingLockouts_towniesAndStudents">Townies cannot date Students</label><br>
                        <input type="checkbox" id="datingLockouts_jocksAndGoths" name="datingLockouts_jocksAndGoths" value="true" ${
                          config.datingLockouts.jocksAndGoths ? "checked" : ""
                        }><label for="datingLockouts_jocksAndGoths">Jocks cannot date Goths</label><br>
                        <input type="checkbox" id="datingLockouts_prepsAndSlackers" name="datingLockouts_prepsAndSlackers" value="true" ${
                          config.datingLockouts.prepsAndSlackers
                            ? "checked"
                            : ""
                        }><label for="datingLockouts_prepsAndSlackers">Preps cannot date Slackers</label>
                    </td>
                </tr>
            </table>
        </fieldset>

        <fieldset>
            <legend>Global Social Rules</legend>
            <table>
                 <tr>
                    <td class="label"><label for="socialRules_hostileThreshold">Hostile relationship threshold (score at or below):</label></td>
                    <td><input type="number" id="socialRules_hostileThreshold" name="socialRules_hostileThreshold" value="${
                      config.socialRules.hostileThreshold
                    }" min="0" max="20"></td>
                </tr>
                 <tr>
                    <td class="label"><label for="socialRules_bffThreshold">Best Friend threshold (score at or above):</label></td>
                    <td><input type="number" id="socialRules_bffThreshold" name="socialRules_bffThreshold" value="${
                      config.socialRules.bffThreshold
                    }" min="90" max="100"></td>
                </tr>
                <tr>
                    <td class="label"><label for="socialRules_creepyAgeThreshold">"Creepy" age threshold (users this age or older are creepy to students):</label></td>
                    <td><input type="number" id="socialRules_creepyAgeThreshold" name="socialRules_creepyAgeThreshold" value="${
                      config.socialRules.creepyAgeThreshold
                    }" min="20" max="99"></td>
                </tr>
                <tr>
                    <td class="label"><label for="socialRules_creepyAgePenalty">"Creepy" age relationship penalty per message:</label></td>
                    <td><input type="number" id="socialRules_creepyAgePenalty" name="socialRules_creepyAgePenalty" value="${
                      config.socialRules.creepyAgePenalty
                    }" min="-10" max="0"></td>
                </tr>
                 <tr>
                    <td class="label"><label for="socialRules_patronizingAgeThreshold">Patronizing age threshold (users this age or younger are treated like kids):</label></td>
                    <td><input type="number" id="socialRules_patronizingAgeThreshold" name="socialRules_patronizingAgeThreshold" value="${
                      config.socialRules.patronizingAgeThreshold
                    }" min="1" max="19"></td>
                </tr>
                 <tr>
                    <td class="label"><label for="socialRules_gossipChance">Gossip spread chance (0.0 to 1.0):</label></td>
                    <td><input type="text" id="socialRules_gossipChance" name="socialRules_gossipChance" value="${
                      config.socialRules.gossipChance
                    }"></td>
                </tr>
                <tr>
                    <td class="label"><label for="socialRules_gossipScope">Gossip spread scope (max number of friends told):</label></td>
                    <td><input type="number" id="socialRules_gossipScope" name="socialRules_gossipScope" value="${
                      config.socialRules.gossipScope
                    }" min="1" max="10"></td>
                </tr>
            </table>
        </fieldset>

         <fieldset>
            <legend>System Internals</legend>
            <table>
                 <tr>
                    <td class="label"><label for="systemSettings_historyCondensationThreshold">Chat history condensation threshold (messages):</label></td>
                    <td><input type="number" id="systemSettings_historyCondensationThreshold" name="systemSettings_historyCondensationThreshold" value="${
                      config.systemSettings.historyCondensationThreshold
                    }" min="10" max="100"></td>
                </tr>
            </table>
        </fieldset>

        <div class="button-bar">
             <input type="submit" value="Save & Restart Simulation">
        </div>
    </form>
    
    <div class="button-bar" style="border-top: 1px dotted #808080; margin-top: 0;">
        <form action="/primeadmin/reset" method="POST" onsubmit="return confirm('This will reset all settings to their defaults AND restart the simulation for all non-admin users. Are you absolutely sure?');" style="display:inline;">
             <input type="submit" value="Default Settings & Reset Simulation">
        </form>
        <a href="/">Cancel and Return to Login</a>
    </div>
    `;
  return renderHtmlPage({ title, styles, body });
}

function renderPrimeDashboardFallbackPage(config) {
  const title = "Prime Admin - Simulation Control";
  const styles = `
    body { font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; background-color: #C0C0C0; margin: 0; padding: 10px; }
    h1 { font-size: 16px; margin-top: 0; }
    form { margin: 0; }
    input[type="text"], input[type="number"] { width: 80px; }
    .warning { font-style: italic; color: #555; font-size: 11px; }
    .note-box { background-color: #FFFFE1; border: 1px solid #808080; padding: 10px; margin-bottom: 15px; line-height: 1.4; }
    .note-box b { color: #000080; }
    .note-box code { background-color: #E0E0E0; font-family: "Courier New", monospace; }
    .button-bar { text-align: right; padding: 10px; border-top: 2px solid #fff; background: #C0C0C0; margin-top: 10px; }
    .button-bar input, .button-bar a { margin-left: 10px; width: 220px; font-size: 12px; padding: 4px; border-top: 1px solid #fff; border-left: 1px solid #fff; border-right: 1px solid #000; border-bottom: 1px solid #000; background-color: #C0C0C0; text-decoration: none; color: #000; text-align: center; }
    `;

  const renderSection = (legend, content) => `
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
            <tr><td>
                <table width="100%" border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; border-color: #808080;">
                    <tr><td colspan="2" style="background-color: #E0E0E0; font-weight: bold; color: #000080;">${legend}</td></tr>
                    ${content}
                </table>
            </td></tr>
        </table>
    `;

  const renderRow = (
    label,
    inputId,
    inputName,
    value,
    type = "number",
    extras = ""
  ) => `
        <tr>
            <td width="55%" align="right"><b><label for="${inputId}">${label}:</label></b></td>
            <td><input type="${type}" id="${inputId}" name="${inputName}" value="${value}" ${extras}></td>
        </tr>
    `;

  // Renders a checkbox and its label.
  const renderCheckbox = (label, inputId, inputName, isChecked) => `
        <input type="checkbox" id="${inputId}" name="${inputName}" value="true" ${
    isChecked ? "checked" : ""
  }><label for="${inputId}">${label}</label>
    `;

  // Renders a single table row with one cell spanning both columns, perfect for checkbox toggles.
  const renderCheckboxRowHtml = (labelText, inputId, inputName, isChecked) => {
    const checkboxHtml = renderCheckbox(
      labelText,
      inputId,
      inputName,
      isChecked
    );
    return `<tr><td colspan="2" align="left" style="padding-left: 10px;">${checkboxHtml}</td></tr>`;
  };

  const body = `
        <h1>Prime Administration Portal</h1>
        <p class="warning">Warning: Saving these settings will reset the social world for all non-admin users. This cannot be undone.</p>
        <div class="note-box">
            <b>Note on Server-Operator Settings:</b> To disable the global Gemini safety filters (which also disables the "creepy age" penalty), stop the server, add <code>DISABLE_SAFETY_FILTERS=true</code> to your <code>.env</code> file, and restart the server. This setting has been moved from the UI for security.
        </div>
        <form action="/primeadmin/save" method="POST" onsubmit="return confirm('Saving these settings will reset the social world for all non-admin users. This cannot be undone. Are you sure you want to proceed?');">
            ${renderSection(
              "Global System Toggles",
              `
                ${renderCheckboxRowHtml(
                  "Enable Guest Mode",
                  "featureToggles_enableGuestMode",
                  "featureToggles_enableGuestMode",
                  config.featureToggles.enableGuestMode
                )}
                ${renderCheckboxRowHtml(
                  "Enable Chat History Condensation",
                  "featureToggles_enableHistoryCondensation",
                  "featureToggles_enableHistoryCondensation",
                  config.featureToggles.enableHistoryCondensation
                )}
                ${renderCheckboxRowHtml(
                  "Enable Preference & Honesty System",
                  "featureToggles_enableHonestySystem",
                  "featureToggles_enableHonestySystem",
                  config.featureToggles.enableHonestySystem
                )}
                ${renderCheckboxRowHtml(
                  "Enable R-Rated Content Filter",
                  "featureToggles_enableRRatedFilter",
                  "featureToggles_enableRRatedFilter",
                  config.featureToggles.enableRRatedFilter
                )}
                ${renderCheckboxRowHtml(
                  "Force Retro (Pop-up) View for All Users",
                  "featureToggles_forceRetroView",
                  "featureToggles_forceRetroView",
                  config.featureToggles.forceRetroView
                )}
            `
            )}

            ${renderSection(
              "Initial Relationship Scores",
              `
                ${renderRow(
                  "Score for same social group (e.g., student-student)",
                  "initialScores_sameGroup",
                  "initialScores_sameGroup",
                  config.initialScores.sameGroup,
                  "number",
                  'min="0" max="100"'
                )}
                ${renderRow(
                  "Score for different social groups",
                  "initialScores_differentGroup",
                  "initialScores_differentGroup",
                  config.initialScores.differentGroup,
                  "number",
                  'min="0" max="100"'
                )}
                ${renderRow(
                  "Score for Elion (The Watcher)",
                  "initialScores_elion",
                  "initialScores_elion",
                  config.initialScores.elion,
                  "number",
                  'min="0" max="100"'
                )}
            `
            )}

            ${renderSection(
              "Relationship Score Modifiers",
              `
                ${renderRow(
                  "Insulting Interests Penalty",
                  "scoreModifiers_insultInterests",
                  "scoreModifiers_insultInterests",
                  config.scoreModifiers.insultInterests,
                  "number",
                  'min="-10" max="0"'
                )}
                ${renderRow(
                  "Complimenting Interests Bonus",
                  "scoreModifiers_complimentInterests",
                  "scoreModifiers_complimentInterests",
                  config.scoreModifiers.complimentInterests,
                  "number",
                  'min="0" max="10"'
                )}
                ${renderRow(
                  "Flirting (Low Score) Penalty",
                  "scoreModifiers_flirtFail",
                  "scoreModifiers_flirtFail",
                  config.scoreModifiers.flirtFail,
                  "number",
                  'min="-10" max="0"'
                )}
                ${renderRow(
                  "Flirting (High Score) Bonus",
                  "scoreModifiers_flirtSuccess",
                  "scoreModifiers_flirtSuccess",
                  config.scoreModifiers.flirtSuccess,
                  "number",
                  'min="0" max="10"'
                )}
                ${renderRow(
                  'Social Lie Penalty (e.g. "we\'re friends")',
                  "scoreModifiers_liePenalty",
                  "scoreModifiers_liePenalty",
                  config.scoreModifiers.liePenalty,
                  "number",
                  'min="-10" max="0"'
                )}
                ${renderRow(
                  "Honesty Contradiction Penalty",
                  "scoreModifiers_honestyPenalty",
                  "scoreModifiers_honestyPenalty",
                  config.scoreModifiers.honestyPenalty,
                  "number",
                  'min="-10" max="0"'
                )}
            `
            )}

            ${renderSection(
              "Initial Dating & Crush Rules",
              `
                ${renderRow(
                  "Minimum initial dating pairs",
                  "datingRules_minPairs",
                  "datingRules_minPairs",
                  config.datingRules.minPairs,
                  "number",
                  'min="0" max="6"'
                )}
                ${renderRow(
                  "Maximum initial dating pairs",
                  "datingRules_maxPairs",
                  "datingRules_maxPairs",
                  config.datingRules.maxPairs,
                  "number",
                  'min="0" max="6"'
                )}
                ${renderRow(
                  "Maximum crushes per character",
                  "datingRules_maxCrushes",
                  "datingRules_maxCrushes",
                  config.datingRules.maxCrushes,
                  "number",
                  'min="0" max="5"'
                )}
                ${renderRow(
                  "Relationship score after cheating is detected",
                  "datingRules_cheatingPenaltyScore",
                  "datingRules_cheatingPenaltyScore",
                  config.datingRules.cheatingPenaltyScore,
                  "number",
                  'min="0" max="50"'
                )}
                ${renderRow(
                  "Score bonus for ex-partner after breakup",
                  "datingRules_breakupForgivenessBonus",
                  "datingRules_breakupForgivenessBonus",
                  config.datingRules.breakupForgivenessBonus,
                  "number",
                  'min="0" max="50"'
                )}
                <tr>
                    <td width="55%" align="right"><b>Dating Lockouts:</b></td>
                    <td>
                        ${renderCheckbox(
                          "Townies cannot date Students",
                          "datingLockouts_towniesAndStudents",
                          "datingLockouts_towniesAndStudents",
                          config.datingLockouts.towniesAndStudents
                        )}<br>
                        ${renderCheckbox(
                          "Jocks cannot date Goths",
                          "datingLockouts_jocksAndGoths",
                          "datingLockouts_jocksAndGoths",
                          config.datingLockouts.jocksAndGoths
                        )}<br>
                        ${renderCheckbox(
                          "Preps cannot date Slackers",
                          "datingLockouts_prepsAndSlackers",
                          "datingLockouts_prepsAndSlackers",
                          config.datingLockouts.prepsAndSlackers
                        )}
                    </td>
                </tr>
            `
            )}

            ${renderSection(
              "Global Social Rules",
              `
                ${renderRow(
                  "Hostile relationship threshold (score at or below)",
                  "socialRules_hostileThreshold",
                  "socialRules_hostileThreshold",
                  config.socialRules.hostileThreshold,
                  "number",
                  'min="0" max="20"'
                )}
                ${renderRow(
                  "Best Friend threshold (score at or above)",
                  "socialRules_bffThreshold",
                  "socialRules_bffThreshold",
                  config.socialRules.bffThreshold,
                  "number",
                  'min="90" max="100"'
                )}
                ${renderRow(
                  '"Creepy" age threshold (users this age or older are creepy to students)',
                  "socialRules_creepyAgeThreshold",
                  "socialRules_creepyAgeThreshold",
                  config.socialRules.creepyAgeThreshold,
                  "number",
                  'min="20" max="99"'
                )}
                ${renderRow(
                  '"Creepy" age relationship penalty per message',
                  "socialRules_creepyAgePenalty",
                  "socialRules_creepyAgePenalty",
                  config.socialRules.creepyAgePenalty,
                  "number",
                  'min="-10" max="0"'
                )}
                ${renderRow(
                  "Patronizing age threshold (users this age or younger are treated like kids)",
                  "socialRules_patronizingAgeThreshold",
                  "socialRules_patronizingAgeThreshold",
                  config.socialRules.patronizingAgeThreshold,
                  "number",
                  'min="1" max="19"'
                )}
                ${renderRow(
                  "Gossip spread chance (0.0 to 1.0)",
                  "socialRules_gossipChance",
                  "socialRules_gossipChance",
                  config.socialRules.gossipChance,
                  "text"
                )}
                ${renderRow(
                  "Gossip spread scope (max number of friends told)",
                  "socialRules_gossipScope",
                  "socialRules_gossipScope",
                  config.socialRules.gossipScope,
                  "number",
                  'min="1" max="10"'
                )}
            `
            )}

            ${renderSection(
              "System Internals",
              `
                ${renderRow(
                  "Chat history condensation threshold (messages)",
                  "systemSettings_historyCondensationThreshold",
                  "systemSettings_historyCondensationThreshold",
                  config.systemSettings.historyCondensationThreshold,
                  "number",
                  'min="10" max="100"'
                )}
            `
            )}

            <div class="button-bar">
                 <input type="submit" value="Save & Restart Simulation">
            </div>
        </form>
        <div class="button-bar" style="border-top: 1px dotted #808080; margin-top: 0;">
            <form action="/primeadmin/reset" method="POST" onsubmit="return confirm('This will reset all settings to their defaults AND restart the simulation for all non-admin users. Are you absolutely sure?');" style="display:inline;">
                 <input type="submit" value="Default Settings & Reset Simulation">
            </form>
            <a href="/">Cancel and Return to Login</a>
        </div>
    `;

  return renderHtmlPage({ title, styles, body });
}

module.exports = {
  renderPrimeLoginPage,
  renderPrimeDashboardPage,
  renderPrimeDashboardFallbackPage,
};
