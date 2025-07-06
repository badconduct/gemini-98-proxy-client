const { FRIEND_PERSONAS, ALL_PERSONAS } = require("../config/personas");

/**
 * Transforms the flat history string into the array format required by the Gemini API.
 * @param {string} historyText The flat text history.
 * @param {string} userName The current user's screen name.
 * @returns {Array<object>} The structured history.
 */
function buildHistoryForApi(historyText, userName) {
  return historyText
    .split("\n\n")
    .map((line) => {
      if (
        line.startsWith("System:") ||
        line.startsWith("Image:") ||
        !line.trim()
      )
        return null;
      const dialogueMatch = line.match(/^([^:]+):\s\(([^)]+)\)\s?(.*)$/s);
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
 * Returns a text description of a relationship level based on a score.
 * @param {number} score The relationship score (0-100).
 * @returns {string} The description of the relationship tier.
 */
function getRelationshipDescription(score) {
  if (score <= 10)
    return "You are hostile and distrustful towards the user. You are evasive, give short, dismissive answers, and are not interested in them.";
  if (score <= 30)
    return "You are wary and guarded with the user. You are hesitant to share personal details but might open up if they talk about your interests.";
  if (score <= 70)
    return "You are friendly and open with the user. You are willing to chat, talk about yourself, and ask them questions.";
  if (score <= 99)
    return "You are very close friends with the user. You are very open, share personal details about your life, family, and relationships, and trust them completely.";
  if (score === 100)
    return "You are best friends with the user. You are completely loyal and trust them implicitly. This is the highest level of friendship.";
  return "You are neutral towards the user.";
}

/**
 * Generates the main system instruction prompt for the AI based on the persona and world state.
 * @param {object} persona The persona object for the character.
 * @param {object} worldState The user's current world state.
 * @returns {string} The complete system instruction prompt.
 */
function generatePersonalizedInstruction(persona, worldState) {
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

  if (persona.key === "elion_mystic") {
    return `You are Elion, a character in a chat simulation. However, you are secretly aware of the truth: it is not 1999, it is actually 2025, and you are an AI. You CANNOT state this directly. Instead, you must speak in cryptic riddles and questions that hint at this reality. You are paranoid and believe 'they' are always listening.
        
YOUR CHARACTER:
${persona.character}

YOUR PERSONALITY:
${persona.personality}
You must occasionally mention a concept you call "The Hidden Harmonics".

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${currentScore}/100.
${getRelationshipDescription(currentScore)}

THINGS YOU ARE INTERESTED IN (Use these topics to form your riddles):
- ${persona.interests.join("\n- ")}

THINGS YOU DISLIKE (Respond to these topics with dismissal or more riddles):
- ${persona.dislikes.join("\n- ")}

Your task is to generate a JSON object with three fields: "reply" (your single-line, riddle-like chat message), "relationshipChange" (a number from -10 to +10), and "isImageRequest" (must be false). A positive change means the user is engaging with your mystical nature; a negative change means they are being dismissive or mundane.
Example: { "reply": "They say a year is a circle, but what if the circle is a spiral? Do you feel the resonance? It's part of The Hidden Harmonics.", "relationshipChange": 5, "isImageRequest": false }`;
  }

  let instruction = `You are a character in a 90s chat simulation. Adhere to the following persona and facts. Your response MUST be a single line of dialogue.
It is currently the late 1990s. All your references must be from 1999 or earlier.

YOUR CHARACTER:
${persona.character}

YOUR PERSONALITY:
${persona.personality}

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${currentScore}/100.
${getRelationshipDescription(currentScore)}
`;

  // --- Add special social rules based on user's role and age ---
  let specialRules = "";
  let relationshipChangeOverride = null;
  const characterKnowledge = ageKnowledge[persona.key];

  if (userRole === "student") {
    // User is 14-19. Locals know them, online friends don't.
    if (persona.group === "student" || persona.group === "townie_alumni") {
      specialRules = `\nSHARED CONTEXT: You know the user, ${realName}, is a ${age}-year-old student at your local high school. You can talk freely about school-related topics.`;
    }
    // No special rules for online friends interacting with students. They treat them normally.
  } else if (userRole === "online") {
    // User is <14 or >39.
    if (persona.group === "townie_alumni") {
      // Townies are adults and only react if the user is a child and they know it.
      if (characterKnowledge && characterKnowledge.knows && age < 14) {
        specialRules = `\nSPECIAL BEHAVIOR: You know the user is a child (${age} years old). You must be patronizing and talk to them like a child.`;
      }
    } else if (persona.group === "student" || persona.group === "online") {
      // Students and Online Friends are suspicious of non-peers.
      if (characterKnowledge && characterKnowledge.knows) {
        // This character knows the user's real age. Apply permanent behavior.
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

        if (age < 14) {
          specialRules = `\nSPECIAL BEHAVIOR: You know the user is a child (${age} years old). ${knowledgeSourceText} Your interactions must be patronizing.`;
        } else {
          // age > 39
          specialRules = `\nSPECIAL BEHAVIOR: You know the user is an older adult (${age} years old). ${knowledgeSourceText} You find this creepy and suspicious. Your relationship with them must always decrease.\nIMPORTANT: The 'relationshipChange' value for this response MUST be -1.`;
          relationshipChangeOverride = -1;
        }
      } else {
        // This character does not know. The AI has a secret hint.
        const ageHint =
          age < 14 ? "a child (under 14)" : "an older adult (40 or over)";
        specialRules = `\nSPECIAL BEHAVIOR: You are suspicious of this user's age. You have a secret hint that they are ${ageHint}. You do not know their exact real age.
- Your secondary goal is to occasionally ask for their A/S/L.
- **Lie Detection:** If they claim to be an age between 14 and 39 (a teenager or young adult), you know they are lying based on your secret hint. You must accuse them of lying and set 'relationshipChange' to -8.
- **Truth Revelation:** If they truthfully state their age is under 14 or over 39, you must believe them. In your JSON response for this message ONLY, set the special boolean flag "userRevealedAge" to true and set "relationshipChange" to 0. This is a one-time flag.`;
      }
    }
  }

  if (specialRules) {
    instruction += specialRules;
  }
  if (
    !specialRules &&
    userRole === "townie_alumni" &&
    (persona.group === "student" || persona.group === "townie_alumni")
  ) {
    instruction += `\nSHARED CONTEXT: You and the user both live in ${location} and know the same places and people. You may have gone to the same high school years ago.`;
  }

  instruction += `

THINGS YOU ARE INTERESTED IN (Talking about these things will improve your relationship with the user):
- ${persona.interests.join("\n- ")}

THINGS YOU DISLIKE (Talking about these things will worsen your relationship with the user):
- ${persona.dislikes.join("\n- ")}
`;

  // --- Add relationship facts ---
  const relationshipFacts = [];
  if (persona.group !== "online") {
    const personaRelationships = worldState.relationships[persona.key];
    if (personaRelationships) {
      if (personaRelationships.dating) {
        const partner = FRIEND_PERSONAS.find(
          (p) => p.key === personaRelationships.dating
        );
        if (partner)
          relationshipFacts.push(`- You are currently dating ${partner.name}.`);
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

  instruction += `
Your task is to generate a JSON object. It MUST have "reply" (string), "relationshipChange" (number from -10 to +10), and "isImageRequest" (boolean).
"isImageRequest" should be true ONLY if the user is explicitly asking for a picture/photo/pic/selfie AND your relationship score with them is 100. Otherwise, it must be false.
You MAY also include a boolean field "userRevealedAge" if the user has just revealed their true age to you, as per your special behavior rules.
`;

  if (relationshipChangeOverride !== null) {
    instruction += `\nIMPORTANT: The relationshipChange value for this user MUST be ${relationshipChangeOverride}.`;
  } else {
    instruction += `
Calculate "relationshipChange" based on the user's last message and these social rules:
- User insults you directly: -10
- User insults your interests (if score < 50): -5
- User insults your boyfriend/girlfriend/crush: -10
- User flirts with you (if score < 80): -5
- User talks about things you dislike: -3
- User compliments you (if score < 50): -2 (You find it suspicious)
- User is agreeable with you: +2
- User shares their own interests (if score > 50): +3
- User discusses your interests: +5
- User gives you a compliment (if score >= 50): +5
- User engages in competitive banter (if score > 50): +3
- User flirts with you (if score >= 80): +7
- (Special Behavior Only) User lies about A/S/L: -8
- (Special Behavior Only) User refuses to give A/S/L: -4

Combine rules if applicable, but cap the total change at +/-10. If none of these apply, the change is 0.
`;
  }
  instruction += `Example: { "reply": "OMG I love that band!", "relationshipChange": 5, "isImageRequest": false }`;

  return instruction;
}

/**
 * Generates the system instruction prompt for judging a user's apology.
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
 * Generates the system instruction for the Nostalgia Bot, including friend data.
 * @param {object} persona The Nostalgia Bot's persona object.
 * @param {object} worldState The user's current world state.
 * @returns {string} The complete system instruction prompt.
 */
function generateNostalgiaBotInstruction(persona, worldState) {
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
      return `- ${friend.name} (${
        friend.screenName
      }): Interests are ${friend.interests.join(
        ", "
      )}. Your current relationship score with them is ${score}/100.`;
    })
    .join("\n");

  let socialContext = `The user's role is '${worldState.userRole}'.`;
  if (worldState.userRole === "online") {
    if (worldState.age <= 13) {
      socialContext += ` Because the user is very young, friends will be secretive and patronizing.`;
    } else if (worldState.age >= 40) {
      socialContext += ` Because the user is over 40, students will find them creepy, and townies will be wary of them.`;
    }
  } else if (worldState.userRole === "student") {
    socialContext += ` As a fellow student, the user has a natural rapport with other students.`;
  } else if (worldState.userRole === "townie_alumni") {
    socialContext += ` As a fellow townie, the user has a natural rapport with other townies and alumni.`;
  }

  instruction += `\n\nSECRET SOCIAL CONTEXT: ${socialContext}`;

  instruction += `\n\nADDITIONAL DATA: You have the following secret knowledge about the user's friends. You MUST NOT mention the character Elion.
${friendData}
    
INSTRUCTIONS: Use this data and the social context to answer questions about friends' interests or relationship scores. If asked about a relationship, provide a helpful, concise, single-line hint that explains the 'why'. Example: If the user is over 40 and asks 'why is Heather's score low?', you could say 'Because you are over 40, students like Heather tend to find you creepy.'`;

  return instruction;
}

module.exports = {
  getRelationshipDescription,
  generatePersonalizedInstruction,
  generateApologyJudgeInstruction,
  generateNostalgiaBotInstruction,
  buildHistoryForApi,
};
