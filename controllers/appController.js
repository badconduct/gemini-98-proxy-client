const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { FRIEND_PERSONAS, ALL_PERSONAS } = require("../config/personas");
const {
  renderBuddyListPage,
  renderChatWindowPage,
  renderApologyPage,
  renderFilesPage,
  renderAboutPage,
  renderModernAppShell,
} = require("../views/appRenderer");
const { getTimestamp, clamp, shuffleArray } = require("../lib/utils");
const { writeProfile } = require("../lib/state-manager");
const aiLogic = require("../lib/ai-logic");
const { getRelationshipTier } = require("../lib/ai-logic");
const { getSimulationConfig } = require("../lib/config-manager");
const { checkRRatedContent } = require("../lib/content-filter");

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

// --- Timezone Configuration ---
const TIMEZONE_OFFSET = parseInt(process.env.TIMEZONE_OFFSET, 10) || 0;

// --- Background Job Functions ---

async function generateImageInBackground(jobId, persona, userName) {
  try {
    console.log(
      `[Image Job ${jobId}] Starting image generation for ${persona.name}.`
    );
    const response = await ai.models.generateImages({
      model: "imagen-3.0-generate-002",
      prompt: persona.imageGenPrompt,
      config: { numberOfImages: 1, outputMimeType: "image/jpeg" },
    });

    const base64Image = response.generatedImages[0].image.imageBytes;
    const filename = `${uuidv4()}.jpg`;
    const imagePath = path.join(
      __dirname,
      "..",
      "public",
      "generated-images",
      filename
    );

    fs.writeFileSync(imagePath, Buffer.from(base64Image, "base64"));

    const imageUrl = `/public/generated-images/${filename}`;
    console.log(`[Image Job ${jobId}] Image saved to ${imageUrl}`);

    global.imageJobs[jobId] = {
      status: "complete",
      url: imageUrl,
      persona: persona,
      userName: userName,
    };
  } catch (err) {
    if (
      err.constructor.name === "ApiError" &&
      err.message &&
      err.message.includes("billed user")
    ) {
      console.error(
        `[Image Job ${jobId}] CRITICAL ERROR: The API key is not enabled for the Imagen model (billing is required). Image generation failed.`
      );
    } else {
      console.error(`[Image Job ${jobId}] Image generation failed:`, err);
    }
    global.imageJobs[jobId] = {
      status: "failed",
      persona: persona,
      userName: userName,
    };
  }
}

async function summarizeHistory(historyText, userName, personaName) {
  console.log(
    `[AI] Summarizing chat history between ${userName} and ${personaName}.`
  );
  const summarizationPrompt = `You are an expert summarizer. Below is a chat history between a user named "${userName}" and a character named "${personaName}". Your task is to create a concise, third-person summary of the key events, topics discussed, and the overall state of their relationship. Focus on facts that would be important for ${personaName} to remember in future conversations.

Example:
- The user and ${personaName} bonded over their shared love for 90s rock music.
- ${personaName} revealed they have a crush on another character named Kevin.
- The user gave ${personaName} advice about a school project.
- Their relationship is friendly and trusting.

Do not include greetings or conversational fluff. Output only the summary.

CHAT HISTORY:
---
${historyText}
---
END OF CHAT HISTORY.

Provide your summary now.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: summarizationPrompt }] }],
    });
    return response.text.trim();
  } catch (err) {
    console.error(
      `[AI Summarizer] Error summarizing history for ${personaName}:`,
      err
    );
    return `// Summary generation failed. Last known topic: ${historyText.slice(
      -200
    )}`;
  }
}

async function analyzeUserPreference(userMessage) {
  const analysisPrompt = `Analyze the following user message to determine if it expresses a strong, direct preference for a topic. The topic should be a noun or noun phrase. Respond ONLY with a JSON object with the keys "action" (either "like", "dislike", or "none") and "topic" (the subject of the preference, normalized to lowercase).

User Message: "${userMessage}"

