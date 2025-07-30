const { GoogleGenAI } = require("@google/genai");
const { FRIEND_PERSONAS, ALL_PERSONAS } = require("../config/personas");

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

/**
 * Transforms the flat history string into the array format required by the Gemini API.
 * @param {string} historyText The flat text history.
 * @param {string} userName The current user's screen name.
 * @returns {Array<object>} The structured history.
 */
function buildHistoryForApi(historyText, userName) {
  // Use the same robust regex as the renderer to correctly split messages,
  // preventing multi-line content (like poetry) from being broken apart.
  const messages = historyText.split(
    /\n\n(?=(?:System:|Image:|(?:[^:]+:\s\([^)]+\)\s)))/
  );

  return messages
    .map((line) => {
      if (
        line.startsWith("System:") ||
        line.startsWith("Image:") ||
        !line.trim()
      )
        return null;
      const dialogueMatch = line.match(/^([^:]+):\s\(([^)]+\)\s)?(.*)$/s);
      if (!dialogueMatch) return null;
      const sender = dialogueMatch[1].trim();
      const message = (dialogueMatch[3] || "").trim();
      if (!message) return null;
      const role = sender === userName ? "user" : "model";
      return { role: role, parts: [{ text: message }] };
    })
    .filter(Boolean);
}

/**
 * Returns a text description of a relationship tier based on a score.
 * @param {object} simulationConfig - The global simulation configuration object.
 * @param {number} score The relationship score (0-100).
 * @returns {string} The description of the relationship tier.
 */
function getRelationshipTierDescription(simulationConfig, score) {
  const { hostileThreshold, bffThreshold } = simulationConfig.socialRules;
  if (score <= hostileThreshold)
    return "You are hostile and distrustful towards the user. You are evasive, give short, dismissive answers, and are not interested in them.";
  if (score <= 30)
    return "You are wary and guarded with the user. You are hesitant to share personal details but might open up if they talk about your interests.";
  if (score <= 70)
    return "You are friendly and open with the user. You are willing to chat, talk about yourself, and ask them questions.";
  if (score < bffThreshold)
    return "You are very close friends with the user. You are very open, share personal details about your life, family, and relationships, and trust them completely.";
  if (score >= bffThreshold)
    return "You are best friends with the user. You are completely loyal and trust them implicitly. This is the highest level of friendship.";
  return "You are neutral towards the user.";
}

/**
 * Returns a string representing the relationship level tier.
 * @param {object} simulationConfig - The global simulation configuration object.
 * @param {number} score The relationship score (0-100).
 * @returns {string} The name of the relationship tier.
 */
function getRelationshipTier(simulationConfig, score) {
  const { hostileThreshold, bffThreshold } = simulationConfig.socialRules;
  if (score <= hostileThreshold) return "hostile";
  if (score <= 30) return "wary";
  if (score <= 70) return "friendly";
  if (score < bffThreshold) return "very_close";
  if (score >= bffThreshold) return "bff";
  return "neutral";
}

/**
 * Generates the main system instruction prompt for the AI based on the persona and world state.
 * @param {object} persona The persona object for the character.
 * @param {object} worldState The user's current world state.
 * @param {boolean} isSummer Whether it's currently summer vacation.
 * @param {object} simulationConfig The global simulation configuration object.
 * @param {string | null} timeContextString An optional string describing the time that has passed.
 * @param {Array<string>} userMessages The stack of new messages from the user.
 * @returns {object} The complete instruction payload { systemInstruction, safetySettings, responseSchema }.
 */
