import React, { useState } from "react";
import { doc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuth } from "../context/AuthContext";

export const UsernameSetupScreen: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const [username, setUsername] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();

    // 1. Validate length
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError("LENGTH MUST BE 3-20 CHARACTERS");
      setLoading(false);
      return;
    }

    // 2. Validate format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      setError("LETTERS, NUMBERS, UNDERSCORE ONLY");
      setLoading(false);
      return;
    }

    if (!user) {
      setError("NO AUTH USER DETECTED");
      setLoading(false);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", cleanUsername);
        const usernameSnap = await transaction.get(usernameRef);

        if (usernameSnap.exists()) {
          throw new Error("USERNAME_TAKEN");
        }

        const userRef = doc(db, "users", user.uid);

        // Write registration doc to enforce uniqueness
        transaction.set(usernameRef, { uid: user.uid });

        // Write the main user profile
        transaction.set(userRef, {
          username: cleanUsername,
          createdAt: serverTimestamp(),
          bestScore: 0,
          totalGames: 0,
          totalDistance: 0,
          selectedSkin: "default",
          achievements: [],
          unlockedSkins: ["default"],
          giftsCollected: 0,
          lastDailyChallengeDate: "",
          dailyChallengeStatus: {
            date: "",
            progress: 0,
            completed: false,
          },
          dailyChallengesCompletedCount: 0,
        });
      });

      // 5. Update Auth Context profile state
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      if (err.message === "USERNAME_TAKEN") {
        setError("USERNAME ALREADY TAKEN");
      } else {
        setError("SERVER ERROR. TRY AGAIN.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="game-wrapper day">
      <div className="auth-box">
        <div className="auth-header">
          <div className="game-title">SETUP PROFILE</div>
          <div className="auth-subtitle">INITIAL SYSTEM REGISTRATION</div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error-box animate-pulse">
              ! ERROR: {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username-setup">CHOOSE UNIQUE USERNAME</label>
            <input
              id="username-setup"
              type="text"
              placeholder="ENTER USERNAME"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pixel-input"
              disabled={loading}
              autoFocus
            />
            <div className="setup-guide-text">
              Rule: 3-20 characters. A-Z, 0-9, and underscore (_) only.
            </div>
          </div>

          <button type="submit" className="restart-btn auth-submit-btn" disabled={loading}>
            {loading ? "CHECKING AVAILABILITY..." : "CONFIRM USERNAME"}
          </button>
        </form>

        <div className="auth-divider">
          <span className="divider-line"></span>
          <span className="divider-text">OR</span>
          <span className="divider-line"></span>
        </div>

        <button
          type="button"
          onClick={logout}
          className="restart-btn auth-logout-btn"
          style={{ backgroundColor: "#ff3b30", color: "#ffffff" }}
        >
          CANCEL & SIGN OUT
        </button>
      </div>
    </div>
  );
};
