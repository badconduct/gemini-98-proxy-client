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
} = require("../views/appRenderer");
const { getTimestamp, clamp } = require("../lib/utils");
const { readProfile, writeProfile } = require("../lib/state-manager");
const aiLogic = require("../lib/ai-logic");

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

// --- Background Image Generation ---

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

const getBuddyListPage = (req, res) => {
  const { userName } = req.session;
  const worldState = readProfile(userName);

  if (!worldState) {
    console.error(
      `Logged-in user's profile not found: ${userName}. Forcing logout.`
    );
    return req.session.destroy(() => res.redirect("/"));
  }

  const onlineFriendKeys = [];
  const offlineFriendKeys = [];

  const now = new Date();
  const currentHour = now.getHours();
  const currentMonth = now.getMonth();
  const currentDay = now.getDay();

  const isSummer = currentMonth >= 5 && currentMonth <= 7;
  const seasonKey = isSummer ? "summer" : "schoolYear";

  const isWeekend = currentDay === 0 || currentDay === 6;
  const dayTypeKey = isWeekend ? "weekend" : "weekday";

  FRIEND_PERSONAS.forEach((persona) => {
    if (worldState.moderation[persona.key]?.blocked) {
      offlineFriendKeys.push(persona.key);
      return;
    }

    let isOnlineNow = false;
    const activeSchedule = persona.schedules?.[seasonKey]?.[dayTypeKey] || [];

    if (activeSchedule) {
      for (const window of activeSchedule) {
        const [start, end] = window;
        if (start <= end) {
          if (currentHour >= start && currentHour <= end) {
            isOnlineNow = true;
            break;
          }
        } else {
          if (currentHour >= start || currentHour <= end) {
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
      req.session.isAdmin || false
    )
  );
};

const getChatPage = (req, res) => {
  const { friend: friendKey, status } = req.query;
  const { userName } = req.session;

  const worldState = readProfile(userName);
  if (!worldState) {
    console.error(
      `Logged-in user's profile not found: ${userName}. Forcing logout.`
    );
    return req.session.destroy(() => res.redirect("/"));
  }

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
    // Create initial history if none exists
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
    // Add a session separator if loading existing history
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
    })
  );
};

const postChatMessage = async (req, res) => {
  const { prompt, friend: friendKey, history: historyBase64 } = req.body;
  const { userName } = req.session;

  const worldState = readProfile(userName);
  if (!worldState) {
    console.error(
      `Logged-in user's profile not found: ${userName}. Forcing logout.`
    );
    return req.session.destroy(() => res.redirect("/"));
  }

  const persona = FRIEND_PERSONAS.find((p) => p.key === friendKey);

  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  let history = Buffer.from(historyBase64, "base64").toString("utf8");
  const isBlocked =
    worldState.moderation[friendKey] &&
    worldState.moderation[friendKey].blocked;
  const showScores = req.session.showScores || false;

  if (!prompt || !prompt.trim() || isBlocked) {
    return res.send(
      renderChatWindowPage({
        persona,
        worldState,
        history,
        isOffline: false,
        isBlocked,
        showScores,
      })
    );
  }

  history += `\n\n${userName}: (${getTimestamp()}) ${prompt.trim()}`;

  try {
    const contents = aiLogic.buildHistoryForApi(history, userName);
    const systemInstruction = aiLogic.generatePersonalizedInstruction(
      persona,
      worldState
    );
    const config = {
      systemInstruction,
      responseMimeType: "application/json",
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
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

      const metaRefreshTag = `<meta http-equiv="refresh" content="15; URL=/check-image?jobId=${jobId}&friend=${friendKey}">`;

      return res.send(
        renderChatWindowPage({
          persona,
          worldState,
          history,
          metaRefreshTag,
          showScores,
        })
      );
    }

    // --- Gossip Mechanic ---
    if (parsed.userRevealedAge === true) {
      console.log(
        `[SOCIAL] User ${userName} revealed their true age to ${persona.name}.`
      );
      worldState.ageKnowledge[friendKey] = { knows: true, source: "user" };
      const sourcePersona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
      if (
        sourcePersona &&
        (sourcePersona.group === "student" ||
          sourcePersona.group === "townie_alumni")
      ) {
        const gossipGroup = FRIEND_PERSONAS.filter(
          (p) => p.group === sourcePersona.group && p.key !== sourcePersona.key
        );
        console.log(
          `[GOSSIP] ${sourcePersona.name} is telling ${gossipGroup.length} other people in their group.`
        );
        gossipGroup.forEach((member) => {
          if (!worldState.ageKnowledge[member.key]) {
            worldState.ageKnowledge[member.key] = {
              knows: true,
              source: friendKey,
            };
          }
        });
      }
    }

    const reply = parsed.reply || "sry, my mind is blank rn...";
    const change = parseInt(parsed.relationshipChange, 10) || 0;

    // Friends should speak in single lines/paragraphs. Remove newlines to prevent display bugs.
    const finalReply = reply.replace(/[\r\n]+/g, " ").trim();

    if (change !== 0) {
      const oldScore = worldState.userScores[friendKey];
      worldState.userScores[friendKey] = clamp(oldScore + change, 0, 100);
    }
    history += `\n\n${persona.name}: (${getTimestamp()}) ${finalReply}`;
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
      isOffline: false,
      isBlocked:
        worldState.moderation[friendKey] &&
        worldState.moderation[friendKey].blocked,
      showScores,
    })
  );
};