Examples:
- "I love The Cure, fyi" -> {"action": "like", "topic": "the cure"}
- "Pop music is super lame." -> {"action": "dislike", "topic": "pop music"}
- "what other shows you like?" -> {"action": "none", "topic": null}
- "I agree" -> {"action": "none", "topic": null}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
      config: { responseMimeType: "application/json" },
    });
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) jsonStr = match[2].trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("[PREFERENCE ANALYSIS] Failed:", e);
    return { action: "none", topic: null };
  }
}

// --- Route Handlers ---

const getModernAppShell = (req, res) => {
  res.send(renderModernAppShell());
};

const getBuddyListPage = (req, res) => {
  const worldState = req.worldState;
  const isFrameView = req.query.view === "frame";

  const onlineFriendKeys = [];
  const offlineFriendKeys = [];

  const now = new Date();
  const utcHour = now.getUTCHours();
  const currentHour = (utcHour + TIMEZONE_OFFSET + 24) % 24;
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDay();

  const isSummer = currentMonth >= 6 && currentMonth <= 7;
  const isWeekend = currentDay === 0 || currentDay === 6;
  const dayTypeKey = isWeekend ? "weekend" : "weekday";

  FRIEND_PERSONAS.forEach((persona) => {
    if (worldState.moderation[persona.key]?.blocked) {
      offlineFriendKeys.push(persona.key);
      return;
    }

    let isOnlineNow = false;
    let activeSchedule = [];

    if (persona.schedules.schoolYear && persona.schedules.summer) {
      const seasonKey = isSummer ? "summer" : "schoolYear";
      const scheduleSource = persona.schedules[seasonKey];
      if (scheduleSource) {
        activeSchedule = scheduleSource[dayTypeKey] || [];
      }
    } else {
      activeSchedule = persona.schedules[dayTypeKey] || [];
    }

    if (activeSchedule) {
      for (const window of activeSchedule) {
        const [start, end] = window;
        if (start <= end) {
          if (currentHour >= start && currentHour < end) {
            isOnlineNow = true;
            break;
          }
        } else {
          if (currentHour >= start || currentHour < end) {
            isOnlineNow = true;
            break;
          }
        }
      }
    }

    if (isOnlineNow) {
      onlineFriendKeys.push(persona.key);
    } else {
      offlineFriendKeys.push(persona.key);
    }
  });

  res.send(
    renderBuddyListPage(
      worldState,
      onlineFriendKeys,
      offlineFriendKeys,
      req.session.isAdmin || false,
      isFrameView
    )
  );
};

const getChatPage = (req, res) => {
  const { friend: friendKey, status, view } = req.query;
  const { userName } = req.session;
  const worldState = req.worldState;
  const isFrameView = view === "frame";

  const persona = ALL_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  const isBlocked =
    worldState.moderation[friendKey] &&
    worldState.moderation[friendKey].blocked;
  const isOffline = status === "offline";

  let history = worldState.chatHistories[friendKey];

  if (!history) {
    if (isBlocked) {
      history = `System: (${getTimestamp()}) You have been blocked by ${
        persona.name
      }.`;
    } else if (isOffline) {
      history = `System: (${getTimestamp()}) ${
        persona.name
      } is currently offline.`;
    } else {
      history = `System: (${getTimestamp()}) You are now chatting with ${
        persona.name
      }.`;
      if (persona.openingLine) {
        history += `\n\n${
          persona.name
        }: (${getTimestamp()}) ${persona.openingLine.replace(
          "{userName}",
          worldState.realName
        )}`;
      }
    }
    worldState.chatHistories[friendKey] = history;
    writeProfile(userName, worldState);
  } else {
    history += `\n\nSystem: (${getTimestamp()}) --- Session Resumed ---`;
  }

  res.send(
    renderChatWindowPage({
      persona,
      worldState,
      history,
      isOffline,
      isBlocked,
      showScores: req.session.showScores || false,
      isFrameView,
    })
  );
};