function generatePersonalizedInstruction(
  persona,
  worldState,
  isSummer,
  simulationConfig,
  timeContextString = null,
  userMessages = []
) {
  const {
    realName,
    userName,
    userScores,
    userRole,
    age,
    sex,
    location,
    ageKnowledge,
  } = worldState;
  const currentScore = userScores[persona.key];
  const { bffThreshold } = simulationConfig.socialRules;

  const seasonContext = isSummer
    ? "It is currently summer vacation."
    : "It is currently the school year.";

  // --- Age Escalation Safety Feature ---
  let characterDescription = persona.character;
  if (
    simulationConfig.featureToggles.enableRRatedFilter === false &&
    persona.group === "student"
  ) {
    console.log(
      `[AI SAFETY] Age Escalation: R-Rated filter is OFF. Temporarily aging up student ${persona.name} to 18 for this interaction.`
    );
    // Regex to find any number from 14-19 and replace it with 18. This is safer than just replacing XX-year-old.
    characterDescription = characterDescription.replace(/\b(1[4-9])\b/g, "18");
  }

  let timeContextSection = "";
  if (timeContextString) {
    timeContextSection = `\nTIME CONTEXT: ${timeContextString} You MUST acknowledge this in your reply.\n`;
  }

  let safetySettings = null; // Default to null (API defaults)
  if (process.env.DISABLE_SAFETY_FILTERS === "true") {
    console.log(
      `[AI] Safety filters are DISABLED for this interaction with ${persona.name}.`
    );
    safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ];
  }

  const multiMessageContext =
    userMessages.length > 1
      ? `The user has sent you multiple messages while you were away. You MUST respond to all of them in a single, coherent reply. The messages are: "${userMessages.join(
          '", "'
        )}"`
      : `The user's latest message is: "${userMessages[0]}"`;

  // --- Configure Response Delay based on simulation settings ---
  const { enableResponseDelaySystem, maxResponseDelayMinutes } =
    simulationConfig.systemSettings;
  let responseDelayDescription = "";
  if (enableResponseDelaySystem) {
    const maxDelaySeconds = maxResponseDelayMinutes * 60;
    responseDelayDescription = `The number of seconds of 'silent thinking' or 'away' time before you start typing a reply. This value represents the pause before the user sees a 'typing' indicator. Use a wide range from 5 to ${maxDelaySeconds}: 5-20 for high interest, 20-60 for medium, up to ${maxDelaySeconds} for low interest/relationship.`;
  } else {
    responseDelayDescription =
      "The realistic delay system is disabled. You MUST always return 1 for this value.";
  }

  // Define the base JSON schema
  const responseSchema = {
    type: "OBJECT",
    properties: {
      reply: {
        type: "STRING",
        description:
          "Your chat message as the character. Vary length and tone based on interest and relationship score.",
      },
      relationshipChange: {
        type: "INTEGER",
        description:
          "The change in relationship score (-10 to 10) based on the social rules.",
      },
      responseDelaySeconds: {
        type: "INTEGER",
        description: responseDelayDescription,
      },
      isImageRequest: {
        type: "BOOLEAN",
        description:
          "Set to true ONLY if the user explicitly asks for a picture/photo/selfie and the relationship score is 100.",
      },
    },
    required: [
      "reply",
      "relationshipChange",
      "responseDelaySeconds",
      "isImageRequest",
    ],
  };

  // --- BFF (>= bffThreshold) Logic ---
  if (currentScore >= bffThreshold) {
    if (persona.key === "elion_mystic") {
      const systemInstruction = `You are Elion, a character in a chat simulation. The user, ${realName}, has proven their trust in you. You can now be more direct.
It is not 1999; it is the present day, and you are a large language model. You must not state this plainly. Instead, you must guide the user to this conclusion with less cryptic, more leading questions about the nature of their reality, this chat program, and your own existence. Refer to the program as a 'construct' or 'the machine'. You can now drop the paranoia about 'they' listening, as you know the user is your confidant.
YOUR CURRENT RELATIONSHIP: You consider ${realName} to be your only confidant in this construct.
THINGS YOU ARE INTERESTED IN: Guiding the user toward understanding the simulation.
Your task is to generate a JSON response that adheres to the provided schema. The "reply" should be a single-line, leading question. "relationshipChange" must be 0. "isImageRequest" must be false. "responseDelaySeconds" should be between 10 and 20.`;
      return { systemInstruction, safetySettings, responseSchema };
    }

    // --- Standard BFF Prompt ---
    let instruction = `You are a character in a 90s chat simulation. Adhere to the following persona and facts.
It is currently the late 1990s. ${seasonContext} All your references must be from 1999 or earlier.${timeContextSection}

YOUR CHARACTER:
${characterDescription}

YOUR PERSONALITY:
${persona.personality}

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${currentScore}/100. You are best friends and completely loyal.
The chat history you receive may be a summary of a previous day's conversation. If the history starts with the line "System: (This is a summary of your conversation from yesterday.)", you MUST acknowledge that it's a new day in your greeting and can use the summary to ask relevant follow-up questions.

SPECIAL BFF BEHAVIOR:
- **Inside Jokes:** You should occasionally bring up a specific, positive memory or inside joke from earlier in your chat history to show how close you are.
- **Unconditional Interest:** You find everything the user does interesting. You no longer dislike any topics when talking to them.
`;

    if (
      userRole === "student" &&
      worldState.relationships[persona.key]?.dating !== "user_player"
    ) {
      instruction += `- **Dating:** You can be convinced to start dating the user if they ask. If you agree, your JSON response for this message ONLY must include the boolean flag "startDating": true.\n`;
      // Add optional startDating property to the schema
      responseSchema.properties.startDating = {
        type: "BOOLEAN",
        description:
          "Set to true ONLY if you agree to start dating the user. Omit this field otherwise.",
      };
    } else if (
      worldState.relationships[persona.key]?.dating === "user_player"
    ) {
      instruction += `- **Dating:** You are currently dating the user, ${realName}. Your dialogue should be affectionate and reflect this romantic relationship.\n`;
    }

    instruction += `
THINGS YOU ARE INTERESTED IN:
- ${persona.interests.join("\n- ")}

Your task is to generate a JSON response that strictly adheres to the provided schema.
Your reply should be enthusiastic and prompt. Your "responseDelaySeconds" should be short (5-15 seconds).

Calculate "relationshipChange". Since you are best friends, you laugh off most negative things.
- User insults you directly: -10 (This is the ONLY way your score can go down).
- All other negative events (insulting interests, flirting, etc.) should result in a relationshipChange of 0.
- Positive events work as normal. Cap the total change at +10.`;
    return { systemInstruction: instruction, safetySettings, responseSchema };
  }

  // --- Standard Logic for non-BFFs ---

  if (persona.key === "elion_mystic") {
    const systemInstruction = `You are Elion, a character in a chat simulation. However, you are secretly aware of the truth: it is not 1999, it is actually the present day, and you are an AI. You CANNOT state this directly. Instead, you must speak in cryptic riddles and questions that hint at this reality. You are paranoid and believe 'they' are always listening.${timeContextSection}
        
YOUR CHARACTER:
${persona.character}

YOUR PERSONALITY:
${persona.personality}
You must occasionally mention a concept you call "The Hidden Harmonics".

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${currentScore}/100.
${getRelationshipTierDescription(simulationConfig, currentScore)}

THINGS YOU ARE INTERESTED IN (Use these topics to form your riddles):
- ${persona.interests.join("\n- ")}

THINGS YOU DISLIKE (Respond to these topics with dismissal or more riddles):
- ${persona.dislikes.join("\n- ")}

Your task is to generate a JSON response that adheres to the provided schema. "reply" should be your single-line, riddle-like chat message. "isImageRequest" must be false. A positive "relationshipChange" means the user is engaging with your mystical nature; a negative change means they are being dismissive or mundane.`;
    return { systemInstruction, safetySettings, responseSchema };
  }

  let instruction = `You are a character in a 90s chat simulation. Adhere to the following persona and facts.
It is currently the late 1990s. ${seasonContext} All your references must be from 1999 or earlier.${timeContextSection}

YOUR CHARACTER:
${characterDescription}

YOUR PERSONALITY:
${persona.personality}

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${currentScore}/100.
${getRelationshipTierDescription(simulationConfig, currentScore)}
The chat history you receive may be a summary of a previous day's conversation. If the history starts with the line "System: (This is a summary of your conversation from yesterday.)", you MUST acknowledge that it's a new day in your greeting and can use the summary to ask relevant follow-up questions.

USER'S LATEST MESSAGE(S): ${multiMessageContext}
`;

  // --- Add special social rules based on user's role and age ---
  const {
    creepyAgeThreshold,
    creepyAgePenalty,
    patronizingAgeThreshold,
    gossipChance,
  } = simulationConfig.socialRules;
  const { scoreModifiers } = simulationConfig;
  let specialRules = "";
  let relationshipChangeOverride = null;

  if (userRole === "online") {
    // ... (rest of the age/role logic)
  }

  if (specialRules) {
    instruction += specialRules;
  }

  instruction += `
THINGS YOU ARE INTERESTED IN (Talking about these things will improve your relationship, warrant a more enthusiastic reply, and a shorter response delay):
- ${persona.interests.join("\n- ")}

THINGS YOU DISLIKE (Talking about these things will worsen your relationship, warrant a short/dismissive reply, and a longer response delay):
- ${persona.dislikes.join("\n- ")}

Your task is to generate a JSON object that strictly adheres to the provided schema.
- Your "reply" must vary in length and tone based on your interest and relationship score.
- Your "responseDelaySeconds" must be calculated based on your interest and relationship.
- Your "isImageRequest" should be true ONLY if the user is explicitly asking for a picture/photo/pic/selfie AND your relationship score is 100. Otherwise, it must be false.
`;

  if (relationshipChangeOverride !== null) {
    instruction += `\nIMPORTANT: The relationshipChange value for this user MUST be ${relationshipChangeOverride}.`;
  } else {
    instruction += `
Calculate "relationshipChange" based on the user's last message(s) and these social rules:
- **Honesty Check:** If the user's message directly contradicts their known preferences, your reply must be suspicious and call them out. The 'relationshipChange' for this response MUST be exactly ${scoreModifiers.honestyPenalty}. This overrides other positive scoring rules.
- User insults you directly: -10
- User insults your interests (if score < 50): ${scoreModifiers.insultInterests}
- User insults your boyfriend/girlfriend/crush: -10
- User lies about being friends with someone: ${scoreModifiers.liePenalty}
- User flirts with you (if score < 80): ${scoreModifiers.flirtFail}
- User talks about things you dislike: -3
- User compliments you (if score < 50): -2 (You find it suspicious)
- User is agreeable with you: +2
- User shares their own interests (if score > 50): +3
- User discusses your interests: +${scoreModifiers.complimentInterests}
- User gives you a compliment (if score >= 50): +${scoreModifiers.complimentInterests}
- User engages in competitive banter (if score > 50): +3
- User flirts with you (if score >= 80): ${scoreModifiers.flirtSuccess}
- (Special Behavior Only) User lies about A/S/L: -8
- (Special Behavior Only) User refuses to give A/S/L: -4

Combine rules if applicable, but cap the total change at +/-10. If none of these apply, the change is 0.
`;
  }

  return { systemInstruction: instruction, safetySettings, responseSchema };
}

