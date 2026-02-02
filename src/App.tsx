import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import TheAnvil from "./components/TheAnvil";
import TheSmelter from "./components/TheSmelter";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HomeIcon, AnvilIcon, MusicIcon, SettingsIcon } from "./icons";
import { useChangelog } from "./hooks/useChangelog";
import { useAutoUpdater } from "./hooks/useAutoUpdater";
import { useAnalytics, isAnalyticsEnabled, setAnalyticsEnabled } from "./hooks/useAnalytics";
import "./App.css";

type Tab = "dashboard" | "anvil" | "smelter";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [lifetimeCount, setLifetimeCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabledState] = useState(isAnalyticsEnabled());
  const { changelog, loading: changelogLoading } = useChangelog();
  const { isChecking, checkForUpdates } = useAutoUpdater();
  const analytics = useAnalytics();

  // Track app launch
  useEffect(() => {
    analytics.trackAppLaunched();
  }, []);

  // Track tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    analytics.trackToolOpened(tab);
  };

  // Toggle analytics preference
  const handleAnalyticsToggle = (enabled: boolean) => {
    setAnalyticsEnabledState(enabled);
    setAnalyticsEnabled(enabled);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "1") {
          e.preventDefault();
          handleTabChange("dashboard");
        } else if (e.key === "2") {
          e.preventDefault();
          handleTabChange("anvil");
        } else if (e.key === "3") {
          e.preventDefault();
          handleTabChange("smelter");
        } else if (e.key === ",") {
          e.preventDefault();
          setShowSettings(!showSettings);
          if (!showSettings) analytics.trackSettingsOpened();
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
    <ErrorBoundary>
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
          onClick={() => {
            if (!showSettings) analytics.trackSettingsOpened();
            setShowSettings(!showSettings);
          }}
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
                <h3>About</h3>
                <p>Editor Workshop v0.3.1</p>
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
                    <kbd>Cmd+3</kbd> The Smelter
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
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={analyticsEnabled}
                    onChange={(e) => handleAnalyticsToggle(e.target.checked)}
                  />
                  <span>Help improve Editor Workshop by sending anonymous usage data</span>
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
                  v0.3.1
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
          onClick={() => handleTabChange("dashboard")}
        >
          <HomeIcon className="tab-icon" />
          <span>Dashboard</span>
        </button>

        <button
          className={`tab-button ${activeTab === "anvil" ? "active" : ""}`}
          onClick={() => handleTabChange("anvil")}
        >
          <AnvilIcon className="tab-icon" />
          <span>The Anvil</span>
        </button>

        <button
          className={`tab-button ${activeTab === "smelter" ? "active" : ""}`}
          onClick={() => handleTabChange("smelter")}
        >
          <MusicIcon className="tab-icon" />
          <span>The Smelter</span>
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
        {activeTab === "smelter" && <TheSmelter />}
      </main>
    </div>
    </ErrorBoundary>
  );
}

export default App;
