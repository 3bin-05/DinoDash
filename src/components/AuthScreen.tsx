import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebase";
import { useAuth } from "../context/AuthContext";

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("FILL ALL FIELDS");
      setLoading(false);
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError("PASSWORDS MISMATCH");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      // Clean up common error codes into retro text
      if (err.code === "auth/invalid-credential") {
        setError("INVALID CREDENTIALS");
      } else if (err.code === "auth/email-already-in-use") {
        setError("EMAIL IN USE");
      } else if (err.code === "auth/weak-password") {
        setError("PASSWORD TOO WEAK");
      } else if (err.code === "auth/invalid-email") {
        setError("INVALID EMAIL FORMAT");
      } else {
        setError("AUTH ERROR. TRY AGAIN.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError("GOOGLE SIGN IN FAILED");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="game-wrapper day">
      <div className="auth-box">
        <div className="auth-header">
          <div className="game-title">DINODASH</div>
          <div className="auth-subtitle">AUTHENTICATION CORE</div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${!isSignUp ? "active" : ""}`}
            onClick={() => {
              setIsSignUp(false);
              setError("");
            }}
          >
            SIGN IN
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${isSignUp ? "active" : ""}`}
            onClick={() => {
              setIsSignUp(true);
              setError("");
            }}
          >
            SIGN UP
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error-box animate-pulse">
              ! ERROR: {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">EMAIL ADDRESS</label>
            <input
              id="email"
              type="email"
              placeholder="ENTER EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pixel-input"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">PASSWORD</label>
            <input
              id="password"
              type="password"
              placeholder="ENTER PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pixel-input"
              disabled={loading}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <label htmlFor="confirmPassword">CONFIRM PASSWORD</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="RE-ENTER PASSWORD"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pixel-input"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}

          <button type="submit" className="restart-btn auth-submit-btn" disabled={loading}>
            {loading ? "PROCESSING..." : isSignUp ? "CREATE ACCOUNT" : "SIGN IN"}
          </button>
        </form>

        <div className="auth-divider">
          <span className="divider-line"></span>
          <span className="divider-text">OR</span>
          <span className="divider-line"></span>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="google-signin-btn"
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.377-2.87-6.377-6.38 0-3.51 2.867-6.38 6.377-6.38 1.6 0 3.05.59 4.17 1.56l3.22-3.22C19.34 2.15 16.03 1 12.24 1 5.86 1 .7 6.16.7 12.54s5.16 11.54 11.54 11.54c6.68 0 11.11-4.7 11.11-11.3 0-.7-.07-1.3-.18-1.9H12.24z" />
          </svg>
          SIGN IN WITH GOOGLE
        </button>
      </div>
    </div>
  );
};
