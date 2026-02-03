interface DashboardProps {
  lifetimeCount: number;
}

const Dashboard = ({ lifetimeCount }: DashboardProps) => {
  return (
    <div className="dashboard">
      {/* Welcome Section */}
      <section className="welcome-section">
        <h2>Welcome Back</h2>
        <p className="welcome-text">
          Your professional toolkit for video editing workflows
        </p>
      </section>

      {/* Statistics Grid */}
      <section className="stats-section">
        <h3 className="section-title">Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{lifetimeCount}</div>
            <div className="stat-label">Files Processed</div>
            <div className="stat-sublabel">All-time total</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">
              {lifetimeCount > 0 ? '100%' : '0%'}
            </div>
            <div className="stat-label">Success Rate</div>
            <div className="stat-sublabel">Completed tasks</div>
          </div>
        </div>
      </section>

      {/* Quick Tips */}
      <section className="tips-section">
        <h3 className="section-title">Quick Tips</h3>
        <div className="tips-grid">
          <div className="tip-card">
            <div className="tip-icon">⌨️</div>
            <div className="tip-text">
              <strong>Keyboard Shortcuts</strong>
              <p>Use Cmd+1, Cmd+2, Cmd+3 to switch between tools quickly</p>
            </div>
          </div>
          <div className="tip-card">
            <div className="tip-icon">🔨</div>
            <div className="tip-text">
              <strong>The Anvil</strong>
              <p>Batch upgrade Premiere Pro projects to newer versions</p>
            </div>
          </div>
          <div className="tip-card">
            <div className="tip-icon">🎵</div>
            <div className="tip-text">
              <strong>The Smelter</strong>
              <p>Organize music files by genre or mood from metadata</p>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: 'center', marginTop: '32px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
        v0.3.3
      </footer>
    </div>
  );
};

export default Dashboard;
