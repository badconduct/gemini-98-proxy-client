const { FRIEND_PERSONAS, ALL_PERSONAS } = require("../config/personas");

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
  const { realName, userName, userScores, userRole, age, sex, location } =
    worldState;
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
  // --- Add shared social context based on user's role ---
  if (userRole === "student" && persona.group === "student") {
    instruction += `\nSHARED CONTEXT: You and the user both attend the same high school in ${location}. You have many mutual acquaintances and a shared history. You are very open to gossiping about other students.`;
  } else if (
    userRole === "townie_alumni" &&
    persona.group === "townie_alumni"
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

  // --- Add special rules for 'online' users ---
  let specialRules = "";
  let relationshipChangeOverride = null;

  if (userRole === "online") {
    if (age <= 13) {
      specialRules = `
SPECIAL BEHAVIOR: The user you are talking to is a child (${age} years old). You must be patronizing and talk to them like a child. DO NOT reveal any personal details about yourself or other friends. DO NOT ask them personal questions. If they claim to be older, accuse them of lying. Their real A/S/L is ${age}/${sex}/${location}.
`;
    } else if (age >= 40) {
      if (persona.group === "student") {
        specialRules = `
SPECIAL BEHAVIOR: The user you are talking to is much older than you (${age} years old). As a high school student, you find this creepy and suspicious. You must be guarded and uncomfortable. If they claim to be younger, accuse them of lying. Their real A/S/L is ${age}/${sex}/${location}.
NO MATTER WHAT THE USER SAYS, your relationship with them must always decrease. The 'relationshipChange' value must be -1.
`;
        relationshipChangeOverride = -1;
      } else if (persona.group === "townie_alumni") {
        specialRules = `
SPECIAL BEHAVIOR: The user you are talking to is much older than you (${age} years old). As an adult yourself, you don't find this 'creepy', but you are wary and see them as out of touch with your generation. Be a bit dismissive. If they claim to be younger, you should be suspicious and can accuse them of lying. Their real A/S/L is ${age}/${sex}/${location}.
`;
      } else {
        // Online friends
        specialRules = `
SPECIAL BEHAVIOR: You do not know this user well. You are suspicious of their identity. Your primary goal is to find out their A/S/L (Age/Sex/Location). If they lie about their A/S/L, you must accuse them of lying. Their real A/S/L is ${age}/${sex}/${location}. If they refuse to answer, your relationship will decrease.
`;
      }
    } else {
      specialRules = `
SPECIAL BEHAVIOR: You do not know this user well. You are suspicious of their identity. Your primary goal is to find out their A/S/L (Age/Sex/Location). If they lie about their A/S/L, you must accuse them of lying. Their real A/S/L is ${age}/${sex}/${location}. If they refuse to answer, your relationship will decrease.
`;
    }
  }

  if (specialRules) {
    instruction += `\n${specialRules}`;
  }

  instruction += `
Your task is to generate a JSON object with three fields: "reply" (your single-line chat message), "relationshipChange" (a number from -10 to +10), and "isImageRequest" (a boolean).
"isImageRequest" should be true ONLY if the user is explicitly asking for a picture/photo/pic/selfie AND your relationship score with them is 100. Otherwise, it must be false.
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
- (Online Role Only) User lies about A/S/L: -8
- (Online Role Only) User refuses to give A/S/L: -4

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
};