const postChatMessage = async (req, res) => {
  const { prompt, friend: friendKey, history: historyBase64 } = req.body;
  const { userName } = req.session;
  let worldState = req.worldState;
  const isFrameView = req.query.view === "frame";
  const simulationConfig = getSimulationConfig();

  const persona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
  let history = Buffer.from(historyBase64, "base64").toString("utf8");
  const showScores = req.session.showScores || false;

  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  if (!prompt || !prompt.trim() || worldState.moderation[friendKey]?.blocked) {
    return res.send(
      renderChatWindowPage({
        persona,
        worldState,
        history,
        isBlocked: worldState.moderation[friendKey]?.blocked,
        showScores,
        isFrameView,
      })
    );
  }

  const now = new Date();
  const utcHour = now.getUTCHours();
  const currentHour = (utcHour + TIMEZONE_OFFSET + 24) % 24;
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDay();
  const isSummer = currentMonth >= 6 && currentMonth <= 7;
  const isWeekend = currentDay === 0 || currentDay === 6;
  const dayTypeKey = isWeekend ? "weekend" : "weekday";

  history += `\n\n${userName}: (${getTimestamp()}) ${prompt.trim()}`;

  // --- R-Rated Content Filter ---
  if (simulationConfig.featureToggles.enableRRatedFilter) {
    const filterResult = await checkRRatedContent(
      prompt.trim(),
      persona,
      worldState,
      simulationConfig
    );
    if (filterResult.violation) {
      worldState = filterResult.worldState;
      history += `\n\n${persona.name}: (${getTimestamp()}) ${
        filterResult.reply
      }`;

      worldState.chatHistories[friendKey] = history;
      writeProfile(userName, worldState);

      return res.send(
        renderChatWindowPage({
          persona,
          worldState,
          history,
          isBlocked: worldState.moderation[friendKey]?.blocked,
          showScores,
          isFrameView,
        })
      );
    }
  }

  let isStillOnline = false;
  let activeSchedule = [];

  if (persona.schedules.schoolYear && persona.schedules.summer) {
    const seasonKey = isSummer ? "summer" : "schoolYear";
    const scheduleSource = persona.schedules[seasonKey];
    if (scheduleSource) {
      activeSchedule = scheduleSource[dayTypeKey] || [];
    }
  } else {
    activeSchedule = persona.schedules[dayTypeKey] || [];
  }

  if (activeSchedule) {
    for (const window of activeSchedule) {
      const [start, end] = window;
      if (start <= end) {
        if (currentHour >= start && currentHour < end) {
          isStillOnline = true;
          break;
        }
      } else {
        if (currentHour >= start || currentHour < end) {
          isStillOnline = true;
          break;
        }
      }
    }
  }

  if (!isStillOnline) {
    console.log(`[REAL-TIME] ${persona.name} went offline during chat.`);
    const goodbye = persona.goodbyeLine || "Hey, I gotta go now.";
    history += `\n\n${persona.name}: (${getTimestamp()}) ${goodbye}`;
    worldState.chatHistories[friendKey] = history;
    writeProfile(userName, worldState);
    const statusUpdate = {
      key: friendKey,
      icon: "/icq-offline.gif",
      className: "buddy offline-buddy",
    };
    return res.send(
      renderChatWindowPage({
        persona,
        worldState,
        history,
        isOffline: true,
        showScores,
        statusUpdate,
        isFrameView,
      })
    );
  }

  let statusUpdate = null;

  try {
    const contents = aiLogic.buildHistoryForApi(history, userName);

    let instructionPayload = worldState.instructionCache[friendKey];
    if (!instructionPayload) {
      console.log(
        `[AI] Instruction cache miss for ${persona.name}. Generating new instruction.`
      );
      const summary = worldState.chatSummaries[friendKey] || null;
      instructionPayload = aiLogic.generatePersonalizedInstruction(
        persona,
        worldState,
        isSummer,
        simulationConfig,
        summary
      );
      worldState.instructionCache[friendKey] = instructionPayload;
    } else {
      console.log(`[AI] Instruction cache hit for ${persona.name}.`);
    }

    const { systemInstruction, safetySettings } = instructionPayload;

    const config = {
      systemInstruction,
      responseMimeType: "application/json",
    };

    if (safetySettings) {
      config.safetySettings = safetySettings;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config,
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    const parsed = JSON.parse(jsonStr);
    let invalidateCache = false;

    if (parsed.isImageRequest) {
      const jobId = uuidv4();
      global.imageJobs[jobId] = { status: "pending" };
      generateImageInBackground(jobId, persona, userName);

      history += `\n\n${persona.name}: (${getTimestamp()}) Yeah, hold on...`;
      history += `\n\nSystem: (${getTimestamp()}) ${
        persona.name
      } is taking a picture. This might take a moment. The window will refresh automatically.`;

      worldState.chatHistories[friendKey] = history;
      writeProfile(userName, worldState);

      let refreshUrl = `/check-image?jobId=${jobId}&friend=${friendKey}`;
      if (isFrameView) refreshUrl += "&view=frame";
      const metaRefreshTag = `<meta http-equiv="refresh" content="15; URL=${refreshUrl}">`;

      return res.send(
        renderChatWindowPage({
          persona,
          worldState,
          history,
          metaRefreshTag,
          showScores,
          isFrameView,
        })
      );
    }

    if (parsed.cheatingDetected === true) {
      console.log(`[SOCIAL] Cheating by ${userName} detected!`);
      const currentPartners = FRIEND_PERSONAS.filter(
        (p) => worldState.relationships[p.key]?.dating === "user_player"
      );
      currentPartners.forEach((partner) => {
        worldState.relationships[partner.key].dating = null;
        worldState.userScores[partner.key] =
          simulationConfig.datingRules.cheatingPenaltyScore;
        console.log(
          `[CACHE] Invalidating cache for ${partner.name} due to cheating.`
        );
        delete worldState.instructionCache[partner.key];
      });
      history += `\n\nSystem: (${getTimestamp()}) ${
        parsed.reply || "Word got around that you were seeing multiple people."
      }`;
    } else if (parsed.startDating === true) {
      console.log(`[SOCIAL] User ${userName} is now dating ${persona.name}.`);
      invalidateCache = true;
      const oldPartnerKey = worldState.relationships[persona.key].dating;
      if (oldPartnerKey && oldPartnerKey !== "user_player") {
        const oldPartner = FRIEND_PERSONAS.find((p) => p.key === oldPartnerKey);
        if (oldPartner) {
          console.log(
            `[SOCIAL] ${persona.name} dumped ${oldPartner.name}. Applying -40 relationship penalty.`
          );
          worldState.userScores[oldPartnerKey] = clamp(
            worldState.userScores[oldPartnerKey] - 40,
            0,
            100
          );
          worldState.relationships[oldPartnerKey].dating = null;
          worldState.relationships[oldPartnerKey].previousPartner = persona.key;
        }
      }
      worldState.relationships[persona.key].dating = "user_player";
      worldState.relationships[persona.key].previousPartner = oldPartnerKey;
    }

    if (parsed.userRevealedAge === true) {
      console.log(
        `[SOCIAL] User ${userName} revealed their true age to ${persona.name}.`
      );
      invalidateCache = true;
      worldState.ageKnowledge[friendKey] = { knows: true, source: "user" };
      const sourcePersona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
      if (
        sourcePersona &&
        (sourcePersona.group === "student" ||
          sourcePersona.group === "townie_alumni")
      ) {
        const { gossipChance, gossipScope } = simulationConfig.socialRules;
        if (Math.random() < gossipChance) {
          const gossipGroup = FRIEND_PERSONAS.filter(
            (p) =>
              p.group === sourcePersona.group && p.key !== sourcePersona.key
          );
          const shuffledGroup = shuffleArray(gossipGroup);
          const targets = shuffledGroup.slice(0, gossipScope);

          console.log(
            `[GOSSIP] Gossip triggered! ${sourcePersona.name} is telling ${targets.length} other people in their group.`
          );
          targets.forEach((member) => {
            if (!worldState.ageKnowledge[member.key]) {
              worldState.ageKnowledge[member.key] = {
                knows: true,
                source: friendKey,
              };
              console.log(
                `[CACHE] Invalidating cache for ${member.name} due to gossip.`
              );
              delete worldState.instructionCache[member.key];
            }
          });
        } else {
          console.log(
            `[GOSSIP] Gossip chance failed. ${sourcePersona.name} keeps the secret.`
          );
        }
      }
    }

    const reply = parsed.reply || "sry, my mind is blank rn...";
    const change = parseInt(parsed.relationshipChange, 10) || 0;

    const oldScore = worldState.userScores[friendKey];
    worldState.userScores[friendKey] = clamp(oldScore + change, 0, 100);
    const newScore = worldState.userScores[friendKey];

    const oldTier = getRelationshipTier(simulationConfig, oldScore);
    const newTier = getRelationshipTier(simulationConfig, newScore);
    if (oldTier !== newTier) {
      console.log(
        `[CACHE] Invalidating cache for ${persona.name} due to relationship tier change (${oldTier} -> ${newTier}).`
      );
      invalidateCache = true;
    }

    if (
      newScore <= simulationConfig.socialRules.hostileThreshold &&
      oldScore > simulationConfig.socialRules.hostileThreshold
    ) {
      worldState.moderation[friendKey].blocked = true;
      statusUpdate = {
        key: friendKey,
        icon: "/icq-blocked.gif",
        className: "buddy blocked-buddy",
      };
      console.log(`[REAL-TIME] ${userName} was blocked by ${persona.name}.`);
    } else if (
      newScore >= simulationConfig.socialRules.bffThreshold &&
      oldScore < simulationConfig.socialRules.bffThreshold
    ) {
      statusUpdate = {
        key: friendKey,
        icon: isStillOnline ? "/icq-bff.gif" : "/icq-offline.gif",
        className: isStillOnline ? "buddy bff-buddy" : "buddy offline-buddy",
      };
      console.log(`[REAL-TIME] ${userName} is now BFFs with ${persona.name}.`);
    } else if (
      newScore < simulationConfig.socialRules.bffThreshold &&
      oldScore >= simulationConfig.socialRules.bffThreshold
    ) {
      statusUpdate = {
        key: friendKey,
        icon: isStillOnline ? "/icq-online.gif" : "/icq-offline.gif",
        className: isStillOnline ? "buddy" : "buddy offline-buddy",
      };
      if (worldState.relationships[friendKey]?.dating === "user_player") {
        console.log(
          `[SOCIAL] ${persona.name} broke up with ${userName} because their score dropped.`
        );
        history += `\n\nSystem: (${getTimestamp()}) ${
          persona.name
        } is no longer your partner because your friendship cooled.`;
        worldState.relationships[friendKey].dating = null;
        const exPartnerKey =
          worldState.relationships[friendKey].previousPartner;
        if (exPartnerKey) {
          worldState.userScores[exPartnerKey] = clamp(
            worldState.userScores[exPartnerKey] +
              simulationConfig.datingRules.breakupForgivenessBonus,
            0,
            100
          );
          console.log(
            `[SOCIAL] ${exPartnerKey}'s opinion of you has improved.`
          );
        }
      }
      console.log(
        `[REAL-TIME] ${userName} is no longer BFFs with ${persona.name}.`
      );
    }

    if (invalidateCache) {
      delete worldState.instructionCache[friendKey];
    }

    history += `\n\n${persona.name}: (${getTimestamp()}) ${reply.trim()}`;

    if (simulationConfig.featureToggles.enableHonestySystem) {
      const preference = await analyzeUserPreference(prompt.trim());
      if (preference.action === "like" && preference.topic) {
        if (
          !worldState.userDislikes[preference.topic] &&
          !worldState.userLikes[preference.topic]
        ) {
          console.log(
            `[PREFERENCE] User likes '${preference.topic}'. Told to ${persona.name}.`
          );
          worldState.userLikes[preference.topic] = friendKey;
        }
      } else if (preference.action === "dislike" && preference.topic) {
        if (
          !worldState.userLikes[preference.topic] &&
          !worldState.userDislikes[preference.topic]
        ) {
          console.log(
            `[PREFERENCE] User dislikes '${preference.topic}'. Told to ${persona.name}.`
          );
          worldState.userDislikes[preference.topic] = friendKey;
        }
      }
    }

    const messages = history.split(
      /\n\n(?=(?:System:|Image:|(?:[^:]+:\s\([^)]+\)\s)))/
    );
    const messageCount = messages.filter(
      (line) => !line.startsWith("System:") && !line.startsWith("Image:")
    ).length;

    if (
      simulationConfig.featureToggles.enableHistoryCondensation &&
      messageCount >
        simulationConfig.systemSettings.historyCondensationThreshold
    ) {
      console.log(
        `[HISTORY] Condensation triggered for ${persona.name}. Message count: ${messageCount}`
      );
      // Summarize the full history before truncating it.
      const summary = await summarizeHistory(history, userName, persona.name);
      worldState.chatSummaries[friendKey] = summary;

      // Truncate the history to only the last few messages, making the summary process transparent to the user.
      const lastFewMessages = messages.slice(-4).join("\n\n");
      history = lastFewMessages;

      console.log(
        `[CACHE] Invalidating cache for ${persona.name} due to history condensation.`
      );
      delete worldState.instructionCache[friendKey];
    }
  } catch (err) {
    console.error(
      `[Friend Controller Error] API call failed for ${persona.name}:`,
      err
    );
    history += `\n\nSystem: (${getTimestamp()}) Error - My brain is broken, couldn't connect to the mothership. Try again later.`;
  }

  worldState.chatHistories[friendKey] = history;
  writeProfile(userName, worldState);

  res.send(
    renderChatWindowPage({
      persona,
      worldState,
      history,
      isBlocked: worldState.moderation[friendKey]?.blocked,
      showScores,
      statusUpdate,
      isFrameView,
    })
  );
};

