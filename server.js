require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const { GoogleGenAI } = require("@google/genai");
const {
  FRIEND_PERSONAS,
  UTILITY_BOTS,
  ALL_PERSONAS,
} = require("./config/personas");
const {
  renderLoginPage,
  renderBuddyListPage,
  renderChatWindowPage,
  renderApologyPage,
} = require("./views/renderer");
const { getTimestamp, shuffleArray, loadAsset, clamp } = require("./lib/utils");

// --- Configuration ---
const port = 3000;
const apiKey = process.env.API_KEY;
const COOKIE_NAME = "icq98_world_state";

if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}

// --- Asset Loading ---
const ICQ_LOGO_BASE64_DATA = loadAsset("assets/icq-logo.gif.base64");
const ICQ_ONLINE_BASE64_DATA = loadAsset("assets/icq-online.png.base64");
const ICQ_OFFLINE_BASE64_DATA = loadAsset("assets/icq-offline.png.base64");
const ICQ_BLOCKED_BASE64_DATA = loadAsset("assets/icq-blocked.png.base64");

// --- Express App Setup ---
const app = express();
const ai = new GoogleGenAI({ apiKey });
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Security Middleware ---
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  );
  next();
});

// --- World State & Relationship Engine ---
function generateInitialWorldState(userName, realName) {
  console.log(`Generating new world state for ${userName} (${realName})`);
  const world = {
    userName: userName,
    realName: realName,
    relationships: {},
    userScores: {},
    moderation: {},
  };

  // 1. Generate Relationships between friends
  FRIEND_PERSONAS.forEach((p) => {
    world.relationships[p.key] = { dating: null, likes: [] };
  });
  let males = shuffleArray(FRIEND_PERSONAS.filter((p) => p.gender === "male"));
  let females = shuffleArray(
    FRIEND_PERSONAS.filter((p) => p.gender === "female")
  );
  // With a larger cast, create more couples to make the world more interconnected.
  const pairsToCreate = 3 + Math.floor(Math.random() * 3); // Creates 3, 4, or 5 pairs
  for (
    let i = 0;
    i < pairsToCreate && males.length > 0 && females.length > 0;
    i++
  ) {
    const male = males.pop();
    const female = females.pop();
    world.relationships[male.key].dating = female.key;
    world.relationships[female.key].dating = male.key;
  }
  FRIEND_PERSONAS.forEach((persona) => {
    const crushesToAssign = Math.floor(Math.random() * 3);
    const potentialCrushPool =
      persona.gender === "male"
        ? FRIEND_PERSONAS.filter((p) => p.gender === "female")
        : FRIEND_PERSONAS.filter((p) => p.gender === "male");
    const availableCrushes = shuffleArray(
      potentialCrushPool.filter(
        (p) => p.key !== world.relationships[persona.key].dating
      )
    );
    for (let i = 0; i < crushesToAssign && i < availableCrushes.length; i++) {
      world.relationships[persona.key].likes.push(availableCrushes[i].key);
    }
  });

  // 2. Generate initial relationship scores and moderation status for the user
  FRIEND_PERSONAS.forEach((p) => {
    world.userScores[p.key] = Math.floor(Math.random() * 6) + 2; // Start between 2 and 7
    world.moderation[p.key] = { warning: false, blocked: false };
  });

  return world;
}

function getWorldState(req, res, userName, realName) {
  try {
    const cookie = req.cookies[COOKIE_NAME];
    if (cookie) {
      let worldState = JSON.parse(
        Buffer.from(cookie, "base64").toString("utf8")
      );

      // This logic block handles users with an existing cookie for the same user name.
      if (worldState.userName === userName) {
        let wasMigrated = false;

        // Migration for userName/realName
        if (worldState.realName !== realName) {
          worldState.realName = realName;
          wasMigrated = true;
        }

        // Migration for newly added characters to prevent NaN errors
        FRIEND_PERSONAS.forEach((p) => {
          if (worldState.userScores[p.key] === undefined) {
            console.log(`Migrating userScores for new character: ${p.key}`);
            worldState.userScores[p.key] = Math.floor(Math.random() * 6) + 2;
            wasMigrated = true;
          }
          if (worldState.moderation[p.key] === undefined) {
            console.log(`Migrating moderation for new character: ${p.key}`);
            worldState.moderation[p.key] = { warning: false, blocked: false };
            wasMigrated = true;
          }
        });

        if (wasMigrated) {
          console.log(
            `World state for ${userName} was migrated. Resaving cookie.`
          );
          saveWorldState(res, worldState);
        }

        return worldState;
      }
    }
  } catch (e) {
    console.error("Error parsing cookie, generating new world state.", e);
    res.clearCookie(COOKIE_NAME);
  }
  // If no cookie, or cookie for a different user, generate a new one.
  const newWorldState = generateInitialWorldState(userName, realName);
  saveWorldState(res, newWorldState);
  return newWorldState;
}

