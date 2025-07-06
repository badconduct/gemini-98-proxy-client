# 💬 ICQ98 Proxy

> 🧠 Powered by Gemini + a dynamic social simulation engine
> 🔐 Secure multi-profile accounts with server-side state
> 📟 Feels like 1998—but with AI that knows who you are

ICQ98 Proxy is a nostalgic chat simulator that brings 90s internet social life back to your desktop. It's a multi-user, password-protected application with AI-powered friends, an in-browser buddy list, and full compatibility with retro browsers. It feels like you're back on dial-up... but the conversations are way smarter.

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
- Requires only basic JavaScript (ES3)
- Optimized for **640x480–1024x768** screen sizes

> Access the server locally or remotely from a vintage PC for the full Y2K-era experience.

---

## 🧠 Core Features

### Key Features

- **Secure, File-Based Profiles:** No more cookies for state. Every user has a password-protected profile saved securely on the server.
- **Multi-Profile Launcher System:** The application starts with a login portal. Log in to an existing account or create a new one. The buddy list then "launches" in a new window.
- **Deep AI Personas:** Chat with over a dozen unique AI friends, each with distinct personalities, interests, and online/offline schedules that vary based on the season.
- **Helpful Utility Bots:** Get help from specialized bots: `Code Bot` for programming, `98SE Help Bot` for retro troubleshooting, `Nostalgia Bot` for hints, and a general-purpose `Gemini Bot`.
- **No Front-End Frameworks:** Works in Netscape 4 or IE6, no webpack, no BS.

### The Social Simulation Engine (In-Depth)

The core of the application is a dynamic rules engine that generates unique system instructions for the Gemini API in real-time.

- **Context is King:** The AI is given deep context about your character (age, sex, location, social role) and its own character (personality, interests, relationships with other AIs).
- **Age-Based Logic:** The simulation's rules change based on your age.
  - **Ages 14-19 (Student):** You're an insider with other students, starting with higher relationship scores.
  - **Ages 20-39 (Townie/Alumni):** You have a natural rapport with the other townies.
  - **Ages <=13 or >=40 (Online Friend):** Local AI friends will be suspicious of you. If you reveal you're under 14, they'll become patronizing. If you reveal you're over 40, students will find you "creepy" and their opinion of you will permanently decrease with every interaction.
- **Gossip Mechanic:** When you reveal your true age to a local friend (a Student or Townie), they'll tell others in their social group! This creates a dynamic world where information spreads and your reputation can change based on who you trust.
- **Relationship Score:** Your conversations directly impact your relationship score with each friend, unlocking different conversational paths and behaviors.

### Administrator Features

The first user created becomes the **Prime Administrator** with access to powerful tools.

- **User Management Panel:** View all registered users, their last login time, and their A/S/L.
- **Edit & Reset Users:** Directly edit a user's Age, Sex, or Location. Changing these fields automatically resets that user's social world to match their new identity. You can also reset a user's profile with a single click, wiping their chat history and relationships.
- **Grant/Revoke Admin Status:** Promote other users to administrators.
- **Dangerous Options:** An options panel allows you to do things like reset the _entire application_, deleting all profiles and images, forcing a fresh start.

---

## 🚀 Getting Started

1.  **Clone this repo**

    ```bash
    git clone https://github.com/yourusername/icq98-proxy.git
    cd icq98-proxy
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Add your Gemini API key**
    Create a `.env` file in the project root with your API key and a session secret:

    ```
    API_KEY=your-gemini-api-key
    SESSION_SECRET=a-long-random-string-for-security
    ```

4.  **Start the server**

    ```bash
    node server.js
    ```

5.  **Open the site & Create Your Admin Account**

    - **🖥️ Host browser:** `http://localhost:3000`
    - **🧓 Retro browser (e.g., IE6 on Win98):** `http://<your-local-ip>:3000`

    The first account you create will automatically become the permanent, undeletable **Prime Administrator**.

---

## ⚠️ Security & Deployment

This application is designed for personal or private group use. The current registration system is open by default. **If you plan to deploy this to a public server, it is strongly recommended that you implement an invitation code system** to prevent abuse of your API key.

---

## 📎 Clippy Says

> "It looks like you're trying to build a complex social simulation. Would you like help with that?"
