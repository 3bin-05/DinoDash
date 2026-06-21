import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDSUr9Ooql1XBatZCzXOtXu8S_jNlNc9TY",
  authDomain: "dinogame-fb49d.firebaseapp.com",
  projectId: "dinogame-fb49d",
  storageBucket: "dinogame-fb49d.firebasestorage.app",
  messagingSenderId: "1072307096876",
  appId: "1:1072307096876:web:a1549f6124079ba659b089",
  measurementId: "G-V67YBPBE30"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Helper: returns the current UTC date key format (YYYY-MM-DD)
export function getDateKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`;
}

// Helper: returns the current UTC week key format (YYYY-W[weekNumber])
export function getWeekKey(): string {
  const d = new Date();
  const oneJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const result = Math.ceil((d.getUTCDay() + 1 + numberOfDays) / 7);
  return `${d.getUTCFullYear()}-W${result}`;
}
