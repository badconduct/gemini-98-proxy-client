# 💬 ICQ98 Proxy

> 🧠 Powered by Gemini + local AI logic  
> 🎨 Runs remotely in your Windows 98SE-compatible browser (with cookies for state)  
> 📟 Feels like 1998—but watches you like it's 2025

ICQ98 Proxy is a nostalgic chat simulator that brings 90s internet social life back to your desktop—complete with AI-powered friends, an in-browser buddy list, and full compatibility with retro browsers. It feels like you're back on dial-up... but the conversations are way smarter.

---

## 💻 Requirements

### Server (Proxy)

To run the AI-enabled server:

- **Node.js 18+**
- **Gemini API key** from [Google Generative AI](https://ai.google.dev/)
- A **modern machine** to host the proxy server

### Client (Browser)

The front-end is fully retro-compatible:

- Works on **Internet Explorer 6**, **Firefox 2.0+**, or modern browsers
- Requires only basic JavaScript (no React, no fetch, no ES6)
- Optimized for **640x480–1024x768** screen sizes

> Access the server locally or remotely from a vintage PC for the full Y2K-era experience.

---

## 🧠 Features

- **AI Friends** with distinct personalities, interests, and relationship scores
- **Dynamic Conversations** powered by Gemini and custom server-side logic
- **Buddy List** showing who's online, offline, or blocked
- **Relationship Engine** that evolves based on your choices
- **Apology System** if things go wrong (and they will)
- **Fully Cookie-Based State** — no login needed, just show up and chat
- **No Front-End Frameworks** — works in Netscape 4 or IE6, no webpack, no BS

---

## 🔐 Moderation System

Your relationship score determines how much you can get away with:

- Start at **5/10** with most characters
- Say something sketchy and:
  - If you’re **not best friends**, lose 2 points and get a warning
  - If you’re **best friends (10/10)**, get a warning first, then a softer -1 penalty
- Drop to **0** and you’re blocked
- Apologize to potentially earn a second chance (score resets to 1/10)

> Characters like **Elion** and **utility bots** are immune to this system—they know too much.

---

## 🚀 Getting Started

🚀 Getting Started

    Clone this repo

git clone https://github.com/yourusername/icq98-proxy.git
cd icq98-proxy

Install dependencies

npm install

Add your Gemini API key
Create a .env file in the project root:

API_KEY=your-gemini-api-key

Start the server

node server.js

Open the site

    🖥️ Modern browser:
    http://localhost:3000

    🧓 Retro browser (e.g., IE6 on Windows 98):
    Use your LAN IP:
    http://<your-local-ip>:3000
    Example: http://192.168.1.100:3000

🎁 Extras

    Built-in personalities are fully customizable via config/personas.js

    Assets use base64 inlining for maximum compatibility

    Optional pixel-perfect IE6 styling via views/renderer.js

⚠️ Disclaimer

This is a simulation. AI responses may reflect the quirks, interests, or boundaries of fictional characters. Nothing is recorded—except your regrets.

📎 Clippy Says

    "It looks like you're trying to relive the late 90s. Would you like help with that?"
