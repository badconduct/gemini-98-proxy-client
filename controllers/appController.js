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
const { writeProfile, readProfile } = require("../lib/state-manager");
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

// --- Asynchronous Chat Logic ---

/**
 * Handles the entire lifecycle of getting a friend's response in the background.
 * It calls the AI once to get the reply and delay, then populates the job object.
 * @param {string} userName - The user's name.
 * @param {string} friendKey - The friend's key.
 * @param {string|null} timeContextString - Context about time passed since last chat.
 */
async function processFriendChatInBackground(
  userName,
  friendKey,
  timeContextString
) {
  const jobKey = `${userName}_${friendKey}`;
  const job = global.chatJobs[jobKey];

  if (!job) {
    console.error(
      `[Chat Worker] Job ${jobKey} not found. It may have been cancelled or timed out.`
    );
    return;
  }

  const persona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
  let worldState = readProfile(userName);
  const simulationConfig = getSimulationConfig();

  try {
    const now = new Date();
    const isSummer = now.getUTCMonth() >= 6 && now.getUTCMonth() <= 7;

    // 1. Content Filter Check
    const fullPrompt = job.messages.join(" ");
    if (simulationConfig.featureToggles.enableRRatedFilter) {
      const filterResult = await checkRRatedContent(
        fullPrompt,
        persona,
        worldState,
        simulationConfig
      );
      if (filterResult.violation) {
        let history = worldState.chatHistories[friendKey] || "";
        history += `\n\n${persona.name}: (${getTimestamp()}) ${
          filterResult.reply
        }`;
        filterResult.worldState.chatHistories[friendKey] = history;
        // Update timestamp even on a filtered reply to prevent repeated time-based greetings
        filterResult.worldState.lastInteractionTimestamps[friendKey] =
          new Date().toISOString();
        writeProfile(userName, filterResult.worldState);
        delete global.chatJobs[jobKey];
        return;
      }
    }

    // 2. Generate AI Response and Delay
    const contents = aiLogic.buildHistoryForApi(
      worldState.chatHistories[friendKey] || "",
      userName
    );
    const { systemInstruction, safetySettings, responseSchema } =
      aiLogic.generatePersonalizedInstruction(
        persona,
        worldState,
        isSummer,
        simulationConfig,
        timeContextString,
        job.messages
      );

    const config = {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
    };
    if (safetySettings) config.safetySettings = safetySettings;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config,
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) jsonStr = match[2].trim();
    const parsed = JSON.parse(jsonStr);

    // Update the job with the AI's response data
    const currentJob = global.chatJobs[jobKey]; // Re-fetch in case it was cancelled
    if (currentJob) {
      currentJob.reply = parsed.reply || "sry, my mind is blank rn...";
      currentJob.relationshipChange =
        parseInt(parsed.relationshipChange, 10) || 0;
      currentJob.isImageRequest = parsed.isImageRequest || false;

      const silentDelay = Math.max(
        5,
        parseInt(parsed.responseDelaySeconds, 10) || 15
      );
      const typingDurationMs = 3000; // 3 seconds typing animation

      currentJob.typingStartTime = Date.now() + silentDelay * 1000;
      currentJob.finalEndTime = currentJob.typingStartTime + typingDurationMs;

      console.log(
        `[Chat Worker] AI for ${persona.name} will reply in ${silentDelay} seconds.`
      );
    }
  } catch (err) {
    console.error(`[Chat Worker] AI call failed for ${persona.name}:`, err);
    // Write an error to the user's chat and clean up
    let worldState = readProfile(userName); // Re-read to prevent race conditions
    let history = worldState.chatHistories[friendKey] || "";
    history += `\n\nSystem: (${getTimestamp()}) Error - My brain is broken, couldn't connect to the mothership. Try again later.`;
    worldState.chatHistories[friendKey] = history;
    worldState.lastInteractionTimestamps[friendKey] = new Date().toISOString();
    writeProfile(userName, worldState);
    delete global.chatJobs[jobKey];
  }
}

