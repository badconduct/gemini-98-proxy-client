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

## 🧠 Features

- **Secure, File-Based Profiles:** No more cookies for state. Every user has a password-protected profile saved securely on the server.
- **Multi-Profile Launcher System:** The application starts with a login portal. Log in to an existing account or create a new one. The buddy list then "launches" in a new window.
- **Administrator Role & User Management:** The first user created becomes the prime administrator, who can view all users, grant/revoke admin status, and delete accounts.
- **Advanced Social & Age Dynamics:**
  - **Social Groups:** Friends are organized into distinct groups (Students, Townies/Alumni, Online Friends) with their own social rules.
  - **Dynamic Relationships:** Your age and social group determine your starting relationships with other characters.
  - **Personalized AI:** The AI's personality and behavior change dramatically based on your age, social status, and conversation history.
- **Deep AI Personas:** Chat with over a dozen unique AI friends, each with distinct personalities, interests, and schedules.
- **No Front-End Frameworks:** Works in Netscape 4 or IE6, no webpack, no BS.

---

## 🤖 The Social Simulation Engine

The core of the application is a dynamic rules engine that generates unique system instructions for the Gemini API in real-time.

- **Context is King:** The AI is given deep context about your character (age, sex, location, social role) and its own character (personality, interests, relationships with other AIs).
- **Age-Based Logic:** The simulation's rules change based on your age.
  - **Ages 14-19 (Student):** You're an insider with other students, starting with higher relationship scores.
  - **Ages 20-39 (Townie/Alumni):** You have a natural rapport with the other townies.
  - **Ages <=13 or >=40 (Online Friend):** AI friends will be suspicious of you. If you're under 14, they'll become patronizing. If you're over 40, students will find you "creepy" and their opinion of you will permanently decrease with every interaction.
- **Relationship Score:** Your conversations directly impact your relationship score with each friend, unlocking different conversational paths and behaviors.

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

    - **🖥️ Modern browser:** `http://localhost:3000`
    - **🧓 Retro browser (e.g., IE6 on Win98):** `http://<your-local-ip>:3000`

    The first account you create will automatically become the permanent, undeletable **Prime Administrator**.

---

## ⚠️ Security & Deployment

This application is designed for personal or private group use. The current registration system is open by default. **If you plan to deploy this to a public server, it is strongly recommended that you implement an invitation code system** to prevent abuse of your API key.

---

## 📎 Clippy Says

> "It looks like you're trying to build a complex social simulation. Would you like help with that?"
