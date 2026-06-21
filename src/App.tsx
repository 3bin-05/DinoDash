import { DinoGame } from "./components/DinoGame";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthScreen } from "./components/AuthScreen";
import { UsernameSetupScreen } from "./components/UsernameSetupScreen";

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="game-wrapper day">
        <div className="retro-loading-box">
          <div className="retro-loading-text animate-pulse">CONNECTING TO DATABASE...</div>
          <div className="retro-loading-sub">RETRIEVING DINO DASH SYSTEM RECORDS</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!profile) {
    return <UsernameSetupScreen />;
  }

  return <DinoGame />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