const getClearChat = (req, res) => {
  const { friend: friendKey } = req.query;
  const { userName } = req.session;

  const worldState = readProfile(userName);
  if (worldState && worldState.chatHistories) {
    delete worldState.chatHistories[friendKey];
    writeProfile(userName, worldState);
  }

  res.redirect(`/chat?friend=${friendKey}`);
};

const getApologyPage = (req, res) => {
  const { friend: friendKey } = req.query;
  const { userName } = req.session;

  const worldState = readProfile(userName);
  if (!worldState) {
    return req.session.destroy(() => res.redirect("/"));
  }

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

  const worldState = readProfile(userName);
  if (!worldState) {
    return req.session.destroy(() => res.redirect("/"));
  }

  const persona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  let history = "";
  let isBlocked = worldState.moderation[friendKey].blocked;

  try {
    const systemInstruction = aiLogic.generateApologyJudgeInstruction(
      persona,
      apologyText.trim()
    );
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
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
      isOffline: false,
      isBlocked,
      showScores,
    })
  );
};

const getFilesPage = (req, res) => {
  const { userName } = req.session;
  const worldState = readProfile(userName);
  if (!worldState) {
    return req.session.destroy(() => res.redirect("/"));
  }
  res.send(renderFilesPage(worldState));
};

const getCheckImageStatus = (req, res) => {
  const { jobId, friend: friendKey } = req.query;
  const { userName } = req.session;
  const job = global.imageJobs[jobId];
  const showScores = req.session.showScores || false;

  const worldState = readProfile(userName);
  if (!worldState) {
    return req.session.destroy(() => res.redirect("/"));
  }

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
      renderChatWindowPage({ persona, worldState, history, showScores })
    );
  }

  const { status, url } = job;

  let history =
    worldState.chatHistories[friendKey] ||
    `System: (${getTimestamp()}) You are now chatting with ${persona.name}.`;

  if (status === "pending") {
    const metaRefreshTag = `<meta http-equiv="refresh" content="15; URL=/check-image?jobId=${jobId}&friend=${friendKey}">`;
    // No change to history, just re-render with polling tag
    return res.send(
      renderChatWindowPage({
        persona,
        worldState,
        history,
        metaRefreshTag,
        showScores,
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
  delete global.imageJobs[jobId]; // Clean up completed/failed job
  res.send(renderChatWindowPage({ persona, worldState, history, showScores }));
};

const getAboutPage = (req, res) => {
  const { userName } = req.session;
  const worldState = readProfile(userName);
  if (!worldState) {
    return req.session.destroy(() => res.redirect("/"));
  }
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
};
