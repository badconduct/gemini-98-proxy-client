require("dotenv").config();
const express = require("express");
const { GoogleGenAI } = require("@google/genai");

// --- Configuration ---
const port = 3000;
const apiKey = process.env.API_KEY;

if (!apiKey) {
  throw new Error("API_KEY environment variable not set.");
}

// --- Express App Setup ---
const app = express();
const ai = new GoogleGenAI({ apiKey });

app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// --- Utilities ---
function escapeHtml(unsafe) {
  return unsafe
    ? unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    : "";
}

// --- HTML Renderer ---
function renderPage(history) {
  // Parse the history string into structured HTML
  const chatHistoryHtml = history
    .split("\n\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      if (line.startsWith("You: ")) {
        return `<div class="message message-user"><span class="sender">You:</span> ${escapeHtml(
          line.substring(5)
        )}</div>`;
      }
      if (line.startsWith("Gemini: ")) {
        return `<div class="message message-gemini"><span class="sender">Gemini:</span> ${escapeHtml(
          line.substring(8)
        )}</div>`;
      }
      if (line.startsWith("Error: ")) {
        return `<div class="message message-error"><span class="sender">Error:</span> ${escapeHtml(
          line.substring(7)
        )}</div>`;
      }
      // This is a fallback for the very first message which might not have a prefix.
      return `<div class="message message-gemini"><span class="sender">Gemini:</span> ${escapeHtml(
        line
      )}</div>`;
    })
    .join("");

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
  <head>
    <title>Gemini 98 Proxy</title>
    <meta http-equiv="Content-Type" content="text/html; charset=windows-1252">
    <style>
      body { background-color: #008080; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; margin: 0; padding: 20px; text-align: center; }
      #container { width: 600px; margin: 0 auto; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; background-color: #C0C0C0; padding: 3px; text-align: left; }
      h1 { background: #000080; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 4px 8px; margin: 0; }
      #chatbox { height: 400px; overflow: auto; border-top: 2px solid #000000; border-left: 2px solid #000000; border-right: 2px solid #FFFFFF; border-bottom: 2px solid #FFFFFF; background-color: #FFFFFF; padding: 10px; }
      .message { margin-bottom: 8px; }
      .message-user { color: #0000FF; text-align: right; }
      .message-gemini { color: #000000; }
      .message-error { color: #FF0000; font-weight: bold; }
      .sender { font-weight: bold; display: block; }
      #input-form { margin-top: 3px; border-top: 1px solid #FFFFFF; padding-top: 5px; font-size: 0; }
      #prompt-input { width: 500px; height: 24px; border-top: 2px solid #808080; border-left: 2px solid #808080; border-right: 2px solid #FFFFFF; border-bottom: 2px solid #FFFFFF; padding: 3px; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; vertical-align: top; }
      #send-button { width: 80px; height: 34px; background-color: #C0C0C0; border-top: 2px solid #FFFFFF; border-left: 2px solid #FFFFFF; border-right: 2px solid #000000; border-bottom: 2px solid #000000; cursor: pointer; margin-left: 4px; vertical-align: top; font-family: "MS Sans Serif", "Tahoma", "Verdana", sans-serif; font-size: 12px; }
    </style>
  </head>
  <body>
    <div id="container">
      <h1>Gemini 98 Proxy</h1>
      <div id="chatbox">${chatHistoryHtml}</div>
      <form id="input-form" action="/api/chat" method="POST">
        <input type="text" id="prompt-input" name="prompt" autocomplete="off" />
        <input type="submit" id="send-button" value="Send" />
        <input type="hidden" name="history" value="${escapeHtml(history)}" />
      </form>
    </div>
    <script type="text/javascript">
      (function() {
        try {
          var chatbox = document.getElementById('chatbox');
          chatbox.scrollTop = chatbox.scrollHeight;
          var input = document.getElementById('prompt-input');
          input.focus();
        } catch(e) { /* Fails gracefully */ }
      })();
    </script>
  </body>
</html>`;
}

// --- Main Page ---
app.get("/", (req, res) => {
  const welcome =
    "Gemini: Welcome! This is a simple chat interface compatible with very old web browsers.";
  res.send(renderPage(welcome));
});

// --- Chat POST handler ---
app.post("/api/chat", async (req, res) => {
  const prompt = req.body.prompt ? req.body.prompt.trim() : "";
  let history = req.body.history || "";

  // Don't do anything for an empty prompt
  if (!prompt) {
    res.send(renderPage(history));
    return;
  }

  // Create conversation history for the API call from the plain text history
  const historyLines = history.split("\n\n");
  const contents = historyLines
    .map((line) => {
      if (line.startsWith("Gemini: ")) {
        return {
          role: "model",
          parts: [{ text: line.substring("Gemini: ".length) }],
        };
      }
      if (line.startsWith("You: ")) {
        return {
          role: "user",
          parts: [{ text: line.substring("You: ".length) }],
        };
      }
      return null;
    })
    .filter(Boolean);

  // Add the current user prompt
  contents.push({ role: "user", parts: [{ text: prompt }] });

  // Update the display history string
  history += "\n\nYou: " + prompt;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: contents,
    });

    const reply = response.text;
    history += "\n\nGemini: " + reply;
  } catch (err) {
    console.error("Gemini API error:", err);
    history +=
      "\n\nError: Failed to contact Gemini API. Check server logs for details.";
  }

  res.send(renderPage(history));
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Gemini 98 Proxy running at http://localhost:${port}`);
});
