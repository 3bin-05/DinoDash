import { collection, query, orderBy, where, limit } from "firebase/firestore";
import { db } from "./firebase";

export interface ScoreEntry {
  userId: string;
  username: string;
  score: number;
  timestamp: any;
}

// Client-side deduplication: keeps only the highest score for each unique userId
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

// Helper: Get today's midnight local time
export function getTodayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Get last Monday's midnight local time
export function getLastMondayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // ISO day: Monday=1 ... Sunday=7. In getDay(), Sunday is 0.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Firestore Queries:
// To avoid requiring complex composite indexes on the database server, we query 
// the latest records within the time frame, and sort them by score DESC on the client.

export function getAllTimeScoresQuery() {
  const collRef = collection(db, "scores");
  // All-time needs no date range, so we can sort by score directly in Firestore
  return query(collRef, orderBy("score", "desc"), limit(200));
}

export function getWeeklyScoresQuery() {
  const collRef = collection(db, "scores");
  const lastMonday = getLastMondayMidnight();
  // Retrieve the latest 1000 scores from this week. Client will sort them by score.
  return query(
    collRef,
    where("timestamp", ">=", lastMonday),
    orderBy("timestamp", "desc"),
    limit(1000)
  );
}

export function getDailyScoresQuery() {
  const collRef = collection(db, "scores");
  const today = getTodayMidnight();
  // Retrieve the latest 1000 scores from today. Client will sort them by score.
  return query(
    collRef,
    where("timestamp", ">=", today),
    orderBy("timestamp", "desc"),
    limit(1000)
  );
}
