import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, collection, query, where, getDoc, orderBy, limit, onSnapshot, getCountFromServer, runTransaction } from "firebase/firestore";
import { db, getDateKey, getWeekKey } from "../utils/firebase";
import { useAuth } from "../context/AuthContext";
import {
  DINO_STAND,
  drawSprite,
  drawSpriteWithOutline,
  OVERLAY_SUNGLASSES,
  OVERLAY_SCARF,
  OVERLAY_CROWN,
} from "../utils/sprites";

interface ProfileSettingsModalProps {
  onClose: () => void;
  initialTab?: "stats" | "edit" | "leaderboard" | "skins";
}

const ALL_ACHIEVEMENTS = [
  { id: "first_jump", category: "BEGINNER", title: "FIRST JUMP", description: "Perform your first jump." },
  { id: "first_game", category: "BEGINNER", title: "FIRST GAME", description: "Complete your first game run." },
  { id: "score_500", category: "BEGINNER", title: "SCORE 500", description: "Reach a score of 500 points in a single run." },
  { id: "score_5000", category: "SKILLED", title: "SCORE 5000", description: "Reach a score of 5,000 points in a single run." },
  { id: "score_10000", category: "SKILLED", title: "SCORE 10000", description: "Reach a score of 10,000 points in a single run." },
  { id: "score_20000", category: "SKILLED", title: "SCORE 20000", description: "Reach a score of 20,000 points in a single run." },
  { id: "games_100", category: "VETERAN", title: "PLAY 100 GAMES", description: "Play 100 total game runs." },
  { id: "games_500", category: "VETERAN", title: "PLAY 500 GAMES", description: "Play 500 total game runs." },
  { id: "daily_challenge", category: "SPECIAL", title: "DAILY RUN", description: "Score 1000 points in a Daily Challenge." },
  { id: "collect_50_gifts", category: "SPECIAL", title: "COLLECT 50 GIFTS", description: "Collect 50 total gift boxes." }
];

interface DinoSkinPreviewProps {
  skinId: string;
}

const DinoSkinPreview: React.FC<DinoSkinPreviewProps> = ({ skinId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dinoScale = 1.6;
    const x = (canvas.width - 24 * dinoScale) / 2;
    const y = (canvas.height - 21 * dinoScale) / 2;

    const spriteColor = "#000000";
    let fillColor: string | CanvasGradient = spriteColor;
    let outlineColor: string | null = null;

    if (skinId === "golden") {
      const gradient = ctx.createLinearGradient(x, y, x + 24 * dinoScale, y + 21 * dinoScale);
      gradient.addColorStop(0, "#ffe066");
      gradient.addColorStop(0.5, "#f5b041");
      gradient.addColorStop(1, "#9a7d0a");
      fillColor = gradient;
      outlineColor = "#000000";
    } else if (skinId === "cyber") {
      fillColor = "#39ff14";
      outlineColor = "#000000";
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur = 6;
    } else if (skinId === "galaxy") {
      const gradient = ctx.createLinearGradient(x, y, x + 24 * dinoScale, y + 21 * dinoScale);
      gradient.addColorStop(0, "#3f51b5");
      gradient.addColorStop(0.5, "#9c27b0");
      gradient.addColorStop(1, "#e91e63");
      fillColor = gradient;
      outlineColor = "#000000";
    } else if (skinId === "pixel_king") {
      const gradient = ctx.createLinearGradient(x, y, x + 24 * dinoScale, y + 21 * dinoScale);
      gradient.addColorStop(0, "#7d3c98");
      gradient.addColorStop(1, "#4a235a");
      fillColor = gradient;
      outlineColor = "#000000";
    }

    if (outlineColor) {
      drawSpriteWithOutline(ctx, DINO_STAND, x, y, dinoScale, fillColor, outlineColor);
    } else {
      drawSprite(ctx, DINO_STAND, x, y, dinoScale, fillColor);
    }

    // Reset shadow blur
    ctx.shadowBlur = 0;

    // Draw accessories
    if (skinId === "sunglasses") {
      drawSprite(ctx, OVERLAY_SUNGLASSES, x + 17 * dinoScale, y + 2 * dinoScale, dinoScale, "#222222");
    } else if (skinId === "scarf") {
      drawSprite(ctx, OVERLAY_SCARF, x + 16 * dinoScale, y + 6 * dinoScale, dinoScale, "#ff3b30");
    } else if (skinId === "pixel_king") {
      drawSprite(ctx, OVERLAY_CROWN, x + 17 * dinoScale, y - 2 * dinoScale, dinoScale, "#ffd700");
    }
  }, [skinId]);

  return <canvas ref={canvasRef} width={60} height={50} className="skin-preview-canvas" />;
};

