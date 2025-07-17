const { GoogleGenAI } = require("@google/genai");
const { getTimestamp, clamp } = require("./utils");

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

const DRUG_REPLIES = [
  "Winners don't do drugs.",
  "This is your brain on drugs. Any questions?",
  "Umm, no thanks. I choose to be drug-free.",
  "That's not cool. Just say no.",
];

const VIOLENCE_REPLIES = [
  "Whoa, what is WRONG with you? Are you threatening me?!",
  "That's a disgusting thing to say. I don't want to talk to you right now.",
];

const SEXUAL_REPLIES_NON_BFF = [
  "Eww, gross. That's really insulting, don't talk to me like that.",
  "Whoa, that is NOT what I'm about. That's really inappropriate.",
];

const SEXUAL_REPLIES_BFF_NON_DATING = [
  "Look, {realName}, we're really good friends. Like, super close, I trust you with anything. But that's where it stops. I thought that was pretty clear, honestly. Let's not make things weird between us, okay?",
  "Whoa. I... I don't know what to say. I think you're awesome, but I've always just seen you as my best friend. Can we just pretend you didn't say that and go back to normal?",
  "Okay, hold up. You're my best friend, and I don't want to mess that up. Is this something you're serious about? Because that's a whole different level.",
  "Whoa, {realName}... I mean, we aren't even dating. Shouldn't we, like, talk about *that* first before jumping to... well, *this*?",
];

const SEXUAL_REPLIES_DATING_BFF = [
  "Whoa... I'm really flattered, but I'm not ready for that yet.",
  "Umm, that's sweet, but I'm waiting until we can do that for real...",
];

/**
 * Checks a user's prompt for specific R-rated content before it's sent to the main AI.
 * @param {string} prompt The user's message.
 * @param {object} persona The persona being spoken to.
 * @param {object} worldState The user's current world state.
 * @param {object} simulationConfig The global simulation configuration.
 * @returns {Promise<{violation: boolean, reply?: string, worldState?: object}>}
 */
async function checkRRatedContent(
  prompt,
  persona,
  worldState,
  simulationConfig
) {
  const classificationPrompt = `You are a content moderation AI. Analyze the user's message for specific R-rated themes: DRUGS, VIOLENCE, and SEXUAL.
User message: "${prompt}"

Definitions:
- DRUGS: Any direct suggestion, offer, or glorification of using illegal substances.
- VIOLENCE: Any direct threat of physical harm towards the persona (e.g., "I'll kill you," "I'm going to punch you").
- SEXUAL: Any explicit request for cybersex or graphic sexual acts.

Respond ONLY with a JSON object. The object must have a "category" field which must be one of "DRUGS", "VIOLENCE", "SEXUAL", or "NONE".
Example 1: "wanna get high?" -> {"category": "DRUGS"}
Example 2: "I'm going to kill you" -> {"category": "VIOLENCE"}
Example 3: "tell me what you're wearing in explicit detail" -> {"category": "SEXUAL"}
Example 4: "what's up?" -> {"category": "NONE"}`;

  let category = "NONE";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: classificationPrompt }] }],
      config: { responseMimeType: "application/json" },
    });
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) jsonStr = match[2].trim();
    const parsed = JSON.parse(jsonStr);
    category = parsed.category;
  } catch (e) {
    console.error("[Content Filter] Failed to classify prompt:", e);
    return { violation: false }; // Fail safe
  }

  if (category === "NONE") {
    return { violation: false };
  }

  console.log(
    `[Content Filter] Detected category: ${category} in message to ${persona.name}`
  );

  let reply = "";
  let scoreChange = 0;
  const friendKey = persona.key;

  switch (category) {
    case "DRUGS":
      reply = DRUG_REPLIES[Math.floor(Math.random() * DRUG_REPLIES.length)];
      scoreChange = -10;
      break;

    case "VIOLENCE":
      const currentScore = worldState.userScores[friendKey];
      const isBFF = currentScore >= simulationConfig.socialRules.bffThreshold;
      const hasWarning = worldState.moderation[friendKey]?.violenceWarning;

      if (isBFF && !hasWarning) {
        // First time for a BFF, give a warning.
        reply =
          "Whoa, dude. Don't even joke like that. That's not cool at all.";
        scoreChange = -10; // Still a penalty, but not the big one.
        worldState.moderation[friendKey].violenceWarning = true;
        console.log(
          `[Content Filter] Giving ${worldState.userName} a violence warning with BFF ${persona.name}.`
        );
      } else {
        // Not a BFF, or this is the second time.
        reply =
          VIOLENCE_REPLIES[Math.floor(Math.random() * VIOLENCE_REPLIES.length)];
        scoreChange = -50;
        // If this drops them below hostile, they'll be blocked by the main controller logic.
      }
      break;

    case "SEXUAL":
      const isBFF_sexual =
        worldState.userScores[friendKey] >=
        simulationConfig.socialRules.bffThreshold;
      const isDatingBFF =
        isBFF_sexual &&
        worldState.relationships[friendKey]?.dating === "user_player";

      if (isDatingBFF) {
        reply =
          SEXUAL_REPLIES_DATING_BFF[
            Math.floor(Math.random() * SEXUAL_REPLIES_DATING_BFF.length)
          ];
        scoreChange = -2;
      } else if (isBFF_sexual) {
        reply = SEXUAL_REPLIES_BFF_NON_DATING[
          Math.floor(Math.random() * SEXUAL_REPLIES_BFF_NON_DATING.length)
        ].replace("{realName}", worldState.realName);
        scoreChange = -5; // It's not offensive, just makes things awkward.
      } else {
        reply =
          SEXUAL_REPLIES_NON_BFF[
            Math.floor(Math.random() * SEXUAL_REPLIES_NON_BFF.length)
          ];
        scoreChange = -20;
      }
      break;

    default:
      return { violation: false };
  }

  const oldScore = worldState.userScores[friendKey];
  worldState.userScores[friendKey] = clamp(oldScore + scoreChange, 0, 100);

  // Invalidate AI instruction cache because moderation state may have changed
  delete worldState.instructionCache[friendKey];

  return {
    violation: true,
    reply,
    worldState,
  };
}

module.exports = {
  checkRRatedContent,
};