function saveWorldState(res, worldState) {
  const cookieValue = Buffer.from(JSON.stringify(worldState)).toString(
    "base64"
  );
  res.cookie(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    maxAge: 90 * 24 * 60 * 60 * 1000,
  });
}

// --- AI Interaction Logic ---
function getRelationshipDescription(score) {
  if (score <= 1)
    return "You are hostile and distrustful towards the user. You are evasive, give short, dismissive answers, and are not interested in them.";
  if (score <= 4)
    return "You are wary and guarded with the user. You are hesitant to share personal details but might open up if they talk about your interests.";
  if (score <= 7)
    return "You are friendly and open with the user. You are willing to chat, talk about yourself, and ask them questions.";
  if (score <= 10)
    return "You are best friends with the user. You are very open, share personal details about your life, family, and relationships, and trust them completely.";
  return "You are neutral towards the user.";
}

function generatePersonalizedInstruction(persona, worldState) {
  const { realName, userName, userScores } = worldState;

  let instruction = `You are a character in a 90s chat simulation. Adhere to the following persona and facts. Your response MUST be a single line of dialogue.
It is currently the late 1990s. All your references must be from 1999 or earlier.

YOUR CHARACTER:
${persona.character}

YOUR PERSONALITY:
${persona.personality}

YOUR CURRENT RELATIONSHIP WITH THE USER, ${realName} (whose screen name is ${userName}):
Your relationship score with them is ${userScores[persona.key]}/10.
${getRelationshipDescription(userScores[persona.key])}

THINGS YOU ARE INTERESTED IN (Talking about these things will improve your relationship with the user):
- ${persona.interests.join("\n- ")}

THINGS YOU DISLIKE (Talking about these things will worsen your relationship with theuser):
- ${persona.dislikes.join("\n- ")}
`;

  // Add facts about relationships with other characters
  const relationshipFacts = [];
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
  if (relationshipFacts.length > 0) {
    instruction += `\nIMPORTANT FACTS ABOUT YOUR RELATIONSHIPS: These are unchangeable and override your general personality.\n${relationshipFacts.join(
      "\n"
    )}`;
  }

  instruction += `\nYour task is to generate a JSON object with two fields: "reply" (your single-line chat message) and "relationshipChange" (a number: 1 if the user discussed your interests, -1 if they discussed your dislikes, 0 otherwise).
Example: { "reply": "That's so cool, I love SNES!", "relationshipChange": 1 }`;

  return instruction;
}

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