// --- Image Generation ---
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
  let worldState = req.worldState; // Use let as it can be modified
  const isFrameView = view === "frame";
  const simulationConfig = getSimulationConfig();

  const persona = ALL_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  const isBlocked = worldState.moderation[friendKey]?.blocked;
  const isOffline = status === "offline";
  let history = worldState.chatHistories[friendKey];
  let isTyping = false;
  let metaRefreshTag = `<meta http-equiv="refresh" content="60">`; // Default long poll

  // Initialize history if it doesn't exist
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
  }

  // --- Main Chat Job State Machine ---
  const jobKey = `${userName}_${friendKey}`;
  const job = global.chatJobs[jobKey];

  if (job) {
    // A job exists, check its state.
    const now = Date.now();
    // A job is only finished if it has a finalEndTime and it has passed.
    const isFinished = job.finalEndTime && now >= job.finalEndTime;
    // A job is only typing if it has a typingStartTime and it has passed, but is not yet finished.
    const isCurrentlyTyping =
      job.typingStartTime && now >= job.typingStartTime && !isFinished;

    if (isFinished) {
      // The wait is over. Finalize the response.
      // Defensive check: Ensure the job is valid before processing.
      if (job.reply) {
        const replyText = job.reply.trim();
        history += `\n\n${persona.name}: (${getTimestamp()}) ${replyText}`;

        // Only update score if we have a valid relationshipChange from the job
        if (
          job.relationshipChange !== undefined &&
          !isNaN(job.relationshipChange)
        ) {
          const oldScore = worldState.userScores[friendKey];
          worldState.userScores[friendKey] = clamp(
            oldScore + job.relationshipChange,
            0,
            100
          );

          if (
            getRelationshipTier(simulationConfig, oldScore) !==
            getRelationshipTier(
              simulationConfig,
              worldState.userScores[friendKey]
            )
          ) {
            delete worldState.instructionCache[friendKey];
          }
        }
        worldState.lastInteractionTimestamps[friendKey] =
          new Date().toISOString();
      } else {
        // This is a broken/failed job. Log it and inform the user gracefully.
        console.error(
          `[Chat] Found a finished but invalid job for ${jobKey}. Cleaning up.`
        );
        history += `\n\nSystem: (${getTimestamp()}) I'm at a loss for words... something went wrong. Please try again.`;
      }

      // Write the updated history and clean up the job regardless of success or failure.
      worldState.chatHistories[friendKey] = history;
      writeProfile(userName, worldState);
      delete global.chatJobs[jobKey];
    } else if (isCurrentlyTyping) {
      // We are in the typing period.
      isTyping = true;
      metaRefreshTag = `<meta http-equiv="refresh" content="3; URL=${req.originalUrl}">`;
    } else {
      // We are in the silent waiting period.
      isTyping = false;
      metaRefreshTag = `<meta http-equiv="refresh" content="7; URL=${req.originalUrl}">`;
    }
  }

  res.send(
    renderChatWindowPage({
      persona,
      worldState,
      history,
      isOffline,
      isBlocked,
      isTyping,
      metaRefreshTag,
      showScores: req.session.showScores || false,
      isFrameView,
    })
  );
};

const postChatMessage = async (req, res) => {
  const { prompt, friend: friendKey } = req.body;
  const { userName } = req.session;
  let worldState = req.worldState;
  const isFrameView = req.query.view === "frame";

  const persona = FRIEND_PERSONAS.find((p) => p.key === friendKey);

  if (
    !persona ||
    !prompt ||
    !prompt.trim() ||
    worldState.moderation[friendKey]?.blocked
  ) {
    let redirectUrl = `/chat?friend=${friendKey}`;
    if (isFrameView) redirectUrl += "&view=frame";
    return res.redirect(redirectUrl);
  }

  // --- Time-Aware Logic ---
  let timeContextString = null;
  worldState.lastInteractionTimestamps =
    worldState.lastInteractionTimestamps || {};
  const lastInteraction = worldState.lastInteractionTimestamps[friendKey];

  if (lastInteraction) {
    const hoursDiff =
      (new Date() - new Date(lastInteraction)) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      timeContextString =
        "It is a new day. Greet the user and ask a follow-up question about your last conversation if appropriate.";
    } else if (hoursDiff > 1) {
      let history = worldState.chatHistories[friendKey] || "";
      const lastLine = history.split("\n\n").pop() || "";
      if (persona.goodbyeLine && !lastLine.includes(persona.goodbyeLine)) {
        console.log(
          `[Time Aware] Over an hour since last chat with ${persona.name}.`
        );
        timeContextString =
          "It has been over an hour since you last spoke, and the user did not say goodbye. Ask them where they went or what they were up to.";
      }
    }
  }

  // Append user's message to history immediately
  worldState.chatHistories[
    friendKey
  ] += `\n\n${userName}: (${getTimestamp()}) ${prompt.trim()}`;
  writeProfile(userName, worldState); // Save immediately so the background job has the latest history

  // --- Job Management ---
  const jobKey = `${userName}_${friendKey}`;
  const existingJob = global.chatJobs[jobKey];

  const newMessages = (existingJob ? existingJob.messages : []).concat(
    prompt.trim()
  );

  if (existingJob) {
    delete global.chatJobs[jobKey];
  }

  global.chatJobs[jobKey] = {
    messages: newMessages,
    typingStartTime: null,
    finalEndTime: null,
  };

  processFriendChatInBackground(userName, friendKey, timeContextString); // Fire-and-forget

  let redirectUrl = `/chat?friend=${friendKey}`;
  if (isFrameView) redirectUrl += `&view=frame`;
  res.redirect(redirectUrl);
};

const getClearChat = (req, res) => {
  const { friend: friendKey, view } = req.query;
  const { userName } = req.session;
  const worldState = req.worldState;
  const isFrameView = view === "frame";

  if (worldState && worldState.chatHistories) {
    delete worldState.chatHistories[friendKey];
    if (worldState.instructionCache)
      delete worldState.instructionCache[friendKey];
    // Also clear the interaction timestamp
    if (worldState.lastInteractionTimestamps)
      delete worldState.lastInteractionTimestamps[friendKey];
    writeProfile(userName, worldState);
  }

  // Also clear any pending chat job for this friend
  const jobKey = `${userName}_${friendKey}`;
  if (global.chatJobs[jobKey]) {
    delete global.chatJobs[jobKey];
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
