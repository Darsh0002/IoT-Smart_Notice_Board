import React, { useState, useEffect } from 'react';
import { X, Send, Save, AlertOctagon, AlertTriangle, Info, Radio, Calendar, Zap } from 'lucide-react';

export const NoticeModal = ({
  isOpen,
  onClose,
  onSave,
  editNotice = null,
  bleConnected = false,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [category, setCategory] = useState('General');
  const [scrollSpeed, setScrollSpeed] = useState('Medium');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [sendDirectlyToBLE, setSendDirectlyToBLE] = useState(true);
  const [error, setError] = useState('');

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

  // Helper for formatting datetime local
  const formatDateTimeLocal = (date) => {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  // Populate fields if editing
  useEffect(() => {
    if (editNotice) {
      setTitle(editNotice.title || '');
      setContent(editNotice.content || '');
      setPriority(editNotice.priority || 'Normal');
      setCategory(editNotice.category || 'General');
      setScrollSpeed(editNotice.scrollSpeed || 'Medium');

      // Check if scheduled
      if (editNotice.scheduledFor && new Date(editNotice.scheduledFor) > new Date()) {
        setIsScheduled(true);
        setScheduledFor(formatDateTimeLocal(new Date(editNotice.scheduledFor)));
      } else {
        setIsScheduled(false);
        const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
        setScheduledFor(formatDateTimeLocal(inOneHour));
      }

      if (editNotice.expiresAt) {
        setExpiresAt(formatDateTimeLocal(new Date(editNotice.expiresAt)));
      }
    } else {
      // Default new notice: immediate post, 7 days expiry
      setTitle('');
      setContent('');
      setPriority('Normal');
      setCategory('General');
      setScrollSpeed('Medium');
      setIsScheduled(false);

      const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
      setScheduledFor(formatDateTimeLocal(inOneHour));

      const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setExpiresAt(formatDateTimeLocal(defaultExpiry));
    }
    setError('');
  }, [editNotice, isOpen]);

  if (!isOpen) return null;

  // Preset expiry helpers
  const setExpiryDays = (days) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setExpiresAt(formatDateTimeLocal(d));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a notice title');
      return;
    }
    if (!content.trim()) {
      setError('Please enter the notice message for the ESP32 OLED display');
      return;
    }

    const now = new Date();
    const finalScheduleDate = isScheduled && scheduledFor
      ? new Date(scheduledFor).toISOString()
      : now.toISOString();

    const noticeData = {
      title: title.trim(),
      content: content.trim(),
      priority,
      category,
      scrollSpeed,
      scheduledFor: finalScheduleDate,
      expiresAt: new Date(expiresAt).toISOString(),
    };

    onSave(noticeData, sendDirectlyToBLE && !isScheduled);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>{editNotice ? 'Edit Notice' : isScheduled ? 'Schedule Notice for Board' : 'Compose New Notice'}</h2>
            <span className="modal-sub">
              Admin Portal • Dispatch announcements wirelessly to ESP32 OLED
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {error && <div className="form-error-banner">{error}</div>}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Post Mode Selector: Post Immediately vs Schedule for Later */}
          <div className="post-mode-toggle">
            <button
              type="button"
              className={`mode-btn ${!isScheduled ? 'active' : ''}`}
              onClick={() => setIsScheduled(false)}
            >
              <Zap size={14} />
              <span>Post Immediately (Active)</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${isScheduled ? 'active' : ''}`}
              onClick={() => setIsScheduled(true)}
            >
              <Calendar size={14} />
              <span>Schedule for Later</span>
            </button>
          </div>

          {/* Title */}
          <div className="form-group">
            <div className="form-label">
              <span>Notice Title (Zone 1 on OLED)</span>
              <span className="char-count">{title.length} / 100</span>
            </div>
            <input
              type="text"
              placeholder="e.g. CAMPUS REOPENING GUIDELINES"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
              autoFocus
            />
          </div>

          {/* Priority Selection */}
          <div className="form-group">
            <div className="form-label">
              <span>Notice Priority</span>
              <span className="text-xs text-muted">Controls OLED alerts & ranking</span>
            </div>
            <div className="priority-selector">
              <label
                className={`priority-opt opt-normal ${priority === 'Normal' ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="priority"
                  value="Normal"
                  checked={priority === 'Normal'}
                  onChange={() => setPriority('Normal')}
                />
                <Info size={15} />
                <span>Normal</span>
              </label>

              <label
                className={`priority-opt opt-important ${priority === 'Important' ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="priority"
                  value="Important"
                  checked={priority === 'Important'}
                  onChange={() => setPriority('Important')}
                />
                <AlertTriangle size={15} />
                <span>Important</span>
              </label>

              <label
                className={`priority-opt opt-urgent ${priority === 'Urgent' ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="priority"
                  value="Urgent"
                  checked={priority === 'Urgent'}
                  onChange={() => setPriority('Urgent')}
                />
                <AlertOctagon size={15} />
                <span>Urgent</span>
              </label>
            </div>
          </div>

          {/* Notice Content / Message */}
          <div className="form-group">
            <div className="form-label">
              <span>Notice Content (Line 2 Continuous Marquee Ticker)</span>
              <span className="char-count">{content.length} / 500</span>
            </div>
            <textarea
              placeholder="Type announcement here. Long messages will continuously scroll horizontally across Zone 3 of the OLED..."
              value={content}
              maxLength={500}
              onChange={(e) => setContent(e.target.value)}
              className="form-textarea"
              rows={3}
              required
            />
          </div>

          {/* Scheduled Date Picker (Conditional) */}
          {isScheduled && (
            <div className="form-group scheduled-group">
              <div className="form-label">
                <span className="text-cyan flex items-center gap-1">
                  <Calendar size={14} /> Scheduled Activation Time
                </span>
                <span className="text-xs text-muted">Goes live on OLED at this time</span>
              </div>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="form-input"
                required={isScheduled}
              />
            </div>
          )}

          {/* Row: Category & Scroll Speed */}
          <div className="form-row">
            <div className="form-group half-width">
              <label className="form-label">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-select"
              >
                <option value="General">General Notice</option>
                <option value="Academic">Academic</option>
                <option value="Exam">Exam Announcement</option>
                <option value="Emergency">Emergency Alert</option>
                <option value="Event">Campus Event</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div className="form-group half-width">
              <label className="form-label">OLED Marquee Speed</label>
              <select
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(e.target.value)}
                className="form-select"
              >
                <option value="Slow">Slow (50ms / px)</option>
                <option value="Medium">Medium (30ms / px)</option>
                <option value="Fast">Fast (15ms / px)</option>
              </select>
            </div>
          </div>

          {/* Expiration Date Picker with Presets */}
          <div className="form-group">
            <div className="form-label">
              <span>Notice Expiration Date & Time</span>
              <div className="expiry-presets">
                <button type="button" onClick={() => setExpiryDays(1)}>+24h</button>
                <button type="button" onClick={() => setExpiryDays(3)}>+3d</button>
                <button type="button" onClick={() => setExpiryDays(7)}>+1w</button>
                <button type="button" onClick={() => setExpiryDays(30)}>+1m</button>
              </div>
            </div>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* BLE Direct Send Checkbox (Only if posting immediately) */}
          {!isScheduled && (
            <div className="ble-checkbox-group">
              <label className="custom-checkbox-label">
                <input
                  type="checkbox"
                  checked={sendDirectlyToBLE}
                  onChange={(e) => setSendDirectlyToBLE(e.target.checked)}
                />
                <span className="checkbox-text">
                  <Radio size={15} className="text-cyan" />
                  <span>
                    Push immediately to ESP32 OLED via Bluetooth
                    {bleConnected ? (
                      <span className="status-note text-green"> (BLE Ready)</span>
                    ) : (
                      <span className="status-note text-muted"> (Requires BLE Connect)</span>
                    )}
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Modal Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {isScheduled ? (
                <>
                  <Calendar size={15} />
                  <span>Schedule Notice</span>
                </>
              ) : sendDirectlyToBLE && bleConnected ? (
                <>
                  <Send size={15} />
                  <span>Post & Push to OLED</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>{editNotice ? 'Update Notice' : 'Post Notice'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .modal-title-group h2 {
          font-size: 1.15rem;
          color: #f8fafc;
          font-weight: 700;
        }

        .modal-sub {
          font-size: 0.8rem;
          color: #94a3b8;
          display: block;
          margin-top: 2px;
        }

        .modal-close-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-close-btn:hover {
          background: rgba(244, 63, 94, 0.15);
          color: #fb7185;
          border-color: rgba(244, 63, 94, 0.3);
        }

        .modal-form {
          padding: 24px;
        }

        .post-mode-toggle {
          display: flex;
          gap: 8px;
          background: rgba(16, 24, 42, 0.6);
          padding: 4px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 20px;
        }

        .mode-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 0.825rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-btn.active {
          background: rgba(0, 240, 255, 0.12);
          color: var(--accent-cyan);
          border: 1px solid rgba(0, 240, 255, 0.3);
        }

        .char-count {
          font-size: 0.725rem;
          font-family: var(--font-mono);
          color: #64748b;
        }

        .priority-selector {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .priority-opt {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .priority-opt input {
          display: none;
        }

        .priority-opt.selected.opt-normal {
          background: rgba(16, 185, 129, 0.15);
          border-color: #10b981;
          color: #34d399;
        }

        .priority-opt.selected.opt-important {
          background: rgba(245, 158, 11, 0.15);
          border-color: #f59e0b;
          color: #fbbf24;
        }

        .priority-opt.selected.opt-urgent {
          background: rgba(244, 63, 94, 0.15);
          border-color: #f43f5e;
          color: #fb7185;
        }

        .form-row {
          display: flex;
          gap: 14px;
        }

        .half-width {
          flex: 1;
        }

        .expiry-presets {
          display: flex;
          gap: 6px;
        }

        .expiry-presets button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          font-size: 0.725rem;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .expiry-presets button:hover {
          background: rgba(0, 240, 255, 0.15);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }

        .ble-checkbox-group {
          background: rgba(14, 165, 233, 0.08);
          border: 1px solid rgba(14, 165, 233, 0.25);
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 20px;
        }

        .custom-checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .custom-checkbox-label input[type='checkbox'] {
          width: 16px;
          height: 16px;
          accent-color: var(--accent-cyan);
          cursor: pointer;
        }

        .checkbox-text {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: #e2e8f0;
          font-weight: 500;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </div>
  );
};
