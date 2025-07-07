const { GoogleGenAI } = require("@google/genai");
const { UTILITY_BOTS } = require("../config/personas");
const { renderChatWindowPage } = require("../views/appRenderer");
const { getTimestamp } = require("../lib/utils");
const { readProfile, writeProfile } = require("../lib/state-manager");
const aiLogic = require("../lib/ai-logic");

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

async function postBotMessage(req, res) {
  const { prompt, friend: botKey, history: historyBase64 } = req.body;
  const { userName } = req.session;

  const worldState = readProfile(userName);
  if (!worldState) {
    console.error(
      `Logged-in user's profile not found: ${userName}. Forcing logout.`
    );
    return req.session.destroy(() => res.redirect("/"));
  }

  const persona = UTILITY_BOTS.find((p) => p.key === botKey);

  if (!persona) {
    return res.status(404).send("Error: Bot not found.");
  }

  let history = Buffer.from(historyBase64, "base64").toString("utf8");
  const showScores = req.session.showScores || false;

  if (!prompt || !prompt.trim()) {
    return res.send(
      renderChatWindowPage({
        persona,
        worldState,
        history,
        isOffline: false,
        isBlocked: false,
        showScores,
      })
    );
  }

  history += `\n\n${userName}: (${getTimestamp()}) ${prompt.trim()}`;

  try {
    let reply = "";
    const contents = aiLogic.buildHistoryForApi(history, userName);

    let systemInstruction;
    if (persona.key === "nostalgia_bot") {
      // Add time context for schedule awareness
      const now = new Date();
      const currentHour = now.getHours();
      const currentMonth = now.getMonth();
      const currentDay = now.getDay();
      const isSummer = currentMonth >= 6 && currentMonth <= 7; // July-Aug
      const isWeekend = currentDay === 0 || currentDay === 6; // Sun or Sat
      const dayType = isWeekend ? "weekend" : "weekday";
      const timeContext = { currentHour, dayType, isSummer };

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

    // Use streaming for bots that need long answers to prevent truncation.
    if (
      persona.key === "code_bot" ||
      persona.key === "win98_help_bot" ||
      persona.key === "nostalgia_bot"
    ) {
      // Relax safety settings to allow for technical content (code, logs)
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
      console.log(
        `[AI] Using streaming with adjusted safety settings for ${persona.name}.`
      );

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash-preview-04-17",
        contents,
        config,
      });

      let fullReply = "";
      for await (const chunk of responseStream) {
        fullReply += chunk.text;
      }

      // Trim and normalize newlines. Double newlines are converted to single newlines
      // to preserve paragraph breaks without breaking the message renderer, which
      // uses a double newline as a message separator.
      reply = fullReply.trim().replace(/\n\n/g, "\n");
    } else {
      // Use non-streaming for concise bots (Gemini Bot)
      console.log(`[AI] Using non-streaming for ${persona.name}.`);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents,
        config,
      });

      // For single-line bots, remove all newlines to be safe.
      reply = (response.text || "sry, my mind is blank rn...")
        .replace(/[\r\n]+/g, " ")
        .trim();
    }

    history += `\n\n${persona.name}: (${getTimestamp()}) ${reply}`;
  } catch (err) {
    console.error(
      `[Bot Controller Error] API call failed for ${persona.name}:`,
      err
    );
    history += `\n\nSystem: (${getTimestamp()}) Error - My brain is broken, couldn't connect to the mothership. Try again later.`;
  }

  worldState.chatHistories[botKey] = history;
  writeProfile(userName, worldState);

  res.send(
    renderChatWindowPage({
      persona,
      worldState,
      history,
      isOffline: false, // bots are never offline
      isBlocked: false, // bots cannot be blocked
      showScores,
    })
  );
}

module.exports = {
  postBotMessage,
};