const getClearChat = (req, res) => {
  const { friend: friendKey, view } = req.query;
  const { userName } = req.session;
  const worldState = req.worldState;
  const isFrameView = view === "frame";

  if (worldState && worldState.chatHistories) {
    delete worldState.chatHistories[friendKey];
    if (worldState.chatSummaries) {
      delete worldState.chatSummaries[friendKey];
    }
    if (worldState.instructionCache) {
      delete worldState.instructionCache[friendKey];
    }
    writeProfile(userName, worldState);
  }

  let redirectUrl = `/chat?friend=${friendKey}`;
  if (isFrameView) redirectUrl += "&view=frame";
  res.redirect(redirectUrl);
};

const getApologyPage = (req, res) => {
  const { friend: friendKey } = req.query;
  const worldState = req.worldState;
  const persona = ALL_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }
  res.send(renderApologyPage(persona, worldState));
};

const postApology = async (req, res) => {
  const { friend: friendKey, apologyText } = req.body;
  const { userName } = req.session;
  const showScores = req.session.showScores || false;

  if (!apologyText) {
    return res.redirect("/");
  }

  const worldState = req.worldState;
  const persona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  let history = "";
  let isBlocked = worldState.moderation[friendKey].blocked;
  let statusUpdate = null;

  try {
    const systemInstruction = aiLogic.generateApologyJudgeInstruction(
      persona,
      apologyText.trim()
    );
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "This is my apology." }] }],
      config: { systemInstruction, responseMimeType: "application/json" },
    });
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    const parsed = JSON.parse(jsonStr);

    if (parsed.unblocked === true) {
      worldState.moderation[friendKey].blocked = false;
      worldState.moderation[friendKey].warning = false;
      worldState.userScores[friendKey] = 10;
      isBlocked = false;
      history = `System: (${getTimestamp()}) Your apology was accepted. You have been unblocked.`;
      statusUpdate = {
        key: friendKey,
        icon: "/icq-online.gif",
        className: "buddy",
      };
      console.log(
        `[CACHE] Invalidating cache for ${persona.name} due to unblock.`
      );
      delete worldState.instructionCache[friendKey];
      console.log(`[REAL-TIME] ${userName} was unblocked by ${persona.name}.`);
    } else {
      history = `System: (${getTimestamp()}) Your apology was rejected.`;
    }

    history += `\n\n${persona.name}: (${getTimestamp()}) ${
      parsed.reply || "..."
    }`;
  } catch (err) {
    console.error("Apology processing error:", err);
    history = `System: (${getTimestamp()}) Error - My brain is broken, couldn't connect to the mothership. Try again later.`;
  }

  worldState.chatHistories[friendKey] = history;
  writeProfile(userName, worldState);
  res.send(
    renderChatWindowPage({
      persona,
      worldState,
      history,
      isBlocked,
      showScores,
      statusUpdate,
    })
  );
};

