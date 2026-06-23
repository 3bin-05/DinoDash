import { collection, query, orderBy, where, limit } from "firebase/firestore";
import { db } from "./firebase";

export interface ScoreEntry {
  userId: string;
  username: string;
  score: number;
  timestamp?: any;
}

// Client-side deduplication: keeps only the highest score for each unique userId.
// Input array must already be sorted by score DESC for this to work correctly.
export function deduplicateScores(scores: ScoreEntry[]): ScoreEntry[] {
  const seen = new Set<string>();
  const deduped: ScoreEntry[] = [];
  for (const s of scores) {
    if (!seen.has(s.userId)) {
      seen.add(s.userId);
      deduped.push(s);
    }
  }
  return deduped;
}

// Helper: Get today's midnight in LOCAL time as a Date
export function getTodayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Get 7 days ago at midnight (LOCAL time)
export function getSevenDaysAgoMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6); // includes today + last 6 days = 7 days
  return d;
}

// ------------------------------------------------------------------
// ALGORITHM 1: DAILY LEADERBOARD
//   Query the `scores` collection for all documents with timestamp
//   >= today at midnight (local). Fetch many, sort by score DESC on
//   client, deduplicate by userId to keep each user's best daily run.
// ------------------------------------------------------------------
export function getDailyScoresQuery() {
  const collRef = collection(db, "scores");
  const todayMidnight = getTodayMidnight();
  return query(
    collRef,
    where("timestamp", ">=", todayMidnight),
    orderBy("timestamp", "desc"),
    limit(2000)
  );
}

// ------------------------------------------------------------------
// ALGORITHM 2: WEEKLY LEADERBOARD
//   Query the `scores` collection for the last 7 days. Fetch many,
//   sort by score DESC on client, deduplicate by userId to keep each
//   user's best run in the past 7 days.
// ------------------------------------------------------------------
export function getWeeklyScoresQuery() {
  const collRef = collection(db, "scores");
  const sevenDaysAgo = getSevenDaysAgoMidnight();
  return query(
    collRef,
    where("timestamp", ">=", sevenDaysAgo),
    orderBy("timestamp", "desc"),
    limit(2000)
  );
}

// ------------------------------------------------------------------
// ALGORITHM 3: ALL-TIME LEADERBOARD
//   Query the `users` collection ordered by `bestScore` DESC.
//   Timestamps are NOT considered — only the all-time best score
//   stored on each user's profile document matters here.
//   Each user only has one profile document, so no deduplication needed.
// ------------------------------------------------------------------
export function getAllTimeScoresQuery() {
  const collRef = collection(db, "users");
  return query(collRef, orderBy("bestScore", "desc"), limit(200));
}