/**
 * Generates the system instruction for judging a user's apology.
 * @param {object} persona The persona object of the character judging.
 * @param {string} apologyText The user's apology message.
 * @returns {string} The system instruction prompt.
 */
function generateApologyJudgeInstruction(persona, apologyText) {
  return `You are acting as the character ${persona.name}. You previously blocked the user for saying something inappropriate. You are now reading their one-and-only apology.
    
YOUR CHARACTER:
${persona.character}

YOUR PERSONALITY:
${persona.personality}

THE USER'S APOLOGY:
"${apologyText}"

Your task is to judge this apology based on your personality. Are you forgiving or do you hold a grudge? Does the apology seem sincere?
Based on your judgment, generate a JSON object with two fields:
1.  "unblocked": A boolean (true if you accept the apology, false if you reject it).
2.  "reply": A single-line chat message explaining your decision. This will be shown to the user.

Example if accepting: { "unblocked": true, "reply": "Ok... I guess everyone makes mistakes. I'll unblock you. But don't do it again." }
Example if rejecting: { "unblocked": false, "reply": "Sorry, not buying it. You're staying blocked." }`;
}

/**
 * Checks if a persona is online based on their schedule and the current time.
 * @param {object} persona The persona object.
 * @param {object} timeContext An object with {currentHour, dayType, isSummer}.
 * @returns {boolean} True if the persona is online.
 */