const getFilesPage = (req, res) => {
  const worldState = req.worldState;
  res.send(renderFilesPage(worldState));
};

const getCheckImageStatus = (req, res) => {
  const { jobId, friend: friendKey, view } = req.query;
  const { userName } = req.session;
  const job = global.imageJobs[jobId];
  const showScores = req.session.showScores || false;
  const isFrameView = view === "frame";

  const worldState = req.worldState;

  const persona = ALL_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  if (!job || job.userName !== userName) {
    let history =
      worldState.chatHistories[friendKey] ||
      `System: (${getTimestamp()}) You are now chatting with ${persona.name}.`;
    history += `\n\nSystem: (${getTimestamp()}) The connection was lost while taking the picture. Please try again.`;
    worldState.chatHistories[friendKey] = history;
    writeProfile(userName, worldState);
    return res.send(
      renderChatWindowPage({
        persona,
        worldState,
        history,
        showScores,
        isFrameView,
      })
    );
  }

  const { status, url } = job;

  let history =
    worldState.chatHistories[friendKey] ||
    `System: (${getTimestamp()}) You are now chatting with ${persona.name}.`;

  if (status === "pending") {
    let refreshUrl = `/check-image?jobId=${jobId}&friend=${friendKey}`;
    if (isFrameView) refreshUrl += "&view=frame";
    const metaRefreshTag = `<meta http-equiv="refresh" content="15; URL=${refreshUrl}">`;
    return res.send(
      renderChatWindowPage({
        persona,
        worldState,
        history,
        metaRefreshTag,
        showScores,
        isFrameView,
      })
    );
  }

  if (status === "complete") {
    worldState.receivedFiles.push({
      senderName: persona.name,
      senderKey: persona.key,
      url: url,
      date: new Date().toISOString(),
    });
    history += `\n\n${
      persona.name
    }: (${getTimestamp()}) Ok, here it is!\n\nImage: ${url}`;
  } else if (status === "failed") {
    history += `\n\n${
      persona.name
    }: (${getTimestamp()}) Ugh, my camera is broken... not sure what happened. Maybe another time.`;
  }

  worldState.chatHistories[friendKey] = history;
  writeProfile(userName, worldState);
  delete global.imageJobs[jobId];
  res.send(
    renderChatWindowPage({
      persona,
      worldState,
      history,
      showScores,
      isFrameView,
    })
  );
};

const getAboutPage = (req, res) => {
  const worldState = req.worldState;
  res.send(renderAboutPage(worldState));
};

module.exports = {
  getBuddyListPage,
  getChatPage,
  postChatMessage,
  getClearChat,
  getApologyPage,
  postApology,
  getFilesPage,
  getCheckImageStatus,
  getAboutPage,
  getModernAppShell,
};
