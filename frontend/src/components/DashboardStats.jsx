import React from 'react';
import { Layers, AlertTriangle, CheckCircle, Clock, Radio } from 'lucide-react';

export const DashboardStats = ({ stats, bleState }) => {
  return (
    <div className="stats-grid">
      {/* Total Notices */}
      <div className="glass-panel stat-card">
        <div className="stat-icon-wrap icon-blue">
          <Layers size={22} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Total Notices</span>
          <div className="stat-value">{stats?.totalNotices || 0}</div>
          <span className="stat-sub">Managed in database</span>
        </div>
      </div>

      {/* Active on Board */}
      <div className="glass-panel stat-card stat-card-active">
        <div className="stat-icon-wrap icon-green">
          <CheckCircle size={22} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Active on Board</span>
          <div className="stat-value text-green">{stats?.activeNotices || 0}</div>
          <span className="stat-sub">Live in notice rotation</span>
        </div>
      </div>

      {/* Urgent Notices */}
      <div className="glass-panel stat-card stat-card-urgent">
        <div className="stat-icon-wrap icon-red">
          <AlertTriangle size={22} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Urgent Alerts</span>
          <div className="stat-value text-red">{stats?.urgentNotices || 0}</div>
          <span className="stat-sub">High priority override</span>
        </div>
      </div>

      {/* Expired Notices */}
      <div className="glass-panel stat-card">
        <div className="stat-icon-wrap icon-amber">
          <Clock size={22} />
        </div>
        <div className="stat-content">
          <span className="stat-label">Expired / Archive</span>
          <div className="stat-value text-muted">{stats?.expiredNotices || 0}</div>
          <span className="stat-sub">Auto-filtered by time</span>
        </div>
      </div>

      {/* BLE Hardware Status */}
      <div className="glass-panel stat-card stat-card-ble">
        <div className={`stat-icon-wrap ${bleState?.isConnected ? 'icon-cyan' : 'icon-gray'}`}>
          <Radio size={22} />
        </div>
        <div className="stat-content">
          <span className="stat-label">ESP32 BLE Link</span>
          <div className="stat-value text-cyan">
            {bleState?.isConnected ? (bleState.isSimulated ? 'Virtual' : 'Hardware') : 'Standby'}
          </div>
          <span className="stat-sub">
            {bleState?.isConnected ? 'Transmitting enabled' : 'Ready to pair'}
          </span>
        </div>
      </div>

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          position: relative;
          overflow: hidden;
        }

        .stat-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .icon-blue {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .icon-green {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .icon-red {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .icon-amber {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .icon-cyan {
          background: rgba(0, 240, 255, 0.15);
          color: #00f0ff;
          border: 1px solid rgba(0, 240, 255, 0.3);
          box-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
        }

        .icon-gray {
          background: rgba(148, 163, 184, 0.1);
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .stat-value {
          font-family: var(--font-heading);
          font-size: 1.6rem;
          font-weight: 800;
          line-height: 1.2;
          color: #f8fafc;
        }

        .text-green { color: #34d399; }
        .text-red { color: #f43f5e; }
        .text-cyan { color: #00f0ff; }
        .text-muted { color: #94a3b8; }

        .stat-sub {
          font-size: 0.72rem;
          color: #64748b;
        }
      `}</style>
    </div>
  );
};
