# DinoDash - Retro Infinite Runner (Production Documentation)

DinoDash is a highly optimized, production-ready retro infinite runner game built using **React**, **TypeScript**, and **HTML5 Canvas**, backed by **Firebase Auth, Firestore, and Hosting**.

---

## 🎮 Features
- **Deterministic 60Hz Physics Loop**: Semi-fixed timestep loop ensures the dinosaur jumps and runs at uniform speeds across all monitors, whether they run at 60Hz, 144Hz, or 360Hz.
- **Hardware-Accelerated Sprite Caching**: Offscreen canvases pre-render all pixel-art sprite combinations (dino states, skins, obstacles, and theme transitions), reducing rendering overhead and battery usage to near zero.
- **Mobile Touch Controls**: Dual on-screen arcade style virtual buttons (JUMP and DUCK) enable full gameplay functionality on smartphones.
- **Comprehensive Anti-Cheat Protection**: Dual-ended client and database-level security checks prevent leaderboard hacking and score falsification.
- **Dynamic Leaderboard**: Real-time Firestore-synced daily, weekly, and all-time leaderboards.
- **Progression & Skins**: Unlockable cosmetics (Golden, Cyber, Galaxy, Pixel King) tied to achievement milestones and daily runs.

---

## 🛠️ Technology Stack
1. **Frontend**: React 19, TypeScript 6, Vite 8, HTML5 Canvas.
2. **Backend**: Firebase Auth (Email/Google), Firestore (Database), Hosting (Production build).
3. **Styling**: Vanilla CSS with modern HSL variables for real-time Day/Night theme transitions.

---

## 🏗️ Architecture & Optimizations

### 1. Performance (Sprite Canvas Cache)
Drawing custom skins, complex outlines, and neon shadow blurs at 60fps can cause garbage collection stutters and CPU spikes when iterating through character-pixel strings.
- **Offscreen Canvas Rendering**: When a sprite is drawn, `drawSpriteCached` checks the global `spriteCanvasCache` for a combination key.
- **Key Schema**: `${spriteName}_${skinId}_${fillColor}_${outlineColor}_${theme}`.
- **Dynamic Render**: If not cached, the sprite is drawn pixel-by-pixel once on a hidden `<canvas>`, then transferred to the visible canvas using `ctx.drawImage()`, which is hardware-accelerated.
- **Cache Eviction**: The cache is cleared automatically on game restart (`startGame`) and when Day/Night theme transitions finish, preventing memory leaks.

### 2. Fair Spawning (Dynamic Landing Gaps)
Classic runners often suffer from impossible randomly generated combinations. The spawning engine calculates player jump physics in real time:
- **Jump Frame Count**: $T_{\text{jump}} = 2 \times \frac{|V_{\text{jump}}|}{g} \approx 35 \text{ frames}$.
- **Safe Trajectory**: The distance required to complete a jump is speed-dependent ($D = \text{speed} \times T_{\text{jump}}$).
- **Enforced Safety Margins**: The system guarantees a minimum landing reaction window ($T_{\text{recovery}} \ge 18 \text{ frames}$) between consecutive jumping obstacles (large cacti, low birds), scaling spacing dynamically with speed:
  $$\text{Gap}_{\text{min}} = \text{speed} \times 53$$

### 3. Anti-Cheat & Security

#### Client-Side Memory Protection
Memory scanners (like Cheat Engine) search for the exact score value in RAM and modify it. 
- **Obfuscated Score Manager**: The score is stored in memory as an XOR-masked variable pair:
  $$\text{Score} = \text{scoreObsVal} \oplus \text{scoreMask}$$
- **Re-Masking Ticks**: On every score increment, a new random mask is generated, and the variables are updated.
- **Focus Time-to-Score Check**: Evaluates if score increments exceed the maximum physical tick rate:
  $$\text{Score} \le (80 \times \text{elapsedSeconds}) + 20$$
- If focus is lost (`window.onblur`), the physics ticks freeze and time scales are halted, preventing speedhack injections.

#### Firestore Database Rules (`firestore.rules`)
Firestore enforces hard validations at the API database layer to prevent direct console injection:
- **Username Uniqueness**: Enforced by transaction checks on the `/usernames/{username}` lookup table.
- **Score Velocity Limit**: Prevents high-score injection. A user's profile `bestScore` can only increase by at most `15,000` points per database write.
- **Leaderboard Validity**: Ensures a user cannot submit a score to `leaderboard_today_` or `leaderboard_weekly_` collections unless it is less than or equal to their verified profile `bestScore`.

---

## 🚀 Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
3. **Build Production Assets**:
   ```bash
   npm run build
   ```

---

## 🌐 Deploy to Firebase

To deploy the production-ready code to Hosting and Firestore:

1. **Install Firebase CLI** (if not installed):
   ```bash
   npm install -g firebase-tools
   ```
2. **Login to Firebase**:
   ```bash
   firebase login
   ```
3. **Select Firebase Project**:
   ```bash
   firebase use --add
   ```
4. **Deploy Rules and Hosting**:
   ```bash
   firebase deploy
   ```
