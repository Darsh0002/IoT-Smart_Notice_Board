import React from 'react';
import {
  Send,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Gauge,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Info,
  Radio,
} from 'lucide-react';

export const NoticeCard = ({
  notice,
  isCurrentlyDisplayed,
  onDisplayOnBoard,
  onEdit,
  onDelete,
  onSyncBLE,
  bleState,
  isAdmin = false,
  onRequireAuth,
}) => {
  const isUrgent = notice.priority === 'Urgent';
  const isImportant = notice.priority === 'Important';

  // Dates
  const now = new Date();
  const expiryDate = new Date(notice.expiresAt);
  const scheduledDate = notice.scheduledFor ? new Date(notice.scheduledFor) : null;
  const isExpired = expiryDate < now || notice.status === 'expired';
  const isScheduled = (scheduledDate && scheduledDate > now) || notice.status === 'scheduled';

  const getTimeRemaining = () => {
    if (isExpired) return 'Expired';
    if (isScheduled) return `Goes live: ${scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const diffHours = Math.round((expiryDate - now) / (1000 * 60 * 60));
    if (diffHours < 24) return `Expires in ${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    return `Expires in ${diffDays}d`;
  };

  const handlePushClick = () => {
    if (!isAdmin) {
      onRequireAuth('Admin login is required to push notices to the OLED display');
      return;
    }
    onDisplayOnBoard(notice);
    if (bleState?.isConnected) {
      onSyncBLE(notice);
    }
  };

  const handleEditClick = () => {
    if (!isAdmin) {
      onRequireAuth('Admin login is required to edit notices');
      return;
    }
    onEdit(notice);
  };

  const handleDeleteClick = () => {
    if (!isAdmin) {
      onRequireAuth('Admin login is required to delete notices');
      return;
    }
    onDelete(notice._id);
  };

  return (
    <div
      className={`glass-panel notice-card ${isLiveOnBoard ? 'notice-active-live' : ''} ${
        isCurrentlyDisplayed ? 'currently-displayed' : ''
      } ${isUrgent ? 'border-urgent' : isImportant ? 'border-important' : ''} ${
        isExpired ? 'notice-expired-dim' : ''}`}
    >
      {/* Notice Card Header */}
      <div className="card-header">
        <div className="header-tags">
          {/* Priority Badge */}
          <span
            className={`badge-priority ${
              isUrgent
                ? 'badge-urgent'
                : isImportant
                ? 'badge-important'
                : 'badge-normal'
            }`}
          >
            {isUrgent ? <AlertOctagon size={12} /> : isImportant ? <AlertTriangle size={12} /> : <Info size={12} />}
            {notice.priority}
          </span>

          {/* Category */}
          <span className="badge-category">{notice.category || 'General'}</span>

          {/* Status Badge */}
          <span
            className={`badge-status ${
              isExpired ? 'expired' : isScheduled ? 'scheduled' : 'active'
            }`}
          >
            {isExpired ? 'Expired' : isScheduled ? 'Scheduled' : 'Active'}
          </span>
        </div>

        {/* Sync Status Badge */}
        {isLiveOnBoard && (
          <div className="synced-badge live-board-badge" title="Currently active on the ESP32 OLED board">
            <Radio size={12} className="pulse-icon" />
            <span>Live on Board</span>
          </div>
        )}
        {!isLiveOnBoard && notice.isSyncedToDevice && (
          <div className="synced-badge" title="Previously synced to ESP32 OLED Display">
            <CheckCircle2 size={13} className="text-cyan" />
            <span>On OLED</span>
          </div>
        )}
      </div>

      {/* Notice Title */}
      <h3 className="card-title">{notice.title}</h3>

      {/* Notice Content */}
      <p className="card-content">{notice.content}</p>

      {/* Meta Footer */}
      <div className="card-meta">
        <div className="meta-item">
          <Clock size={12} />
          <span>{getTimeRemaining()}</span>
        </div>
        <div className="meta-item">
          <Gauge size={12} />
          <span>{notice.scrollSpeed || 'Medium'}</span>
        </div>
        <div className="meta-item">
          <Calendar size={12} />
          <span>
            {isScheduled
              ? `Starts: ${scheduledDate.toLocaleDateString()}`
              : new Date(notice.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="card-actions">
        {/* Send to OLED Board */}
        <button
          className={`btn-send-board ${isLiveOnBoard ? 'active-display' : ''} ${isExpired ? 'expired-btn' : ''}`}
          onClick={handlePushClick}
          title={isAdmin ? 'Display notice on ESP32 OLED' : 'Admin Login Required'}
        >
          {isLiveOnBoard ? (
            <>
              <Radio size={13} className="pulse-icon" />
              <span>{isCurrentlyDisplayed ? 'Selected on Board' : 'Sync to Board'}</span>
            </>
          ) : isScheduled ? (
            <>
              <Calendar size={13} />
              <span>Push to Board Now</span>
            </>
          ) : isExpired ? (
            <>
              <Send size={13} />
              <span>Re-post Notice</span>
            </>
          ) : (
            <>
              <Send size={13} />
              <span>Push to Board</span>
            </>
          )}
        </button>

        <div className="actions-right">
          <button
            className="btn-icon"
            onClick={handleEditClick}
            title={isAdmin ? 'Edit Notice' : 'Admin Login Required'}
          >
            <Edit2 size={14} />
          </button>
          <button
            className="btn-icon btn-icon-delete"
            onClick={handleDeleteClick}
            title={isAdmin ? 'Delete Notice' : 'Admin Login Required'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <style>{`
        .notice-card {
          padding: 18px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          transition: all 0.25s ease;
          background: rgba(16, 24, 42, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .notice-card:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 240, 255, 0.3);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        /* Active live — distinct per-priority glow */
        .notice-card.notice-active-live {
          border-color: rgba(0, 240, 255, 0.35);
          background: rgba(0, 240, 255, 0.04);
        }

        .notice-card.notice-active-live.border-urgent {
          border-color: rgba(244, 63, 94, 0.55);
          background: rgba(244, 63, 94, 0.05);
          box-shadow: 0 0 20px rgba(244, 63, 94, 0.13), inset 0 0 14px rgba(244, 63, 94, 0.04);
        }

        .notice-card.notice-active-live.border-important {
          border-color: rgba(245, 158, 11, 0.55);
          background: rgba(245, 158, 11, 0.04);
          box-shadow: 0 0 18px rgba(245, 158, 11, 0.1), inset 0 0 12px rgba(245, 158, 11, 0.03);
        }

        .notice-card.currently-displayed {
          outline: 1.5px solid rgba(0, 240, 255, 0.6);
          box-shadow: 0 0 26px rgba(0, 240, 255, 0.25), inset 0 0 16px rgba(0, 240, 255, 0.06);
        }

        /* Expired notices are visually dimmed */
        .notice-card.notice-expired-dim {
          opacity: 0.5;
          background: rgba(15, 20, 35, 0.45);
          border-color: rgba(255, 255, 255, 0.05);
        }

        .notice-card.border-urgent {
          border-left: 3px solid var(--priority-urgent);
        }

        .notice-card.border-important {
          border-left: 3px solid var(--priority-important);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .header-tags {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .synced-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--accent-cyan);
          background: rgba(0, 240, 255, 0.08);
          border: 1px solid rgba(0, 240, 255, 0.25);
          padding: 2px 8px;
          border-radius: 12px;
        }

        /* Live on Board badge — green pulsing for normal/high, red for urgent, amber for important */
        .live-board-badge {
          color: #4ade80;
          background: rgba(74, 222, 128, 0.1);
          border-color: rgba(74, 222, 128, 0.35);
          animation: livePulse 2.5s ease-in-out infinite;
        }

        .notice-card.notice-active-live.border-urgent .live-board-badge {
          color: #fb7185;
          background: rgba(251, 113, 133, 0.12);
          border-color: rgba(251, 113, 133, 0.4);
        }

        .notice-card.notice-active-live.border-important .live-board-badge {
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.12);
          border-color: rgba(251, 191, 36, 0.4);
        }

        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }

        .expired-btn { opacity: 0.55; }

        .card-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-main);
          letter-spacing: -0.01em;
          line-height: 1.3;
        }

        .card-content {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.55;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .card-meta {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 6px;
          font-size: 11px;
          color: var(--text-dim);
          font-family: var(--font-mono);
          flex-wrap: wrap;
        }

        .meta-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          margin-top: 2px;
        }

        .btn-send-board {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: var(--text-main);
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-send-board:hover {
          background: rgba(0, 240, 255, 0.15);
          border-color: rgba(0, 240, 255, 0.4);
          color: var(--accent-cyan);
        }

        .btn-send-board.active-display {
          background: rgba(0, 240, 255, 0.18);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
        }

        .pulse-icon {
          animation: pulse 1.5s infinite;
        }

        .actions-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-icon {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-main);
        }

        .btn-icon-delete:hover {
          background: rgba(244, 63, 94, 0.2);
          border-color: rgba(244, 63, 94, 0.4);
          color: #fb7185;
        }
      `}</style>
    </div>
  );
};
