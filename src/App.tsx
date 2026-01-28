import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import TheAnvil from "./components/TheAnvil";
import { HomeIcon, AnvilIcon, SettingsIcon } from "./icons";
import { useChangelog } from "./hooks/useChangelog";
import { useAutoUpdater } from "./hooks/useAutoUpdater";
import "./App.css";

type Tab = "dashboard" | "anvil";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [lifetimeCount, setLifetimeCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const { changelog, loading: changelogLoading } = useChangelog();
  const { isChecking, checkForUpdates } = useAutoUpdater();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveTab("dashboard");
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveTab("anvil");
        } else if (e.key === ",") {
          e.preventDefault();
          setShowSettings(!showSettings);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [showSettings]);

  const updateLifetimeCount = (count: number) => {
    setLifetimeCount((prev) => prev + count);
  };

  return (
    <div className="app-container">
      {/* Header with centered logo */}
      <header className="app-header">
        <div className="logo-container">
          <h1 className="app-title">Editor Workshop</h1>
          <p className="app-subtitle">
            Professional Tools for Creative Editors
          </p>
        </div>

        {/* Settings icon in top-right */}
        <button
          className="settings-button"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings (Cmd+,)"
        >
          <SettingsIcon />
        </button>
      </header>

      {/* Settings Overlay */}
      {showSettings && (
        <div
          className="settings-overlay"
          onClick={() => setShowSettings(false)}
        >
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>Settings</h2>
              <button
                className="close-button"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>
            <div className="settings-content">
              <div className="settings-section">
                ƒ<h3>About</h3>
                <p>Editor Workshop v0.1.5</p>
                <p>Professional tools for video editors</p>
                <button
                  className="changelog-button"
                  onClick={checkForUpdates}
                  disabled={isChecking}
                  style={{ marginTop: "12px" }}
                >
                  {isChecking ? "Checking..." : "Check for Updates"}
                </button>
              </div>

              <div className="settings-section">
                <h3>Keyboard Shortcuts</h3>
                <ul className="shortcuts-list">
                  <li>
                    <kbd>Cmd+1</kbd> Dashboard
                  </li>
                  <li>
                    <kbd>Cmd+2</kbd> The Anvil
                  </li>
                  <li>
                    <kbd>Cmd+,</kbd> Settings
                  </li>
                </ul>
              </div>

              <div className="settings-section">
                <h3>Preferences</h3>
                <label className="settings-checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>Check for updates automatically</span>
                </label>
                <label className="settings-checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>Show notification when update is available</span>
                </label>
              </div>

              <div className="settings-section">
                <button
                  className="changelog-button"
                  onClick={() => setShowChangelog(!showChangelog)}
                >
                  {showChangelog ? "Hide" : "View"} Changelog
                </button>
                {showChangelog && (
                  <pre className="changelog-content">
                    {changelogLoading ? "Loading..." : changelog}
                  </pre>
                )}
              </div>

              <div className="settings-section">
                <p
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: "12px",
                    margin: 0,
                  }}
                >
                  v0.1.5
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <HomeIcon className="tab-icon" />
          <span>Dashboard</span>
        </button>

        <button
          className={`tab-button ${activeTab === "anvil" ? "active" : ""}`}
          onClick={() => setActiveTab("anvil")}
        >
          <AnvilIcon className="tab-icon" />
          <span>The Anvil</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === "dashboard" && (
          <Dashboard lifetimeCount={lifetimeCount} />
        )}
        {activeTab === "anvil" && (
          <TheAnvil onUpdateCount={updateLifetimeCount} />
        )}
      </main>
    </div>
  );
}

export default App;
