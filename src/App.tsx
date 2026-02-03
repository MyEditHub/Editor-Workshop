import { useState, useEffect } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
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

// Window sizes for compact launcher behavior
const COMPACT_SIZE = { width: 600, height: 280 };
const EXPANDED_SIZE = { width: 1200, height: 800 };

function App() {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [lifetimeCount, setLifetimeCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabledState] = useState(isAnalyticsEnabled());
  const { changelog, loading: changelogLoading } = useChangelog();
  const { isChecking, checkResult, checkForUpdates } = useAutoUpdater();
  const analytics = useAnalytics();

  // Track app launch
  useEffect(() => {
    analytics.trackAppLaunched();
  }, []);

  // Resize window based on compact/expanded state
  useEffect(() => {
    const resizeWindow = async () => {
      const win = getCurrentWindow();
      if (activeTab === null) {
        await win.setSize(new LogicalSize(COMPACT_SIZE.width, COMPACT_SIZE.height));
      } else {
        await win.setSize(new LogicalSize(EXPANDED_SIZE.width, EXPANDED_SIZE.height));
      }
    };
    resizeWindow();
  }, [activeTab]);

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
                <p>Editor Workshop v0.3.3</p>
                <p>Professional tools for video editors</p>
                <button
                  className="changelog-button"
                  onClick={checkForUpdates}
                  disabled={isChecking}
                  style={{ marginTop: "12px" }}
                >
                  {isChecking ? "Checking..." : "Check for Updates"}
                </button>
                {checkResult && (
                  <p
                    style={{
                      marginTop: "8px",
                      fontSize: "13px",
                      color:
                        checkResult === "up-to-date"
                          ? "#4caf50"
                          : checkResult === "error"
                          ? "#f44336"
                          : "#3db8d4",
                    }}
                  >
                    {checkResult === "up-to-date" && "You're up to date!"}
                    {checkResult === "update-available" && "Update available!"}
                    {checkResult === "error" && "Failed to check for updates"}
                  </p>
                )}
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
                  v0.3.3
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

      {/* Main Content - only shown when a tab is selected */}
      {activeTab !== null && (
        <main className="main-content">
          <div style={{ display: activeTab === "dashboard" ? "block" : "none" }}>
            <Dashboard lifetimeCount={lifetimeCount} />
          </div>
          <div style={{ display: activeTab === "anvil" ? "block" : "none" }}>
            <TheAnvil onUpdateCount={updateLifetimeCount} />
          </div>
          <div style={{ display: activeTab === "smelter" ? "block" : "none" }}>
            <TheSmelter onUpdateCount={updateLifetimeCount} />
          </div>
        </main>
      )}
    </div>
    </ErrorBoundary>
  );
}

export default App;