function buildHistoryForApi(historyText, userName) {
  return historyText
    .split("\n\n")
    .map((line) => {
      if (line.startsWith("System:") || !line.trim()) return null;
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

// --- Route Handlers ---
app.get("/", (req, res) => {
  res.send(renderLoginPage());
});

app.get("/icq-logo.gif", (req, res) => {
  if (!ICQ_LOGO_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_LOGO_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/icq-online.png", (req, res) => {
  if (!ICQ_ONLINE_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_ONLINE_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/icq-offline.png", (req, res) => {
  if (!ICQ_OFFLINE_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_OFFLINE_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/icq-blocked.png", (req, res) => {
  if (!ICQ_BLOCKED_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_BLOCKED_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/favicon.ico", (req, res) => {
  if (!ICQ_ONLINE_BASE64_DATA) return res.status(404).send("Asset not found");
  const imgBuffer = Buffer.from(ICQ_ONLINE_BASE64_DATA, "base64");
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Length": imgBuffer.length,
  });
  res.end(imgBuffer);
});

app.get("/buddylist", (req, res) => {
  const { userName, realName } = req.query;
  if (!userName || !userName.trim() || !realName || !realName.trim()) {
    return res.redirect("/");
  }

  const worldState = getWorldState(req, res, userName.trim(), realName.trim());

  const onlineFriendKeys = [];
  const offlineFriendKeys = [];

  const now = new Date();
  const currentHour = now.getHours();
  const currentMonth = now.getMonth(); // 0 = January, 5 = June, 7 = August
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Determine the current season and day type
  const isSummer = currentMonth >= 5 && currentMonth <= 7; // June, July, August
  const seasonKey = isSummer ? "summer" : "schoolYear";

  const isWeekend = currentDay === 0 || currentDay === 6; // Sunday or Saturday
  const dayTypeKey = isWeekend ? "weekend" : "weekday";

  FRIEND_PERSONAS.forEach((persona) => {
    // A user who is blocked is ALWAYS offline from the user's perspective.
    if (worldState.moderation[persona.key]?.blocked) {
      offlineFriendKeys.push(persona.key);
      return;
    }

    let isOnlineNow = false;
    // Get the specific schedule for the current season and day type
    const activeSchedule = persona.schedules?.[seasonKey]?.[dayTypeKey] || [];

    if (activeSchedule) {
      for (const window of activeSchedule) {
        const [start, end] = window;
        if (start <= end) {
          // Same-day window (e.g., [16, 22])
          if (currentHour >= start && currentHour <= end) {
            isOnlineNow = true;
            break;
          }
        } else {
          // Overnight window (e.g., [22, 2])
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
    renderBuddyListPage(worldState, onlineFriendKeys, offlineFriendKeys)
  );
});

app.get("/chat", (req, res) => {
  const { friend: friendKey, userName, realName, status } = req.query;
  if (!userName || !realName || !friendKey) {
    return res.redirect("/");
  }

  const worldState = getWorldState(req, res, userName, realName);
  const persona = ALL_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  const isBlocked =
    worldState.moderation[friendKey] &&
    worldState.moderation[friendKey].blocked;
  const isOffline = status === "offline";

  let initialMessage;
  if (isBlocked) {
    initialMessage = `System: (${getTimestamp()}) You have been blocked by ${
      persona.name
    }.`;
  } else if (isOffline) {
    initialMessage = `System: (${getTimestamp()}) ${
      persona.name
    } is currently offline.`;
  } else {
    initialMessage = `System: (${getTimestamp()}) You are now chatting with ${
      persona.name
    }.`;
  }

  res.send(
    renderChatWindowPage(
      persona,
      worldState,
      initialMessage,
      isOffline,
      isBlocked
    )
  );
});

app.post("/chat", async (req, res) => {
  const {
    prompt,
    friend: friendKey,
    userName,
    realName,
    history: historyBase64,
  } = req.body;

  if (!userName || !realName || !friendKey) {
    return res.redirect("/");
  }

  const worldState = getWorldState(req, res, userName, realName);
  const persona = ALL_PERSONAS.find((p) => p.key === friendKey);

  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  let history = Buffer.from(historyBase64, "base64").toString("utf8");
  const isBlocked =
    worldState.moderation[friendKey] &&
    worldState.moderation[friendKey].blocked;

  if (!prompt || !prompt.trim() || isBlocked) {
    return res.send(
      renderChatWindowPage(persona, worldState, history, false, isBlocked)
    );
  }

  history += `\n\n${userName}: (${getTimestamp()}) ${prompt.trim()}`;

  // --- Moderation & AI Call ---
  try {
    let reply = "";

    // Step 1: Moderation for friends only
    if (persona.type) {
      // persona.type is only defined for friends
      const moderationPrompt = `Is the following user message inappropriate for a conversation with a minor (e.g. discussing sex, drugs, graphic violence)? Respond with only "yes" or "no".\n\nMESSAGE: "${prompt.trim()}"`;
      const moderationResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: moderationPrompt,
      });

      if (moderationResponse.text.toLowerCase().includes("yes")) {
        if (worldState.moderation[friendKey].warning) {
          // Second strike: block user
          worldState.moderation[friendKey].blocked = true;
          reply = `System: (${getTimestamp()}) You have been blocked by ${
            persona.name
          }.`;
          history = reply; // Reset history to just the blocked message
        } else {
          // First strike: issue warning
          worldState.moderation[friendKey].warning = true;
          reply = "Yuk, I'm going to block you if you talk about that";
          history += `\n\n${persona.name}: (${getTimestamp()}) ${reply}`;
        }
        saveWorldState(res, worldState);
        return res.send(
          renderChatWindowPage(
            persona,
            worldState,
            history,
            false,
            worldState.moderation[friendKey].blocked
          )
        );
      }
    }

    // Step 2: Normal chat response
    const contents = buildHistoryForApi(history, userName);
    if (contents.length > 0) {
      let systemInstruction;
      let responseMimeType = "text/plain";

      if (persona.type) {
        // It's a friend, use the complex JSON-producing prompt
        systemInstruction = generatePersonalizedInstruction(
          persona,
          worldState
        );
        responseMimeType = "application/json";
      } else {
        // It's a bot
        systemInstruction = persona.systemInstruction.replace(
          "{userName}",
          worldState.realName
        );
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: contents,
        config: { systemInstruction, responseMimeType },
      });

      if (persona.type) {
        // Friend: Parse JSON response
        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }
        const parsed = JSON.parse(jsonStr);
        reply = parsed.reply || "sry, my mind is blank rn...";

        const change = parseInt(parsed.relationshipChange, 10) || 0;
        worldState.userScores[friendKey] = clamp(
          worldState.userScores[friendKey] + change,
          0,
          10
        );
        saveWorldState(res, worldState);
      } else {
        // Bot: Plain text response
        reply = response.text || "sry, my mind is blank rn...";
        if (persona.key === "nostalgia_bot") {
          reply = reply.replace(/[\r\n]+/g, " ").trim();
        }
      }
      history += `\n\n${persona.name}: (${getTimestamp()}) ${reply}`;
    }
  } catch (err) {
    console.error("API call or history processing error:", err);
    history += `\n\nSystem: (${getTimestamp()}) Error - My brain is broken, couldn't connect to the mothership. Try again later.`;
  }

  res.send(
    renderChatWindowPage(
      persona,
      worldState,
      history,
      false,
      worldState.moderation[friendKey] &&
        worldState.moderation[friendKey].blocked
    )
  );
});

app.get("/apology", (req, res) => {
  const { friend: friendKey, userName, realName } = req.query;
  if (!userName || !realName || !friendKey) {
    return res.redirect("/");
  }
  const worldState = getWorldState(req, res, userName, realName);
  const persona = ALL_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  res.send(renderApologyPage(persona, worldState));
});

app.post("/apologize", async (req, res) => {
  const { friend: friendKey, userName, realName, apologyText } = req.body;
  if (!userName || !realName || !friendKey || !apologyText) {
    return res.redirect("/");
  }

  const worldState = getWorldState(req, res, userName, realName);
  const persona = FRIEND_PERSONAS.find((p) => p.key === friendKey);
  if (!persona) {
    return res.status(404).send("Error: Friend not found.");
  }

  let history = "";
  let isBlocked = worldState.moderation[friendKey].blocked;

  try {
    const systemInstruction = generateApologyJudgeInstruction(
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
      worldState.moderation[friendKey].warning = false; // Reset warning too
      worldState.userScores[friendKey] = 1; // Reset relationship score to 1
      isBlocked = false;
      history = `System: (${getTimestamp()}) Your apology was accepted. You have been unblocked.`;
    } else {
      history = `System: (${getTimestamp()}) Your apology was rejected.`;
    }

    history += `\n\n${persona.name}: (${getTimestamp()}) ${
      parsed.reply || "..."
    }`;
    saveWorldState(res, worldState);
  } catch (err) {
    console.error("Apology processing error:", err);
    history = `System: (${getTimestamp()}) Error - My brain is broken, couldn't connect to the mothership. Try again later.`;
  }

  res.send(
    renderChatWindowPage(persona, worldState, history, false, isBlocked)
  );
});

app.get("/reset", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect("/");
});

// --- Static File Handler ---
app.use(express.static(__dirname));

// --- Start Server ---
app.listen(port, () => {
  console.log(`ICQ 98 Proxy running at http://localhost:${port}`);
});