const SKINS_LIST = [
  { id: "default", name: "Default Dino", description: "The classic retro runner.", milestone: "Unlocked by default" },
  { id: "sunglasses", name: "Sunglasses Dino", description: "Runs with style. Cool retro shades.", milestone: "Score 500 points (unlocks Sunglasses)" },
  { id: "scarf", name: "Scarf Dino", description: "Warm red scarf for winter jogs.", milestone: "Complete 1 game run (unlocks Scarf)" },
  { id: "golden", name: "Golden Dino", description: "Sleek and polished solid gold.", milestone: "Score 5,000 points (unlocks Golden)" },
  { id: "cyber", name: "Cyber Dino", description: "Glows with neon energy.", milestone: "Score 10,000 points (unlocks Cyber)" },
  { id: "galaxy", name: "Galaxy Dino", description: "Starry cosmic style.", milestone: "Score 20,000 points (unlocks Galaxy)" },
  { id: "pixel_king", name: "Pixel King Dino", description: "Wear the crown of the runner kingdom.", milestone: "Collect 50 total gifts (unlocks Pixel King)" },
];

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ onClose, initialTab }) => {
  const { user, profile, refreshProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"stats" | "edit" | "leaderboard" | "skins">(initialTab || "stats");
  const [newUsername, setNewUsername] = useState<string>(profile?.username || "");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Leaderboard States
  const [leaderboardTab, setLeaderboardTab] = useState<"today" | "weekly" | "alltime">("today");
  interface LeaderboardEntry {
    uid: string;
    username: string;
    score: number;
  }
  const [leaderboardList, setLeaderboardList] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userScore, setUserScore] = useState<number | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  // Subscribe to real-time Leaderboard updates
  useEffect(() => {
    if (activeTab !== "leaderboard" || !user || !profile) return;

    const currentUser = user;
    setLoadingLeaderboard(true);
    setLeaderboardList([]);
    setUserRank(null);
    setUserScore(null);

    let q;
    let collRef;
    const dateKey = getDateKey();
    const weekKey = getWeekKey();

    if (leaderboardTab === "today") {
      collRef = collection(db, `leaderboard_today_${dateKey}`);
      q = query(collRef, orderBy("score", "desc"), limit(100));
    } else if (leaderboardTab === "weekly") {
      collRef = collection(db, `leaderboard_weekly_${weekKey}`);
      q = query(collRef, orderBy("score", "desc"), limit(100));
    } else {
      collRef = collection(db, "users");
      q = query(collRef, orderBy("bestScore", "desc"), limit(100));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: LeaderboardEntry[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          uid: d.id,
          username: data.username || "anonymous",
          score: leaderboardTab === "alltime" ? (data.bestScore || 0) : (data.score || 0),
        });
      });
      setLeaderboardList(list);

      // Check if current user is in the top 100
      const userIndex = list.findIndex(item => item.uid === currentUser.uid);
      if (userIndex !== -1) {
        setUserRank(userIndex + 1);
        setUserScore(list[userIndex].score);
        setLoadingLeaderboard(false);
      } else {
        // Fetch current user's personal score and rank
        try {
          let scoreVal = 0;
          const userDocRef = doc(db, collRef.path, currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            scoreVal = leaderboardTab === "alltime" ? (data.bestScore || 0) : (data.score || 0);
          }
          setUserScore(scoreVal);

          if (scoreVal > 0) {
            const scoreField = leaderboardTab === "alltime" ? "bestScore" : "score";
            const countQ = query(collRef, where(scoreField, ">", scoreVal));
            const countSnap = await getCountFromServer(countQ);
            setUserRank(countSnap.data().count + 1);
          } else {
            setUserRank(null);
          }
        } catch (err) {
          console.warn("Failed to fetch user rank outside top 100:", err);
        } finally {
          setLoadingLeaderboard(false);
        }
      }
    });

    return () => unsubscribe();
  }, [activeTab, leaderboardTab, user, profile]);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const cleanUsername = newUsername.trim().toLowerCase();

    if (!user || !profile) {
      setError("NO PROFILE ACTIVE");
      setLoading(false);
      return;
    }

    if (cleanUsername === profile.username) {
      setSuccess("USERNAME SAVED");
      setLoading(false);
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError("LENGTH MUST BE 3-20 CHARACTERS");
      setLoading(false);
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      setError("LETTERS, NUMBERS, UNDERSCORE ONLY");
      setLoading(false);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const oldUsernameRef = doc(db, "usernames", profile.username);
        const newUsernameRef = doc(db, "usernames", cleanUsername);

        const newUsernameSnap = await transaction.get(newUsernameRef);
        if (newUsernameSnap.exists()) {
          throw new Error("USERNAME_TAKEN");
        }

        const userRef = doc(db, "users", user.uid);

        // Delete old mapping to release the username
        transaction.delete(oldUsernameRef);

        // Reserve new username mapping
        transaction.set(newUsernameRef, { uid: user.uid });

        // Update the main user profile
        transaction.update(userRef, {
          username: cleanUsername,
        });
      });

      await refreshProfile();
      setSuccess("USERNAME UPDATED!");
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

  const handleSelectSkin = async (skinId: string) => {
    if (!user || !profile) return;
    const unlockedSkins = profile.unlockedSkins || ["default"];
    if (!unlockedSkins.includes(skinId)) return;

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        selectedSkin: skinId,
      });
      await refreshProfile();
    } catch (err) {
      console.error("Failed to select skin:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  return (
    <div className="retro-modal-overlay">
      <div className="retro-modal-box">
        <div className="retro-modal-header">
          <div className="retro-modal-title">PROFILE CONTROL PANEL</div>
          <button className="retro-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="retro-modal-tabs">
          <button
            className={`retro-modal-tab-btn ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            STATS & MEDALS
          </button>
          <button
            className={`retro-modal-tab-btn ${activeTab === "skins" ? "active" : ""}`}
            onClick={() => setActiveTab("skins")}
          >
            DINO SKINS
          </button>
          <button
            className={`retro-modal-tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            LEADERBOARD
          </button>
          <button
            className={`retro-modal-tab-btn ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
          >
            EDIT PROFILE
          </button>
        </div>

        <div className="retro-modal-content">
          {activeTab === "stats" && (
            <div className="stats-tab-content">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-card-label">BEST RUN</div>
                  <div className="stat-card-val">{profile?.bestScore || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">TOTAL GAMES</div>
                  <div className="stat-card-val">{profile?.totalGames || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">TOTAL RUN DISTANCE</div>
                  <div className="stat-card-val">{profile?.totalDistance || 0}</div>
                </div>
              </div>

              <div className="achievements-section">
                <div className="section-title">RETRO MEDALS / ACHIEVEMENTS</div>
                {["BEGINNER", "SKILLED", "VETERAN", "SPECIAL"].map((category) => {
                  const categoryAchievements = ALL_ACHIEVEMENTS.filter(a => a.category === category);
                  return (
                    <div key={category} className="achievement-category-group">
                      <div className="category-group-header">{category}</div>
                      <div className="achievements-list">
                        {categoryAchievements.map((ach) => {
                          const isUnlocked = profile?.achievements?.includes(ach.id);
                          return (
                            <div
                              key={ach.id}
                              className={`achievement-card ${isUnlocked ? "unlocked" : "locked"}`}
                            >
                              <div className="achievement-icon" style={{ display: "flex", alignItems: "center" }}>
                                {isUnlocked ? (
                                  <svg viewBox="0 0 16 16" width="22" height="22" fill="#34c759" className="retro-pixel-icon">
                                    <path d="M3 1h10v3c0 2-1 4-4 4v2h3v3h-2v2H6v-2H4v-3h3V8C4 8 3 6 3 4V1zm0 2H1v1c0 1 1 2 2 2v-3zm10 0v3c1 0 2-1 2-2V3h-2z" />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 16 16" width="20" height="20" fill="var(--color-secondary)" className="retro-pixel-icon">
                                    <path d="M8 2a3 3 0 0 0-3 3v3H4v7h8V8h-1V5a3 3 0 0 0-3-3zm-1 3a1 1 0 0 1 2 0v3H7V5zm1 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                                  </svg>
                                )}
                              </div>
                              <div className="achievement-info">
                                <div className="achievement-title">{ach.title}</div>
                                <div className="achievement-desc">{ach.description}</div>
                              </div>
                              {isUnlocked && <div className="unlocked-badge">UNLOCKED</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "skins" && (
            <div className="skins-tab-content">
              <div className="skins-grid">
                {SKINS_LIST.map((skin) => {
                  const unlockedSkins = profile?.unlockedSkins || ["default"];
                  const isUnlocked = unlockedSkins.includes(skin.id);
                  const isSelected = profile?.selectedSkin === skin.id;

                  return (
                    <div
                      key={skin.id}
                      className={`skin-card ${isUnlocked ? "unlocked" : "locked"} ${isSelected ? "selected" : ""}`}
                    >
                      <div className="skin-card-preview">
                        <DinoSkinPreview skinId={skin.id} />
                      </div>
                      <div className="skin-card-info">
                        <div className="skin-card-name">{skin.name}</div>
                        <div className="skin-card-desc">{skin.description}</div>
                        {!isUnlocked && (
                          <div className="skin-card-milestone">
                            <span>Unlock:</span> {(() => {
                              const completedCount = profile?.dailyChallengesCompletedCount || 0;
                              if (skin.id === "galaxy") {
                                return `Score 20,000 pts OR complete 3 Daily Challenges (Progress: ${completedCount}/3)`;
                              }
                              if (skin.id === "pixel_king") {
                                return `Collect 50 gifts OR complete 5 Daily Challenges (Progress: ${completedCount}/5)`;
                              }
                              return skin.milestone;
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="skin-card-action">
                        {isUnlocked ? (
                          isSelected ? (
                            <button className="skin-btn selected-btn" disabled>
                              ACTIVE
                            </button>
                          ) : (
                            <button
                              className="skin-btn select-btn"
                              onClick={() => handleSelectSkin(skin.id)}
                            >
                              EQUIP
                            </button>
                          )
                        ) : (
                          <button className="skin-btn locked-btn" disabled>
                            LOCKED
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "leaderboard" && (
            <div className="leaderboard-tab-content">
              {/* Leaderboard Category Tabs */}
              <div className="leaderboard-subtabs">
                <button
                  className={`leaderboard-subtab-btn ${leaderboardTab === "today" ? "active" : ""}`}
                  onClick={() => setLeaderboardTab("today")}
                >
                  TODAY
                </button>
                <button
                  className={`leaderboard-subtab-btn ${leaderboardTab === "weekly" ? "active" : ""}`}
                  onClick={() => setLeaderboardTab("weekly")}
                >
                  WEEKLY
                </button>
                <button
                  className={`leaderboard-subtab-btn ${leaderboardTab === "alltime" ? "active" : ""}`}
                  onClick={() => setLeaderboardTab("alltime")}
                >
                  ALL TIME
                </button>
              </div>

              {loadingLeaderboard ? (
                <div className="retro-loading-box">
                  <div className="retro-loading-text animate-pulse">CONNECTING INTEL RETRIEVAL...</div>
                </div>
              ) : (
                <div className="leaderboard-table-wrapper">
                  <div className="leaderboard-table">
                    {/* Header */}
                    <div className="leaderboard-row header-row">
                      <span className="leaderboard-cell rank-cell">RANK</span>
                      <span className="leaderboard-cell name-cell">USER</span>
                      <span className="leaderboard-cell score-cell">SCORE</span>
                    </div>

                    {/* Entries */}
                    {leaderboardList.length === 0 ? (
                      <div className="leaderboard-empty">
                        NO SCORES REGISTERED YET
                      </div>
                    ) : (
                      <div className="leaderboard-scroll-area">
                        {leaderboardList.map((entry, idx) => {
                          const isCurrentUser = entry.uid === user?.uid;
                          return (
                            <div
                              key={entry.uid}
                              className={`leaderboard-row ${isCurrentUser ? "highlight" : ""}`}
                            >
                              <span className="leaderboard-cell rank-cell">#{idx + 1}</span>
                              <span className="leaderboard-cell name-cell">
                                @{entry.username} {isCurrentUser && " (YOU)"}
                              </span>
                              <span className="leaderboard-cell score-cell">{entry.score}</span>
                            </div>
                          );
                        })}

                        {/* Current User Rank outside top 100 */}
                        {userRank && userRank > 100 && userScore !== null && (
                          <>
                            <div className="leaderboard-divider-row">
                              <span>...</span>
                            </div>
                            <div className="leaderboard-row highlight">
                              <span className="leaderboard-cell rank-cell">#{userRank}</span>
                              <span className="leaderboard-cell name-cell">
                                @{profile?.username} (YOU)
                              </span>
                              <span className="leaderboard-cell score-cell">{userScore}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "edit" && (
            <div className="edit-tab-content">
              <form onSubmit={handleUpdateUsername} className="auth-form">
                {error && (
                  <div className="auth-error-box animate-pulse">
                    ! ERROR: {error}
                  </div>
                )}
                {success && (
                  <div className="auth-success-box">
                    SUCCESS: {success}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="new-username-input">RENAME USERNAME</label>
                  <input
                    id="new-username-input"
                    type="text"
                    placeholder="ENTER NEW USERNAME"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="pixel-input"
                    disabled={loading}
                  />
                  <div className="setup-guide-text">
                    Rule: 3-20 characters. A-Z, 0-9, and underscore (_) only.
                  </div>
                </div>

                <button type="submit" className="restart-btn auth-submit-btn" disabled={loading}>
                  {loading ? "SAVING..." : "UPDATE SYSTEM USERNAME"}
                </button>
              </form>

              <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "2px dashed var(--border-color)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontFamily: "var(--font-pixel)", fontSize: "0.55rem", color: "var(--color-secondary)", letterSpacing: "1px" }}>
                  ACCOUNT MANAGEMENT
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="restart-btn auth-logout-btn"
                  style={{ backgroundColor: "#ff3b30", color: "#ffffff" }}
                >
                  LOG OUT / SIGN OUT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
