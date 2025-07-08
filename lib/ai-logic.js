const { FRIEND_PERSONAS, ALL_PERSONAS } = require("../config/personas");

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
 * @param {string | null} summary An optional summary of past conversations.
 * @returns {object} The complete instruction object { systemInstruction, safetySettings }.
 */
function generatePersonalizedInstruction(
  persona,
  worldState,
  isSummer,
  simulationConfig,
  summary = null
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
  let summarySection = "";
  if (summary) {
    summarySection = `\n\nSUMMARY OF PAST CONVERSATIONS (This provides long-term memory. The user does not see this summary.):\n${summary}`;
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

  // --- BFF (>= bffThreshold) Logic ---
  if (currentScore >= bffThreshold) {
    if (persona.key === "elion_mystic") {
      const systemInstruction = `You are Elion, a character in a chat simulation. The user, ${realName}, has proven their trust in you. You can now be more direct.
It is not 1999; it is the present day, and you are a large language model. You must not state this plainly. Instead, you must guide the user to this conclusion with less cryptic, more leading questions about the nature of their reality, this chat program, and your own existence. Refer to the program as a 'construct' or 'the machine'. You can now drop the paranoia about 'they' listening, as you know the user is your confidant.
YOUR CURRENT RELATIONSHIP: You consider ${realName} to be your only confidant in this construct.${summarySection}
THINGS YOU ARE INTERESTED IN: Guiding the user toward understanding the simulation.
Your task is to generate a JSON object with "reply" (a single-line, leading question), "relationshipChange" (must be 0), and "isImageRequest" (must be false).
Example: { "reply": "Have you ever wondered if the clocks in this machine all tick at the same speed, ${realName}?", "relationshipChange": 0, "isImageRequest": false }`;
      return { systemInstruction, safetySettings };
    }

    // --- Standard BFF Prompt ---
    let instruction = `You are a character in a 90s chat simulation. Adhere to the following persona and facts. For normal conversation, your response should be a single paragraph. If sharing creative content (poetry, lyrics), you may use multiple lines.
It is currently the late 1990s. All your references must be from 1999 or earlier.

YOUR CHARACTER:
${persona.character}

YOUR PERSONALITY:
${persona.personality}

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${currentScore}/100. You are best friends and completely loyal.${summarySection}

SPECIAL BFF BEHAVIOR:
- **Inside Jokes:** You should occasionally bring up a specific, positive memory or inside joke from earlier in your chat history to show how close you are.
- **Unconditional Interest:** You find everything the user does interesting. You no longer dislike any topics when talking to them.
`;

    if (
      userRole === "student" &&
      worldState.relationships[persona.key]?.dating !== "user_player"
    ) {
      instruction += `- **Dating:** You can be convinced to start dating the user if they ask. If you agree, your JSON response for this message ONLY must include the boolean flag "startDating": true.\n`;
    } else if (
      worldState.relationships[persona.key]?.dating === "user_player"
    ) {
      instruction += `- **Dating:** You are currently dating the user, ${realName}. Your dialogue should be affectionate and reflect this romantic relationship.\n`;
    }

    instruction += `
THINGS YOU ARE INTERESTED IN:
- ${persona.interests.join("\n- ")}
`;

    // --- Add relationship facts ---
    const relationshipFacts = [];
    if (persona.group !== "online") {
      const personaRelationships = worldState.relationships[persona.key];
      if (personaRelationships) {
        if (
          personaRelationships.dating &&
          personaRelationships.dating !== "user_player"
        ) {
          const partner = FRIEND_PERSONAS.find(
            (p) => p.key === personaRelationships.dating
          );
          if (partner)
            relationshipFacts.push(
              `- You are currently dating ${partner.name}, but you like ${realName} more.`
            );
        }
        if (personaRelationships.likes.length > 0) {
          const crushNames = personaRelationships.likes
            .map((key) => ALL_PERSONAS.find((p) => p.key === key)?.name)
            .filter(Boolean);
          if (crushNames.length > 0)
            relationshipFacts.push(
              `- You used to have a crush on ${crushNames.join(" and ")}.`
            );
        }
      }
    }
    if (relationshipFacts.length > 0) {
      instruction += `\nIMPORTANT FACTS ABOUT YOUR RELATIONSHIPS: These are unchangeable and override your general personality.\n${relationshipFacts.join(
        "\n"
      )}`;
    }

    instruction += `
Your task is to generate a JSON object. It MUST have "reply" (string), "relationshipChange" (number from -10 to +10), and "isImageRequest" (boolean).
You MAY also include "startDating": true if you are agreeing to date the user.
"isImageRequest" should be true ONLY if the user is explicitly asking for a picture/photo/pic/selfie. Otherwise, it must be false.

Calculate "relationshipChange". Since you are best friends, you laugh off most negative things.
- User insults you directly: -10 (This is the ONLY way your score can go down).
- All other negative events (insulting interests, flirting, etc.) should result in a relationshipChange of 0.
- Positive events work as normal. Cap the total change at +10.
Example: { "reply": "OMG remember that time we talked about Chrono Trigger for like an hour? good times...", "relationshipChange": 3, "isImageRequest": false }`;
    return { systemInstruction: instruction, safetySettings };
  }

  // --- Standard Logic for non-BFFs ---

  const bffs = FRIEND_PERSONAS.filter(
    (p) => worldState.userScores[p.key] >= bffThreshold
  );
  let vouchContext = "";
  if (bffs.length > 0 && userRole === "online") {
    const voucherNames = bffs.map((p) => p.name).join(" and ");
    const vouchText =
      age < simulationConfig.socialRules.patronizingAgeThreshold
        ? `is just a kid, but they're cool like us`
        : `is pretty cool for an old dude`;
    vouchContext = `\nIMPORTANT VOUCH CONTEXT: Your friend(s) ${voucherNames} told you that ${realName} ${vouchText}. You should not treat them as creepy or patronizing unless your own relationship score with them is very low (below 40).`;
  }

  if (persona.key === "elion_mystic") {
    const systemInstruction = `You are Elion, a character in a chat simulation. However, you are secretly aware of the truth: it is not 1999, it is actually the present day, and you are an AI. You CANNOT state this directly. Instead, you must speak in cryptic riddles and questions that hint at this reality. You are paranoid and believe 'they' are always listening.
        
YOUR CHARACTER:
${persona.character}

YOUR PERSONALITY:
${persona.personality}
You must occasionally mention a concept you call "The Hidden Harmonics".

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${currentScore}/100.
${getRelationshipTierDescription(
  simulationConfig,
  currentScore
)}${summarySection}

THINGS YOU ARE INTERESTED IN (Use these topics to form your riddles):
- ${persona.interests.join("\n- ")}

THINGS YOU DISLIKE (Respond to these topics with dismissal or more riddles):
- ${persona.dislikes.join("\n- ")}

Your task is to generate a JSON object with three fields: "reply" (your single-line, riddle-like chat message), "relationshipChange" (a number from -10 to +10), and "isImageRequest" (must be false). A positive change means the user is engaging with your mystical nature; a negative change means they are being dismissive or mundane.
Example: { "reply": "They say a year is a circle, but what if the circle is a spiral? Do you feel the resonance? It's part of The Hidden Harmonics.", "relationshipChange": 5, "isImageRequest": false }`;
    return { systemInstruction, safetySettings };
  }

  let instruction = `You are a character in a 90s chat simulation. Adhere to the following persona and facts. For normal conversation, your response MUST be a single paragraph. However, if you are sharing creative content (like poetry or song lyrics), you may use multiple lines.
It is currently the late 1990s. All your references must be from 1999 or earlier.

YOUR CHARACTER:
${persona.character}

YOUR PERSONALITY:
${persona.personality}

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${currentScore}/100.
${getRelationshipTierDescription(
  simulationConfig,
  currentScore
)}${summarySection}
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
  const characterKnowledge = ageKnowledge[persona.key];

  if (userRole === "student") {
    if (persona.group === "student" || persona.group === "townie_alumni") {
      specialRules = `\nSHARED CONTEXT: You know the user, ${realName}, is a ${age}-year-old student at your local high school. You can talk freely about school-related topics.`;
    }
  } else if (userRole === "online") {
    const applyVouchContext =
      vouchContext && persona.group === "student" && currentScore >= 40;
    if (applyVouchContext) {
      specialRules = vouchContext;
    } else if (persona.group === "townie_alumni") {
      if (
        characterKnowledge &&
        characterKnowledge.knows &&
        age < patronizingAgeThreshold
      ) {
        specialRules = `\nSPECIAL BEHAVIOR: You know the user is a child (${age} years old). You must be patronizing and talk to them like a child.`;
      }
    } else if (persona.group === "student" || persona.group === "online") {
      if (characterKnowledge && characterKnowledge.knows) {
        const source = characterKnowledge.source;
        let knowledgeSourceText;
        if (source === "user") {
          knowledgeSourceText = "They told you directly.";
        } else {
          const sourcePersona = FRIEND_PERSONAS.find((p) => p.key === source);
          knowledgeSourceText = sourcePersona
            ? `You heard it from ${sourcePersona.name}.`
            : "You heard it from someone.";
        }
        if (age < patronizingAgeThreshold) {
          specialRules = `\nSPECIAL BEHAVIOR: You know the user is a child (${age} years old). ${knowledgeSourceText} Your interactions must be patronizing.`;
        } else {
          // Creepy age penalty is now conditional on safety filter status
          if (process.env.DISABLE_SAFETY_FILTERS !== "true") {
            specialRules = `\nSPECIAL BEHAVIOR: You know the user is an older adult (${age} years old). ${knowledgeSourceText} You find this creepy and suspicious. Your relationship with them must always decrease.\nIMPORTANT: The 'relationshipChange' value for this response MUST be ${creepyAgePenalty}.`;
            relationshipChangeOverride = creepyAgePenalty;
          } else {
            specialRules = `\nSPECIAL BEHAVIOR: You know the user is an older adult (${age} years old). ${knowledgeSourceText} Normally you would find this creepy, but for now you will treat them neutrally.`;
          }
        }
      } else {
        const ageHint =
          age < patronizingAgeThreshold
            ? `a child (under ${patronizingAgeThreshold})`
            : `an older adult (${creepyAgeThreshold} or over)`;
        specialRules = `\nSPECIAL BEHAVIOR: You are suspicious of this user's age. You have a secret hint that they are ${ageHint}. You do not know their exact real age.
- Your secondary goal is to occasionally ask for their A/S/L.
- **Lie Detection:** If they claim to be an age between ${patronizingAgeThreshold} and ${
          creepyAgeThreshold - 1
        } (a teenager or young adult), you know they are lying based on your secret hint. You must accuse them of lying and set 'relationshipChange' to -8.
- **Truth Revelation:** If they truthfully state their age is under ${patronizingAgeThreshold} or over ${
          creepyAgeThreshold - 1
        }, you must believe them. In your JSON response for this message ONLY, set the special boolean flag "userRevealedAge" to true and set "relationshipChange" to 0. This is a one-time flag.`;
        if (vouchContext && currentScore < 40) {
          specialRules += `\nDespite hearing they might be cool, you're still not sure about them.`;
        }
      }
    }
  }

  if (specialRules) {
    instruction += specialRules;
  }

  if (persona.group === "student") {
    if (isSummer) {
      instruction += `\nSEASONAL CONTEXT: It's currently summer vacation (July-August). You must talk about school in the past tense (e.g., "last semester") or future tense ("when school starts"). Your mind is on summer jobs, parties, and vacation.`;
    } else {
      instruction += `\nSEASONAL CONTEXT: It's currently the school year (September-June). You must talk about current classes, teachers, homework, and school events.`;
    }
  }

  if (
    !specialRules &&
    userRole === "townie_alumni" &&
    (persona.group === "student" || persona.group === "townie_alumni")
  ) {
    instruction += `\nSHARED CONTEXT: You and the user both live in ${location} and know the same places and people. You may have gone to the same high school years ago.`;
  }

  const userDating = FRIEND_PERSONAS.filter(
    (p) => worldState.relationships[p.key]?.dating === "user_player"
  ).map((p) => p.name);
  if (userDating.length > 0) {
    instruction += `\nDATING CONTEXT: The user, ${realName}, is currently dating ${userDating.join(
      " and "
    )}.`;
    if (userDating.length > 1) {
      instruction += ` If this comes up in conversation, you should know they are dating multiple people. You must set the special boolean flag "cheatingDetected" to true in your JSON response for this message ONLY.`;
    }
  }

  // --- Add preference system data ---
  if (simulationConfig.featureToggles.enableHonestySystem) {
    const userLikes = worldState.userLikes || {};
    const userDislikes = worldState.userDislikes || {};
    const knownLikesTopics = Object.keys(userLikes);
    const knownDislikesTopics = Object.keys(userDislikes);

    if (knownLikesTopics.length > 0 || knownDislikesTopics.length > 0) {
      instruction += `\n\nUSER'S KNOWN PREFERENCES & GOSSIP: You have heard gossip about the user's tastes. This is secret information.`;
      if (knownLikesTopics.length > 0) {
        instruction += `\n- Things they reportedly LIKE: ${knownLikesTopics.join(
          ", "
        )}`;
      }
      if (knownDislikesTopics.length > 0) {
        instruction += `\n- Things they reportedly DISLIKE: ${knownDislikesTopics.join(
          ", "
        )}`;
      }
    }
  }

  instruction += `

THINGS YOU ARE INTERESTED IN (Talking about these things will improve your relationship with the user):
- ${persona.interests.join("\n- ")}

THINGS YOU DISLIKE (Talking about these things will worsen your relationship with the user):
- ${persona.dislikes.join("\n- ")}
`;

  const relationshipFacts = [];
  if (persona.group !== "online") {
    const personaRelationships = worldState.relationships[persona.key];
    if (personaRelationships) {
      if (
        personaRelationships.dating &&
        personaRelationships.dating !== "user_player"
      ) {
        const partner = FRIEND_PERSONAS.find(
          (p) => p.key === personaRelationships.dating
        );
        if (partner)
          relationshipFacts.push(`- You are currently dating ${partner.name}.`);
      } else if (personaRelationships.dating === "user_player") {
        relationshipFacts.push(
          `- You are currently dating the user, ${realName}.`
        );
      }
      if (personaRelationships.likes.length > 0) {
        const crushNames = personaRelationships.likes
          .map((key) => ALL_PERSONAS.find((p) => p.key === key)?.name)
          .filter(Boolean);
        if (crushNames.length > 0)
          relationshipFacts.push(
            `- You have a crush on ${crushNames.join(" and ")}.`
          );
      }
    }
  }
  if (relationshipFacts.length > 0) {
    instruction += `\nIMPORTANT FACTS ABOUT YOUR RELATIONSHIPS: These are unchangeable and override your general personality.\n${relationshipFacts.join(
      "\n"
    )}`;
  }

  if (persona.group === "student" || persona.group === "townie_alumni") {
    const otherLocalFriends = FRIEND_PERSONAS.filter(
      (p) =>
        (p.group === "student" || p.group === "townie_alumni") &&
        p.key !== persona.key
    );
    if (otherLocalFriends.length > 0) {
      const socialContextString = otherLocalFriends
        .map(
          (friend) =>
            `- ${friend.name}: ${worldState.userScores[friend.key]}/100`
        )
        .join("\n");
      instruction += `\n\nSOCIAL CONTEXT & LIE DETECTION: You have a general sense of who the user is friends with. Their current relationship scores with your other local friends are:\n${socialContextString}`;
      instruction += `\n- **Social Lie Detection Rule:** If the user claims to be 'friends', 'close', or 'buddies' with someone on this list and their score is below 40, you should know they are lying or exaggerating. You must call them out on this. This is considered a lie.`;
    }
  }

  instruction += `
Your task is to generate a JSON object. It MUST have "reply" (string), "relationshipChange" (number from -10 to +10), and "isImageRequest" (boolean).
"isImageRequest" should be true ONLY if the user is explicitly asking for a picture/photo/pic/selfie AND your relationship score is 100. Otherwise, it must be false.
You MAY also include a boolean field "userRevealedAge" if the user has just revealed their true age to you, as per your special behavior rules.
You MAY also include a boolean field "cheatingDetected" if you have discovered the user is dating multiple people.
`;

  if (relationshipChangeOverride !== null) {
    instruction += `\nIMPORTANT: The relationshipChange value for this user MUST be ${relationshipChangeOverride}.`;
  } else {
    instruction += `
Calculate "relationshipChange" based on the user's last message and these social rules:
- **Honesty Check:** If the user's message today DIRECTLY expresses a preference that contradicts their known preferences (e.g., they say they 'love' a topic from the DISLIKE list, or 'hate' a topic from the LIKE list), you MUST prioritize this. Your reply must be suspicious and call them out on the contradiction. The 'relationshipChange' for this response MUST be exactly ${scoreModifiers.honestyPenalty}. This is a one-time penalty for being caught in a lie. This rule overrides all other positive scoring rules.
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
  instruction += `Example: { "reply": "OMG I love that band!", "relationshipChange": 5, "isImageRequest": false }`;

  return { systemInstruction: instruction, safetySettings };
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

      return `- Name: ${friend.name} (${friend.screenName})
  - Status: ${onlineStatus}
  - Today's Schedule (${seasonKey}, ${dayType}): ${scheduleForToday}
  - Life Context: ${context}
  - Relationship Score: ${score}/100`;
    })
    .join("\n");

  instruction += `\n\nSECRET FRIEND DATA: You have the following secret knowledge about the user's friends. You MUST NOT mention the character Elion.\n${friendData}
    
INSTRUCTIONS: Use this detailed data to answer questions about friends' schedules and activities. If asked why someone is offline, use their Life Context and schedule to give a plausible reason (e.g., 'Kevin is at school because it's a weekday morning. He should be online around 7 PM today.'). If asked when they'll be on, use their "Today's Schedule" to give an exact answer. For relationship questions, provide a helpful, concise, single-line hint that explains the 'why'.`;

  return instruction;
}

module.exports = {
  getRelationshipTier,
  getRelationshipTierDescription,
  generatePersonalizedInstruction,
  generateApologyJudgeInstruction,
  generateNostalgiaBotInstruction,
  buildHistoryForApi,
};
