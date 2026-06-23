import React, { useState, useEffect } from "react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import {
  getAllTimeScoresQuery,
  getWeeklyScoresQuery,
  getDailyScoresQuery,
  deduplicateScores
} from "../utils/leaderboardQueries";
import type { ScoreEntry } from "../utils/leaderboardQueries";

export const LeaderboardPanel: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "alltime">("daily");
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    setScores([]);

    let q;
    if (activeTab === "daily") {
      q = getDailyScoresQuery();
    } else if (activeTab === "weekly") {
      q = getWeeklyScoresQuery();
    } else {
      q = getAllTimeScoresQuery();
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawEntries: ScoreEntry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          rawEntries.push({
            userId: data.userId || "",
            username: data.username || "anonymous",
            score: Number(data.score) || 0,
            timestamp: data.timestamp
          });
        });

        // 1. If daily/weekly, we sort the raw entries by score DESC on the client
        if (activeTab === "daily" || activeTab === "weekly") {
          rawEntries.sort((a, b) => b.score - a.score);
        }

        // 2. Deduplicate scores client-side to keep only each user's personal best
        const deduped = deduplicateScores(rawEntries);

        // 3. Keep top 100 entries for display
        setScores(deduped.slice(0, 100));
        setLoading(false);
      },
      (error) => {
        console.error(`LeaderboardPanel fetch error for tab ${activeTab}:`, error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTab]);

  return (
    <div className="leaderboard-panel-box retro-panel">
      <div className="leaderboard-panel-tabs">
        <button
          className={`leaderboard-panel-tab-btn ${activeTab === "daily" ? "active" : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          DAILY
        </button>
        <button
          className={`leaderboard-panel-tab-btn ${activeTab === "weekly" ? "active" : ""}`}
          onClick={() => setActiveTab("weekly")}
        >
          WEEKLY
        </button>
        <button
          className={`leaderboard-panel-tab-btn ${activeTab === "alltime" ? "active" : ""}`}
          onClick={() => setActiveTab("alltime")}
        >
          ALL-TIME
        </button>
      </div>

      <div className="leaderboard-panel-content">
        {loading ? (
          <div className="leaderboard-panel-loading animate-pulse">
            LOADING LEADERBOARD...
          </div>
        ) : scores.length === 0 ? (
          <div className="leaderboard-panel-empty">
            NO RUNS LOGGED
          </div>
        ) : (
          <div className="leaderboard-panel-scroll-area">
            <table className="leaderboard-panel-table">
              <thead>
                <tr className="leaderboard-panel-header-row">
                  <th className="leaderboard-panel-cell rank-col">RANK</th>
                  <th className="leaderboard-panel-cell user-col">USER</th>
                  <th className="leaderboard-panel-cell score-col">SCORE</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry, index) => {
                  const isCurrentUser = user && entry.userId === user.uid;
                  return (
                    <tr
                      key={`${entry.userId}-${index}`}
                      className={`leaderboard-panel-row ${isCurrentUser ? "highlight-row" : ""}`}
                    >
                      <td className="leaderboard-panel-cell rank-col">#{index + 1}</td>
                      <td className="leaderboard-panel-cell user-col">
                        @{entry.username} {isCurrentUser && "(YOU)"}
                      </td>
                      <td className="leaderboard-panel-cell score-col">{entry.score.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