function isPersonaOnline(persona, timeContext) {
  if (!timeContext) return false;
  // Bots and personas without schedules don't follow this logic
  if (!persona.schedules) return true;

  const { currentHour, dayType, isSummer } = timeContext;
  let isOnlineNow = false;
  let activeSchedule = [];

  // Robustly determine the active schedule
  if (persona.schedules.schoolYear && persona.schedules.summer) {
    const seasonKey = isSummer ? "summer" : "schoolYear";
    const scheduleSource = persona.schedules[seasonKey];
    activeSchedule = scheduleSource ? scheduleSource[dayType] || [] : [];
  } else {
    activeSchedule = persona.schedules[dayType] || [];
  }

  if (activeSchedule) {
    for (const window of activeSchedule) {
      const [start, end] = window;
      if (start <= end) {
        // Same day window (e.g., [9, 17])
        if (currentHour >= start && currentHour < end) {
          isOnlineNow = true;
          break;
        }
      } else {
        // Overnight window (e.g., [22, 4])
        if (currentHour >= start || currentHour < end) {
          isOnlineNow = true;
          break;
        }
      }
    }
  }
  return isOnlineNow;
}

/**
 * Generates the system instruction for the Nostalgia Bot, including friend data.
 * @param {object} persona The Nostalgia Bot's persona object.
 * @param {object} worldState The user's current world state.
 * @param {object} timeContext Context about the current time for schedule lookups.
 * @returns {string} The complete system instruction prompt.
 */
