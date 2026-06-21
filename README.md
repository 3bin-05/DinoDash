# 🦕 DinoDash – Free Dino Game Online

> **Play the best free dino game online – no download needed!**
> Jump, dodge, and dash as a pixel T-Rex in this endless runner game with global leaderboards, daily challenges, and unlockable skins.

🎮 **[Play DinoDash Now →](https://d-inodash.vercel.app/)**

---

## What is DinoDash?

**DinoDash** is a free browser-based dinosaur endless runner game inspired by the classic Chrome dino game. Control a pixel T-Rex, leap over cacti, dodge flying pterodactyls, and see how far you can run. The further you go, the faster it gets!

Whether you're searching for a **dino game**, **dino dash**, **dinosaur game online**, or the classic **Chrome offline dino game** – DinoDash is the premium version you've been looking for.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🏃 **Endless Runner** | Classic dino runner gameplay with increasing speed |
| 🌙 **Day / Night Cycle** | Atmosphere switches as your score climbs |
| 🏆 **Global Leaderboards** | All-time, weekly, and daily rankings |
| 📅 **Daily Challenges** | New challenge every 24 hours |
| 🎖️ **Achievements** | 10+ unlockable achievement badges |
| 🎨 **Dino Skins** | Unlock and equip different dino looks |
| 👤 **User Profiles** | Sign in with Google to save progress |
| 📊 **Stats Tracking** | Best score, games played, total distance |
| 👻 **Ghost Run** | Practice mode without affecting your stats |

---

## 🕹️ How to Play

| Key | Action |
|---|---|
| `Space` / `↑` | Jump |
| `↓` | Duck |
| `Double Space` | Double jump |

---

## 🛠️ Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Game Engine:** HTML5 Canvas (custom, no game library)
- **Backend / Auth:** Firebase (Firestore, Authentication)
- **Deployment:** Vercel
- **Styling:** Vanilla CSS with CSS custom properties

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- A Firebase project

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/dinodash.git
cd dinodash

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Fill in your Firebase credentials in .env

# 4. Start the development server
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase project values:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

---

## 📦 Deployment (Vercel)

1. Push your code to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add all `VITE_FIREBASE_*` env vars in Vercel → Settings → Environment Variables
4. Deploy!

---

## 📁 Project Structure

```
dinodash/
├── public/
│   ├── favicon.svg        # Pixel dino favicon
│   ├── og-preview.png     # Social media preview image
│   ├── robots.txt         # SEO crawler instructions
│   └── sitemap.xml        # SEO sitemap
├── src/
│   ├── components/
│   │   ├── DinoGame.tsx           # Main game component (~2500 lines)
│   │   ├── AuthScreen.tsx         # Login / sign-up screen
│   │   ├── UsernameSetupScreen.tsx
│   │   └── ProfileSettingsModal.tsx
│   ├── context/
│   │   └── AuthContext.tsx        # Firebase auth context
│   └── utils/
│       ├── firebase.ts            # Firebase config & helpers
│       └── dailyChallenges.ts     # Daily challenge definitions
├── .env.example           # Template for environment variables
├── .gitignore
├── index.html             # SEO-optimized entry point
├── vercel.json            # Vercel SPA routing config
└── vite.config.ts
```

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

*Keywords: dino game, dino dash, dinosaur game online, chrome dino game, dino runner, t-rex game, pixel dino, free dino game browser, endless runner game*
