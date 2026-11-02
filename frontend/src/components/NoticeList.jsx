import React, { useState } from 'react';
import {
  Search,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Sparkles,
  Lock,
  PlusCircle,
  LogIn,
} from 'lucide-react';
import { NoticeCard } from './NoticeCard';

export const NoticeList = ({
  notices = [],
  activeNoticeId,
  onDisplayOnBoard,
  onEditNotice,
  onDeleteNotice,
  onSyncBLE,
  bleState,
  isAdmin = false,
  onRequireAuth,
  onOpenNewNotice,
}) => {
  const [filterPriority, setFilterPriority] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('priority'); // 'priority', 'newest', 'expiry'

  // Filter notices
  const filteredNotices = notices.filter((notice) => {
    // Search filter
    const matchesSearch =
      notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notice.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (notice.category && notice.category.toLowerCase().includes(searchQuery.toLowerCase()));

    // Priority / Status filter
    if (filterPriority === 'All') return matchesSearch;
    if (filterPriority === 'Active') return matchesSearch && notice.status === 'active';
    if (filterPriority === 'Scheduled') return matchesSearch && notice.status === 'scheduled';
    if (filterPriority === 'Expired') return matchesSearch && (notice.status === 'expired' || new Date(notice.expiresAt) < new Date());
    return matchesSearch && notice.priority === filterPriority;
  });

  // Sort notices
  const sortedNotices = [...filteredNotices].sort((a, b) => {
    if (sortBy === 'priority') {
      const weights = { Urgent: 3, Important: 2, Normal: 1 };
      return (weights[b.priority] || 0) - (weights[a.priority] || 0);
    }
    if (sortBy === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (sortBy === 'expiry') {
      return new Date(a.expiresAt) - new Date(b.expiresAt);
    }
    return 0;
  });

  const countByPriority = (priority) => notices.filter((n) => n.priority === priority).length;

  return (
    <div className="notices-container">
      {/* Admin Authorization Notice Banner (if not logged in) */}
      {!isAdmin && (
        <div className="admin-lock-banner">
          <div className="lock-banner-left">
            <Lock size={18} className="text-amber" />
            <div>
              <div className="lock-title">Public Viewing Mode</div>
              <div className="lock-desc">
                Only authenticated administrators can post, schedule, edit, delete, or transmit notices to the ESP32 OLED display.
              </div>
            </div>
          </div>
          <button
            className="btn-auth-trigger"
            onClick={() => onRequireAuth('Please sign in as Admin to manage notices')}
          >
            <LogIn size={14} />
            <span>Sign In as Admin</span>
          </button>
        </div>
      )}

      {/* Controls Bar */}
      <div className="list-controls-bar">
        {/* Search */}
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search notices by keyword or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        {/* Sort By Dropdown */}
        <div className="sort-box">
          <span className="sort-label">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="priority">Priority (Urgent First)</option>
            <option value="newest">Newest First</option>
            <option value="expiry">Expiration Soonest</option>
          </select>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`tab-btn ${filterPriority === 'All' ? 'active' : ''}`}
          onClick={() => setFilterPriority('All')}
        >
          All ({notices.length})
        </button>

        <button
          className={`tab-btn ${filterPriority === 'Active' ? 'active' : ''}`}
          onClick={() => setFilterPriority('Active')}
        >
          <CheckCircle size={13} className="text-green" />
          Active ({notices.filter((n) => n.status === 'active').length})
        </button>

        <button
          className={`tab-btn ${filterPriority === 'Scheduled' ? 'active' : ''}`}
          onClick={() => setFilterPriority('Scheduled')}
        >
          <Calendar size={13} className="text-cyan" />
          Scheduled ({notices.filter((n) => n.status === 'scheduled').length})
        </button>

        <button
          className={`tab-btn tab-urgent ${filterPriority === 'Urgent' ? 'active' : ''}`}
          onClick={() => setFilterPriority('Urgent')}
        >
          <AlertOctagon size={13} />
          Urgent ({countByPriority('Urgent')})
        </button>

        <button
          className={`tab-btn tab-important ${filterPriority === 'Important' ? 'active' : ''}`}
          onClick={() => setFilterPriority('Important')}
        >
          <AlertTriangle size={13} />
          Important ({countByPriority('Important')})
        </button>

        <button
          className={`tab-btn ${filterPriority === 'Normal' ? 'active' : ''}`}
          onClick={() => setFilterPriority('Normal')}
        >
          Normal ({countByPriority('Normal')})
        </button>

        <button
          className={`tab-btn ${filterPriority === 'Expired' ? 'active' : ''}`}
          onClick={() => setFilterPriority('Expired')}
        >
          <Clock size={13} />
          Expired ({notices.filter((n) => n.status === 'expired' || new Date(n.expiresAt) < new Date()).length})
        </button>
      </div>

      {/* Notices Grid */}
      {sortedNotices.length > 0 ? (
        <div className="notices-grid">
          {sortedNotices.map((notice) => (
            <NoticeCard
              key={notice._id}
              notice={notice}
              isCurrentlyDisplayed={activeNoticeId === notice._id}
              onDisplayOnBoard={onDisplayOnBoard}
              onEdit={onEditNotice}
              onDelete={onDeleteNotice}
              onSyncBLE={onSyncBLE}
              bleState={bleState}
              isAdmin={isAdmin}
              onRequireAuth={onRequireAuth}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state glass-panel">
          <Sparkles size={40} className="empty-icon" />
          <h3>{searchQuery ? 'No matching notices' : 'No notices on board'}</h3>
          <p>
            {searchQuery
              ? `No results matched "${searchQuery}". Try a different keyword.`
              : 'There are currently no active announcements. Compose and post a notice to display it on the ESP32 OLED screen.'}
          </p>
          {!searchQuery && (
            <button
              className="btn-primary"
              onClick={onOpenNewNotice}
              style={{ marginTop: '12px' }}
            >
              <PlusCircle size={16} />
              <span>Compose First Notice</span>
            </button>
          )}
        </div>
      )}

      <style>{`
        .notices-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .admin-lock-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 10px;
          padding: 12px 18px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .lock-banner-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lock-title {
          font-weight: 700;
          color: #fbbf24;
          font-size: 0.88rem;
        }

        .lock-desc {
          font-size: 0.78rem;
          color: #cbd5e1;
        }

        .btn-auth-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f59e0b;
          color: #0b0f19;
          font-weight: 700;
          font-size: 0.8rem;
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-auth-trigger:hover {
          background: #fbbf24;
        }

        .list-controls-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 260px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-input {
          width: 100%;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 9px 36px 9px 36px;
          color: #f8fafc;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s;
        }

        .search-input:focus {
          border-color: #00f0ff;
          box-shadow: 0 0 14px rgba(0, 240, 255, 0.2);
          background: rgba(15, 23, 42, 0.9);
        }

        .clear-search {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.2rem;
          cursor: pointer;
        }

        .sort-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sort-label {
          font-size: 0.85rem;
          color: #94a3b8;
        }

        .sort-select {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #f8fafc;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.85rem;
          outline: none;
          cursor: pointer;
        }

        .filter-tabs {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 0.825rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .tab-btn.active {
          background: rgba(0, 240, 255, 0.15);
          color: #00f0ff;
          border-color: rgba(0, 240, 255, 0.4);
          font-weight: 600;
        }

        .tab-urgent.active {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border-color: rgba(244, 63, 94, 0.4);
        }

        .tab-important.active {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.4);
        }

        .notices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .empty-state {
          padding: 48px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .empty-icon {
          color: #38bdf8;
          opacity: 0.6;
        }

        .empty-state h3 {
          font-size: 1.2rem;
          color: #f8fafc;
        }

        .empty-state p {
          font-size: 0.875rem;
          color: #94a3b8;
          max-width: 440px;
        }
      `}</style>
    </div>
  );
};
