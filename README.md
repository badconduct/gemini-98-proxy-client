# Gemini 98 Proxy

A retro-style AI chat interface that runs on modern Node.js but is fully compatible with legacy web browsers like **Internet Explorer 6** and **Firefox 2.0** — making it ideal for Windows 98SE machines or VMs.

This project connects to the **Google Gemini API** using server-side Node.js and serves a minimal HTML 4.01 page styled like a classic Win98 app.

---

## 🚀 Run Locally

### ✅ Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- A valid [Gemini API Key](https://aistudio.google.com/app/apikey)

---

### 🛠️ Setup Instructions

1. **Clone the repo:**

   ```bash
   git clone https://github.com/yourusername/gemini-98-proxy.git
   cd gemini-98-proxy

    Install dependencies:
   ```

npm install

Set your Gemini API key:

Create a .env file in the root folder:

API_KEY=your-gemini-api-key-here

    💡 Never commit your actual .env file!
    Use .env.example to share a template.

Run the server:

    node server.js

    Open the chat UI:

    Visit http://localhost:3000 in any browser — including one on a Windows 98 VM, if networked.

🧠 Features

    🟢 Gemini 1.5 API integration (via @google/genai)

    🧵 Full conversation history maintained across posts

    🌐 100% compatible with Internet Explorer 6 and Firefox 2

    🔐 Uses .env for secure API key storage

    📦 Zero JavaScript dependencies in the browser

📁 Project Structure

.
├── server.js # Node.js Express server
├── .env.example # Example API key file
├── package.json # Dependencies and metadata
├── public/ # Static files (optional)

🛑 .env Security Reminder

Your .env file contains sensitive API keys. Always add this to .gitignore:

.env

Never commit .env to public repositories.
📜 License

MIT – do whatever you'd like, just don't abuse the Gemini API.
🙏 Credits

Built with ❤️ to bridge 1998 and 2025.
