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
- **Multi-Profile Launcher System:** The application starts with a login portal. Log in to an existing account, create a new one, or log in as a temporary guest.
- **Deep AI Personas:** Chat with over a dozen unique AI friends, each with distinct personalities, interests, and online/offline schedules that vary based on the season.
- **Helpful Utility Bots:** Get help from specialized bots: `Code Bot` for programming, `98SE Help Bot` for retro troubleshooting, `Nostalgia Bot` for hints, and a general-purpose `Gemini Bot`.
- **No Front-End Frameworks:** Works in Netscape 4 or IE6, no webpack, no BS.

### The Social Simulation Engine (In-Depth)

The core of the application is a dynamic rules engine that generates unique system instructions for the Gemini API in real-time.

- **Context is King:** The AI is given deep context about your character (age, sex, location, social role) and its own character (personality, interests, relationships with other AIs).
- **Age-Based Logic:** The simulation's rules change based on your age.
  - **Ages 14-19 (Student):** You're an insider with other students, starting with higher relationship scores.
  - **Ages 20-39 (Townie/Alumni):** You have a natural rapport with the other townies.
  - **Ages <=13 or >=40 (Online Friend):** Local AI friends will be suspicious of you. If you reveal you're under 14, they'll become patronizing. If you reveal you're over 40, students will find you "creepy" and their opinion of you will permanently decrease with every interaction (this penalty can be disabled via `.env` settings).
- **Gossip Mechanic:** When you reveal your true age to a local friend (a Student or Townie), they might tell others in their social group! This creates a dynamic world where information spreads and your reputation can change based on who you trust. The chance and scope of gossip are configurable.
- **Honesty & Preference System:** The simulation now learns your tastes. When you express a strong like or dislike for a topic (music, movies, etc.), the system remembers it. Be careful what you say to whom! If you tell one friend you hate pop music and another that you love it, the gossip network will catch your contradiction. Characters will call you out for being fake, resulting in a one-time relationship penalty. Stay consistent to maintain your reputation!
- **R-Rated Content Filter:** The simulation includes a content filter that detects and penalizes discussions related to drugs, violence, and inappropriate sexual advances, with unique rules for different relationship levels. This can be toggled by the Prime Admin.
- **Relationship Score:** Your conversations directly impact your relationship score with each friend, unlocking different conversational paths and behaviors.
- **Dating & Consequences:** You can date student characters if your friendship is high enough. This has real consequences, including potential breakups, jilted ex-lovers, and getting caught if you date more than one person at a time.

### Administrator Features

The first user created becomes the **Prime Administrator** with access to powerful tools.

- **User Management Panel (`/admin/users`):** View all registered users, their last login time, and their A/S/L. Edit user details, grant/revoke standard admin status, or reset/delete profiles.
- **Dangerous Options (`/admin/options`):** An options panel for standard admins to perform cheats for their own profile, like setting all relationship scores, or resetting the entire application (deleting all profiles and images).
- **Prime Admin Portal (`/primeadmin`):** A separate, secure portal only accessible by the Prime Administrator. This "god mode" panel allows you to modify the global rules of the entire simulation. Change default relationship scores, dating rules, social penalties, and more. Saving changes here will trigger a "simulation restart," regenerating the social world for all non-admin users based on your new rules.

---

## 🚀 Getting Started

1.  **Clone this repo**

    ```bash
    git clone https://github.com/badconduct/gemini-98-proxy-client.git
    cd gemini-98-proxy-client
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Create your `.env` configuration file**
    Create a `.env` file in the project root. You can use the example below as a template—just fill in your own API key and session secret.
    **Example `.env` file:**

    ```env
    # --- Required Settings ---
    # Your Gemini API key from Google AI Studio.
    API_KEY=your-gemini-api-key-goes-here

    # A long, random string used to sign session cookies for security.
    # This prevents users from tampering with their session data.
    # Generate one easily online or with a password manager.
    SESSION_SECRET=a-very-long-and-random-string-for-better-security

    # --- Network Settings (Optional, but recommended for deployment) ---
    # The IP address the server will listen on.
    # 'localhost' (default) is for local access only.
    # '0.0.0.0' is required for Docker or most public hosting platforms.
    HOST=localhost

    # The port the server will run on.
    # Default is 3000. Many hosting services will set this automatically.
    PORT=3000

    # --- Convenience Settings (Optional) ---
    # Set this to your local UTC offset to ensure AI schedules are correct.
    # Examples: -4 for EDT, -5 for EST, -7 for PDT, 1 for CET. Defaults to 0 (UTC).
    TIMEZONE_OFFSET=-5

    # Bypasses the login screen and automatically logs in as the Prime Admin.
    # If no Prime Admin exists, it will direct you to create one first.
    # Useful for private, personal use where you are the only user.
    SINGLE_USER_MODE=false

    # --- Server Operator Settings (Optional) ---
    # WARNING: Use at your own risk. Disabling this allows the AI to generate
    # potentially inappropriate or offensive content and also disables the "creepy age" penalty.
    # This setting is for creative exploration. Misuse may violate Gemini's terms of service.
    DISABLE_SAFETY_FILTERS=false

    # --- Public Hosting / Demo Mode Settings (Optional) ---
    # Disables the /primeadmin portal completely for added security.
    DISABLE_PRIME_ADMIN=false

    # Hides the normal user login/registration, leaving only the "Login as Guest" button.
    # Recommended to be set to `true` along with DISABLE_PRIME_ADMIN for public demos.
    PUBLIC_GUEST_ONLY_MODE=false
    ```

4.  **Start the server**

    ```bash
    node server.js
    ```

5.  **Open the site & Create Your Admin Account**

    - **🖥️ Host browser:** `http://localhost:3000`
    - **🧓 Retro browser (e.g., IE6 on Win98):** `http://<your-local-ip>:3000`

    The first account you create will automatically become the permanent, undeletable **Prime Administrator**. If `SINGLE_USER_MODE` is enabled, the app will log you in automatically after you create this account.

---

## ⚠️ Security & Public Deployment

This application is designed for personal or private group use. The current registration system is open by default.

**If you plan to deploy this to a public server for demo purposes, it is strongly recommended that you use the built-in safety features.** In your `.env` file, set:

```
DISABLE_PRIME_ADMIN=true
PUBLIC_GUEST_ONLY_MODE=true
```

This will create a safe, public-facing demo where users can only log in as temporary guests and the powerful administration portals are completely disabled.

---

## 📎 Clippy Says

> "It looks like you're trying to build a complex social simulation. Would you like help with that?"
