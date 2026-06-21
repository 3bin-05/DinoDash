import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../utils/firebase";

export interface DailyChallengeStatus {
  date: string;
  progress: number;
  completed: boolean;
}

export interface UserProfile {
  username: string;
  createdAt: any;
  bestScore: number;
  totalGames: number;
  totalDistance: number;
  selectedSkin: string;
  achievements: string[];
  unlockedSkins: string[];
  giftsCollected?: number;
  lastDailyChallengeDate?: string;
  dailyChallengeStatus?: DailyChallengeStatus;
  dailyChallengesCompletedCount?: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loadingProfile: boolean;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);

  const fetchProfile = async (uid: string) => {
    setLoadingProfile(true);
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error("Error fetching user profile:", e);
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loadingProfile,
        logout,
        signInWithGoogle,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
