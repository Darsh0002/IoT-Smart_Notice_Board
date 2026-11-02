import React, { useState, useEffect } from 'react';
import { X, History, Filter, Radio, User, Calendar, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export const AuditHistory = ({ isOpen, onClose, onReSendNotice }) => {
  const [logs, setLogs] = useState([]);
  const [filterAction, setFilterAction] = useState('All');
  const [loading, setLoading] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getLogs({ action: filterAction, limit: 100 });
      if (res.success) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, filterAction]);

  if (!isOpen) return null;

  const getActionBadge = (action) => {
    switch (action) {
      case 'NOTICE_SYNCED_BLE':
        return <span className="log-badge badge-cyan"><Radio size={12} /> BLE Synced</span>;
      case 'NOTICE_CREATED':
        return <span className="log-badge badge-green">Created</span>;
      case 'NOTICE_UPDATED':
        return <span className="log-badge badge-amber">Updated</span>;
      case 'NOTICE_DELETED':
        return <span className="log-badge badge-red">Deleted</span>;
      case 'ADMIN_LOGIN':
        return <span className="log-badge badge-purple"><User size={12} /> Admin Auth</span>;
      default:
        return <span className="log-badge badge-gray">{action}</span>;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="flex items-center gap-2">
              <History size={20} className="text-cyan" />
              <h2>Notice History & Audit Trail</h2>
            </div>
            <span className="modal-sub">
              Historical record of notice dispatches, BLE transmissions, and admin activities
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Filter bar */}
        <div className="history-filter-bar">
          <div className="filter-group">
            <Filter size={14} className="text-muted" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="history-select"
            >
              <option value="All">All Events ({logs.length})</option>
              <option value="NOTICE_SYNCED_BLE">BLE Transmissions Only</option>
              <option value="NOTICE_CREATED">Notices Created</option>
              <option value="NOTICE_UPDATED">Notices Updated</option>
              <option value="NOTICE_DELETED">Notices Deleted</option>
              <option value="ADMIN_LOGIN">Admin Authentication</option>
            </select>
          </div>

          <button className="btn-icon" onClick={fetchLogs} title="Refresh Logs">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Log List */}
        <div className="history-list">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log._id} className="history-item">
                <div className="history-item-top">
                  <div className="item-meta-left">
                    {getActionBadge(log.action)}
                    {log.priority && (
                      <span className={`badge-priority badge-${log.priority.toLowerCase()}`}>
                        {log.priority}
                      </span>
                    )}
                    <span className="log-user">By {log.user || 'Admin'}</span>
                  </div>
                  <div className="item-meta-right">
                    <Calendar size={12} />
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="history-item-body">
                  <div className="log-details">{log.details}</div>
                  {log.deviceName && (
                    <div className="log-device">
                      <Radio size={12} className="text-cyan" />
                      <span>Target: {log.deviceName}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-history">
              <History size={36} className="text-muted" />
              <p>No audit events recorded under this filter.</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .history-modal-content {
          max-width: 680px;
        }

        .history-filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background: rgba(15, 23, 42, 0.5);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .history-select {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #f8fafc;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          outline: none;
        }

        .history-list {
          padding: 16px 24px;
          max-height: 480px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-item {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: border-color 0.15s;
        }

        .history-item:hover {
          border-color: rgba(0, 240, 255, 0.25);
        }

        .history-item-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.775rem;
          gap: 10px;
          flex-wrap: wrap;
        }

        .item-meta-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .item-meta-right {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #64748b;
          font-family: var(--font-mono);
          font-size: 0.725rem;
        }

        .log-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.725rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .badge-cyan { background: rgba(0, 240, 255, 0.15); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); }
        .badge-green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-amber { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .badge-red { background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); }
        .badge-purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }
        .badge-gray { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }

        .log-user {
          color: #94a3b8;
          font-size: 0.75rem;
        }

        .history-item-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .log-details {
          font-size: 0.85rem;
          color: #f1f5f9;
          line-height: 1.45;
        }

        .log-device {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.725rem;
          color: #94a3b8;
          font-family: var(--font-mono);
        }

        .empty-history {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
      `}</style>
    </div>
  );
};
