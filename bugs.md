# DinoGame Bugs & Irregularities Report

Here is a list of identified bugs, security concerns, and design irregularities in the codebase:

## 1. LocalStorage Quota Exceeded Crash during Game Over (Critical)
* **File**: [DinoGame.tsx](file:///d:/DinoGame/src/components/DinoGame.tsx#L820-L829)
* **Symptom**: If a player achieves a very high score (e.g., thousands of points), the game records 60 ghost frames per second. Saving this massive array using `JSON.stringify` into `localStorage` can exceed the browser's 5MB localStorage quota, throwing a `QuotaExceededError`.
* **Impact**: Because there is no `try/catch` block wrapping the `localStorage.setItem` call for the ghost run data, the error crashes the `gameOver` function execution. As a result, `saveCloudStats` is never called, and the player's high score is lost and never saved to the database.
* **Recommendation**: Wrap the ghost run localStorage saver in a `try/catch` block so quota exceptions are caught gracefully and do not block saving high scores to the cloud. Additionally, downsample the ghost run frames (e.g., recording at 10–20 FPS instead of 60 FPS).

---

## 2. Mathematically Broken Weekly Key Calculation (High)
* **File**: [firebase.ts](file:///d:/DinoGame/src/utils/firebase.ts#L29-L35)
* **Symptom**: The function `getWeekKey()` calculates the week key using the following formula:
  `const result = Math.ceil((d.getUTCDay() + 1 + numberOfDays) / 7);`
  Here, `d.getUTCDay()` represents the UTC day index of *today* instead of the offset of January 1st. Because `d.getUTCDay()` and `numberOfDays` both increase by 1 every day, the numerator increases by 2 daily. On Sunday, `d.getUTCDay()` resets to 0 while `numberOfDays` increases by 1, causing a massive drop in the numerator.
* **Impact**: The calculated week number oscillates up and down depending on the day of the week (e.g. jumping from Week 1 to Week 2 and then back to Week 1). This causes the weekly leaderboard to split into different database collections throughout the same week, meaning users will see their weekly leaderboard wipe out and restore depending on the weekday.
* **Recommendation**: Replace it with a standard ISO week calculation or simple timestamp division (e.g., `Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))`).

---

## 3. Double Completion Sound and Toast for Daily Challenges (Medium)
* **File**: [DinoGame.tsx](file:///d:/DinoGame/src/components/DinoGame.tsx#L857-L862)
* **Symptom**: When a score/time daily challenge is completed, the game loop calls `completeDailyChallenge()`, which triggers the completion sound and a success toast. However, during `gameOver()`, the stats saver sees `finalCompleted` is true and was not already completed before starting the run, so it displays the success toast and plays the sound again.
* **Impact**: The player hears the completion sound twice and sees two success toasts for completing a single daily challenge.
* **Recommendation**: Ensure `gameOver()` only triggers the success toast for challenge types that are only checked on game over (like `"games"`), or set a flag when `completeDailyChallenge()` is triggered to prevent duplicates.

---

## 4. Single-Device Local Storage High Score Initialization (Low)
* **File**: [DinoGame.tsx](file:///d:/DinoGame/src/components/DinoGame.tsx#L186-L189)
* **Symptom**: When a user logs in, their locally stored `highScore` state is loaded from `localStorage` before the user profile is fetched. If a user logs in on a new device, their local `highScore` defaults to 0 instead of their cloud profile's high score.
* **Impact**: The UI displays 0 for "Best Run" on the Game Over screen until a new game finishes and syncs the score. (Fixed in the recent patch by adding the real-time syncing effect, but documented here as an irregularity in the initial architecture).
