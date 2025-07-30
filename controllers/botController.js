const { GoogleGenAI } = require("@google/genai");
const { UTILITY_BOTS } = require("../config/personas");
const { renderChatWindowPage } = require("../views/appRenderer");
const { getTimestamp } = require("../lib/utils");
const { writeProfile } = require("../lib/state-manager");
const aiLogic = require("../lib/ai-logic");

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

// --- Timezone Configuration ---
const TIMEZONE_OFFSET = parseInt(process.env.TIMEZONE_OFFSET, 10) || 0;

async function postBotMessage(req, res) {
  const { prompt, friend: botKey } = req.body;
  const { userName } = req.session;
  const worldState = req.worldState;
  const isFrameView = req.query.view === "frame";

  const persona = UTILITY_BOTS.find((p) => p.key === botKey);
  if (!persona || !prompt || !prompt.trim()) {
    let redirectUrl = `/chat?friend=${botKey}`;
    if (isFrameView) redirectUrl += "&view=frame";
    return res.redirect(redirectUrl);
  }

  const displayName = persona.screenName || persona.name;
  let history = worldState.chatHistories[botKey] || "";

  // Initialize history if it's the first message
  if (!history) {
    history = `System: (${getTimestamp()}) You are now chatting with ${displayName}.`;
    if (persona.openingLine) {
      history += `\n\n${displayName}: (${getTimestamp()}) ${persona.openingLine.replace(
        "{userName}",
        worldState.realName
      )}`;
    }
  }

  history += `\n\n${userName}: (${getTimestamp()}) ${prompt.trim()}`;

  let reply = "";

  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const currentHour = (utcHour + TIMEZONE_OFFSET + 24) % 24;
    const currentDay = now.getUTCDay();
    const isSummer = now.getUTCMonth() >= 6 && now.getUTCMonth() <= 7;
    const isWeekend = currentDay === 0 || currentDay === 6;
    const dayType = isWeekend ? "weekend" : "weekday";
    const timeContext = { currentHour, dayType, isSummer };

    const contents = aiLogic.buildHistoryForApi(history, worldState.userName);
    let systemInstruction;
    if (persona.key === "nostalgia_bot") {
      systemInstruction = aiLogic.generateNostalgiaBotInstruction(
        persona,
        worldState,
        timeContext
      );
    } else {
      systemInstruction = persona.systemInstruction.replace(
        "{userName}",
        worldState.realName
      );
    }

    const config = { systemInstruction };
    if (
      persona.key === "code_bot" ||
      persona.key === "win98_help_bot" ||
      persona.key === "nostalgia_bot"
    ) {
      config.safetySettings = [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
      ];

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents,
        config,
      });

      let fullReply = "";
      for await (const chunk of responseStream) {
        fullReply += chunk.text;
      }
      reply = fullReply.trim().replace(/\n\n/g, "\n");
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config,
      });
      reply = (response.text || "sry, my mind is blank rn...")
        .replace(/[\r\n]+/g, " ")
        .trim();
    }

    history += `\n\n${displayName}: (${getTimestamp()}) ${reply}`;
  } catch (err) {
    console.error(`[Bot Responder] Failed for ${persona.name}:`, err);
    history += `\n\nSystem: (${getTimestamp()}) Error - My brain is broken, couldn't connect to the mothership. Try again later.`;
  } finally {
    worldState.chatHistories[botKey] = history;
    writeProfile(userName, worldState);

    // Instead of redirecting, render the page directly with the new content
    res.send(
      renderChatWindowPage({
        persona,
        worldState,
        history,
        isOffline: false,
        isBlocked: false,
        isTyping: false,
        metaRefreshTag: "",
        showScores: req.session.showScores || false,
        isFrameView,
      })
    );
  }
}

module.exports = {
  postBotMessage,
};