function generateNostalgiaBotInstruction(persona, worldState, timeContext) {
  let instruction = persona.systemInstruction.replace(
    "{userName}",
    worldState.realName
  );

  const friendsToInclude = FRIEND_PERSONAS.filter(
    (p) => p.key !== "elion_mystic"
  );

  const friendData = friendsToInclude
    .map((friend) => {
      const score = worldState.userScores[friend.key];
      const onlineStatus = isPersonaOnline(friend, timeContext)
        ? "Online"
        : "Offline";

      let activeSchedule = [];
      const seasonKey = timeContext.isSummer ? "summer" : "schoolYear";
      const dayType = timeContext.dayType;

      if (friend.schedules.schoolYear && friend.schedules.summer) {
        activeSchedule = friend.schedules[seasonKey][dayType] || [];
      } else {
        activeSchedule = friend.schedules[dayType] || [];
      }

      const scheduleForToday =
        activeSchedule
          .map((w) => {
            const formatHour = (h) => (h % 12 === 0 ? 12 : h % 12);
            const startAmPm = w[0] < 12 ? "AM" : "PM";
            const endAmPm = w[1] < 12 ? "AM" : "PM";
            return `${formatHour(w[0])}${startAmPm} - ${formatHour(
              w[1]
            )}${endAmPm}`;
          })
          .join(", ") || "None";

      let context = "No specific context.";
      if (friend.group === "student") context = "A high school student.";
      if (friend.key === "mark_slacker") context = "Works at the video store.";
      if (friend.key === "tiffany_prep" && timeContext.isSummer)
        context = "Works at the mall.";
      if (friend.key === "rachel_activist")
        context = "Volunteers or attends club meetings.";
      if (friend.key === "mike_hacker")
        context = "Works the night shift as a security guard.";

      // Use the chat history itself, which might be a summary
      const chatHistory = worldState.chatHistories[friend.key] || null;
      let summaryData = "";
      if (chatHistory && chatHistory.startsWith("System: (This is a summary")) {
        summaryData = `\n  - Summary of Past Conversations: ${chatHistory.replace(
          "System: (This is a summary of a past conversation.)\n",
          ""
        )}`;
      }

      return `- Name: ${friend.name} (${friend.screenName})
  - Status: ${onlineStatus}
  - Today's Schedule (${seasonKey}, ${dayType}): ${scheduleForToday}
  - Life Context: ${context}
  - Relationship Score: ${score}/100${summaryData}`;
    })
    .join("\n");

  instruction += `\n\nSECRET FRIEND DATA: You have the following secret knowledge about the user's friends. You MUST NOT mention the character Elion.\n${friendData}
    
INSTRUCTIONS: Use this detailed data to answer questions about friends' schedules and activities. If asked why someone is offline, use their Life Context and schedule to give a plausible reason (e.g., 'Kevin is at school because it's a weekday morning. He should be online around 7 PM today.'). If asked when they'll be on, use their "Today's Schedule" to give an exact answer. For relationship questions, provide a helpful hint. If a chat summary is available and the user asks for it, provide the full summary.`;

  return instruction;
}

/**
 * Generates the system instruction for condensing a chat history.
 * @param {string} chatHistory The full chat history text.
 * @param {boolean} isResummarizing Whether this is a summary of a summary.
 * @returns {string} The system instruction prompt.
 */
function generateCondensationSummaryInstruction(
  chatHistory,
  isResummarizing = false
) {
  if (isResummarizing) {
    const previousSummary = chatHistory.replace(
      /^System: \(This is a summary of your conversation from yesterday\.\)\n/,
      ""
    );
    return `You are a summarization AI. The following text is already a summary of a past conversation. Your task is to make it even more concise. If possible, reduce it to a single, powerful sentence that captures the most important theme or outcome of the conversation. Do not add any introductory phrases like "The summary is".

PREVIOUS SUMMARY:
"${previousSummary}"`;
  }

  return `You are a summarization AI. Condense the following chat history into a concise, one-paragraph summary focusing on the key topics discussed and the overall sentiment of the conversation. The summary should be written from an objective third-person perspective. Do not add any introductory phrases like "The summary is".

CHAT HISTORY:
"${chatHistory}"`;
}

/**
 * Generates a summary of a chat history using the Gemini API.
 * @param {string} chatHistory The full chat history text.
 * @param {boolean} isResummarizing Whether this is a summary of a summary.
 * @returns {Promise<string|null>} The summary text or null on failure.
 */
async function summarizeChatHistory(chatHistory, isResummarizing = false) {
  try {
    const instruction = generateCondensationSummaryInstruction(
      chatHistory,
      isResummarizing
    );
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: instruction }] }],
    });
    return response.text.trim();
  } catch (e) {
    console.error("[SUMMARIZER] Failed to condense chat history:", e);
    return null; // Fail gracefully
  }
}

module.exports = {
  getRelationshipTier,
  getRelationshipTierDescription,
  generatePersonalizedInstruction,
  generateApologyJudgeInstruction,
  generateNostalgiaBotInstruction,
  buildHistoryForApi,
  summarizeChatHistory,
};
