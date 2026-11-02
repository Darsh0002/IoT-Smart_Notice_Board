import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from './services/api';
import { ble } from './utils/bleManager';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { DashboardStats } from './components/DashboardStats';
import { OledDisplaySimulator } from './components/OledDisplaySimulator';
import { NoticeList } from './components/NoticeList';
import { NoticeModal } from './components/NoticeModal';
import { AuditHistory } from './components/AuditHistory';
import { AuthModal } from './components/AuthModal';
import {
  Terminal,
  Radio,
  Cpu,
  Layers,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function App() {
  const navigate = useNavigate();

  // Authentication & Data State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notices, setNotices] = useState([]);
  const [activeNotice, setActiveNotice] = useState(null);
  const [stats, setStats] = useState(null);
  const [bleState, setBleState] = useState({
    isConnected: false,
    isSimulated: false,
    device: null,
    logs: [],
  });

  // Modals visibility states
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [editNoticeData, setEditNoticeData] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Toast notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRequireAuth = (msg = 'Administrator authentication required to perform this action') => {
    showToast(msg, 'warning');
    setIsAuthOpen(true);
  };

  // Subscribe to BLE manager state
  useEffect(() => {
    const unsubscribe = ble.subscribe((state) => {
      setBleState(state);
    });
    return () => unsubscribe();
  }, []);

  // Fetch initial data & authenticate user
  const fetchData = async () => {
    try {
      // 1. Verify user session via JWT token
      const token = localStorage.getItem('ble_notice_token');
      if (token) {
        try {
          const userRes = await api.getMe();
          if (userRes.success) {
            setUser(userRes.data);
          }
        } catch {
          localStorage.removeItem('ble_notice_token');
          setUser(null);
        }
      }

      // 2. Fetch notices
      const noticesRes = await api.getNotices();
      if (noticesRes.success) {
        setNotices(noticesRes.data);
        if (noticesRes.data.length > 0) {
          const now = new Date();
          const activeOnes = noticesRes.data.filter(
            (n) =>
              n.status === 'active' &&
              (!n.scheduledFor || new Date(n.scheduledFor) <= now) &&
              (!n.expiresAt || new Date(n.expiresAt) > now)
          );
          setActiveNotice(activeOnes.length > 0 ? activeOnes[0] : null);
        } else {
          setActiveNotice(null);
        }
      }

      // 3. Fetch stats
      const statsRes = await api.getStats();
      if (statsRes.success) setStats(statsRes.data);
    } catch (err) {
      console.warn('Backend connection notice:', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30s so scheduled->active and active->expired transitions
    // appear in the UI without requiring a manual page reload.
    const pollInterval = setInterval(fetchData, 30 * 1000);
    return () => clearInterval(pollInterval);
  }, []);

  // BLE Handlers
  const handleConnectPhysical = async (options = {}) => {
    try {
      await ble.connectPhysical(options);
      showToast('Connected to ESP32 via Web Bluetooth!', 'success');
      if (activeNotice) {
        await ble.sendNotice(activeNotice);
      }
    } catch (err) {
      if (err.name === 'NotFoundError' || err.message?.includes('User cancelled')) {
        showToast('Pairing cancelled. If your ESP32 did not appear, verify it is powered on and Bluetooth is enabled.', 'warning');
      } else {
        showToast(`Bluetooth Error: ${err.message}`, 'error');
      }
    }
  };

  const handleConnectVirtual = async () => {
    try {
      await ble.connectVirtual('ESP32-Smart-Notice-Board');
      showToast('Virtual ESP32 Simulator connected with OLED mirror!', 'success');
      if (activeNotice) {
        await ble.sendNotice(activeNotice);
      }
    } catch (err) {
      showToast(`Simulation Error: ${err.message}`, 'error');
    }
  };

  const handleDisconnectBLE = () => {
    ble.disconnect();
    showToast('Bluetooth disconnected', 'info');
  };

  // Push Notice to OLED Board
  const handleDisplayOnBoard = async (notice) => {
    setActiveNotice(notice);
    if (bleState.isConnected) {
      try {
        await ble.sendNotice(notice);
        if (notice._id) {
          await api.syncNoticeToBLE(notice._id, 'ESP32 SSD1306 OLED Board');
        }
        showToast(`"${notice.title}" transmitted to ESP32 OLED Screen!`, 'success');
        fetchData();
      } catch (err) {
        showToast(`Transmission failed: ${err.message}`, 'error');
      }
    } else {
      showToast(`Simulated on OLED. Pair ESP32 Bluetooth to transmit to hardware!`, 'info');
    }
  };

  // Sync all active notices to ESP32 in Priority Stack Order
  const handleSyncAllToBoard = async () => {
    if (activeNotices.length === 0) {
      showToast('No active notices to display', 'info');
      return;
    }
    if (bleState.isConnected) {
      try {
        const res = await ble.syncAllNotices(activeNotices);
        showToast(
          `Synced ${res.count || Math.min(activeNotices.length, 4)} notices to ESP32 priority display!`,
          'success'
        );
        fetchData();
      } catch (err) {
        showToast(`Sync failed: ${err.message}`, 'error');
      }
    } else {
      showToast('Simulated priority stack on OLED mirror. Connect BLE to sync hardware!', 'info');
    }
  };

  // Notice CRUD handlers
  const handleSaveNotice = async (noticeData, sendDirectly) => {
    if (!user) {
      setIsNoticeModalOpen(false);
      handleRequireAuth('Only authenticated administrators can post or schedule notices');
      return;
    }

    try {
      let savedNotice;
      if (editNoticeData) {
        const res = await api.updateNotice(editNoticeData._id, noticeData);
        savedNotice = res.data;
        showToast('Notice updated successfully!', 'success');
      } else {
        const res = await api.createNotice(noticeData);
        savedNotice = res.data;
        if (savedNotice.status === 'scheduled') {
          showToast(
            `Notice scheduled! It will go live at ${new Date(savedNotice.scheduledFor).toLocaleTimeString()}`,
            'success'
          );
        } else {
          showToast('Notice posted successfully!', 'success');
        }
      }

      setIsNoticeModalOpen(false);
      setEditNoticeData(null);
      await fetchData();

      if (sendDirectly && savedNotice.status === 'active') {
        handleDisplayOnBoard(savedNotice);
      }
    } catch (err) {
      showToast(err.message || 'Failed to save notice', 'error');
    }
  };

  const handleDeleteNotice = async (id) => {
    if (!user) {
      handleRequireAuth('Only authenticated administrators can delete notices');
      return;
    }

    if (window.confirm('Are you sure you want to delete this notice?')) {
      try {
        // Find the notice title BEFORE deleting (needed for BLE delete command)
        const noticeToDelete = notices.find((n) => n._id === id);

        // 1. Delete from database
        await api.deleteNotice(id);

        // 2. Remove from ESP32 OLED board via BLE (if connected)
        if (noticeToDelete) {
          try {
            await ble.deleteNoticeFromBoard(noticeToDelete.title);
            // Also sync remaining active notices to ensure OLED display matches exactly
            const remainingActive = notices.filter(
              (n) =>
                n._id !== id &&
                n.status === 'active' &&
                (!n.scheduledFor || new Date(n.scheduledFor) <= new Date()) &&
                (!n.expiresAt || new Date(n.expiresAt) > new Date())
            );
            if (bleState.isConnected) {
              await ble.syncAllNotices(remainingActive);
            }
          } catch (bleErr) {
            console.warn('[BLE] Delete from board failed:', bleErr.message);
          }
        }

        showToast('Notice deleted from database and ESP32 board!', 'info');

        if (activeNotice?._id === id) {
          const remaining = notices.filter((n) => n._id !== id);
          setActiveNotice(remaining.length > 0 ? remaining[0] : null);
        }
        await fetchData();
      } catch (err) {
        showToast(err.message || 'Failed to delete notice', 'error');
      }
    }
  };

  // Active notices list for OLED mirror
  const nowTime = new Date();
  const activeNotices = notices.filter(
    (n) =>
      n.status === 'active' &&
      (!n.scheduledFor || new Date(n.scheduledFor) <= nowTime) &&
      (!n.expiresAt || new Date(n.expiresAt) > nowTime)
  );

  return (
    <div className="app-root">
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : toast.type === 'error' ? (
            <AlertCircle size={16} />
          ) : (
            <Radio size={16} />
          )}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Clean Contextual Navigation Bar */}
      <Navbar
        user={user}
        bleState={bleState}
        onConnectPhysical={handleConnectPhysical}
        onConnectVirtual={handleConnectVirtual}
        onDisconnectBLE={handleDisconnectBLE}
        onOpenNewNotice={() => {
          if (!user) {
            handleRequireAuth('Only authenticated administrators can post notices');
            return;
          }
          setEditNoticeData(null);
          setIsNoticeModalOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={() => {
          localStorage.removeItem('ble_notice_token');
          setUser(null);
          navigate('/');
          showToast('Logged out. Returned to Home page.', 'info');
        }}
        onOpenHistory={() => {
          if (!user) {
            handleRequireAuth('Only authenticated administrators can view audit logs');
            return;
          }
          setIsHistoryOpen(true);
        }}
      />

      {/* React Router Views */}
      <main className="main-content">
        <Routes>
          {/* Public Home & Project Showcase Route */}
          <Route
            path="/"
            element={
              <HomePage
                bleState={bleState}
                onConnectPhysical={handleConnectPhysical}
                onConnectVirtual={handleConnectVirtual}
                onNavigateToDashboard={() => {
                  if (user) {
                    navigate('/dashboard');
                  } else {
                    setIsAuthOpen(true);
                  }
                }}
                onTransmitNotice={handleDisplayOnBoard}
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            }
          />

          {/* Protected Admin Dashboard Route: Strictly redirects to '/' if not logged in */}
          <Route
            path="/dashboard"
            element={
              !authLoading && !user ? (
                <Navigate to="/" replace />
              ) : (
                <>
                  {/* Top Metric Cards */}
                  <DashboardStats stats={stats} bleState={bleState} />

                  {/* Dashboard Split: Left (OLED Simulator & Terminal) / Right (Notice Management) */}
                  <div className="dashboard-grid">
                    {/* Left Column: OLED Display & BLE Terminal */}
                    <div className="left-panel">
                      <div className="panel-title-row">
                        <div className="panel-title">
                          <Cpu size={18} className="text-cyan" />
                          <h2>ESP32 OLED Display Live Mirror</h2>
                        </div>
                        <span className="live-pill">
                          <span className="live-dot"></span> 128x64 SSD1306 • I2C 0x3C
                        </span>
                      </div>

                      {/* Virtual OLED Simulator Component */}
                      <OledDisplaySimulator
                        activeNotice={activeNotice}
                        bleState={bleState}
                        onSendToBoard={handleDisplayOnBoard}
                        onSyncAllToBoard={handleSyncAllToBoard}
                        activeNoticesList={activeNotices}
                      />

                      {/* Live BLE Packet & Hardware Activity Terminal */}
                      <div className="glass-panel ble-terminal-card">
                        <div className="terminal-header">
                          <div className="terminal-title">
                            <Terminal size={14} className="text-cyan" />
                            <span>Bluetooth Low Energy Activity Stream</span>
                          </div>
                          <span className="terminal-count">{bleState.logs.length} events</span>
                        </div>

                        <div className="terminal-log-window">
                          {bleState.logs.length > 0 ? (
                            bleState.logs.slice(0, 15).map((log) => (
                              <div key={log.id} className={`terminal-log-line log-${log.type}`}>
                                <span className="log-time">[{log.timestamp}]</span>
                                <span className="log-msg">{log.message}</span>
                                {log.details && (
                                  <div className="log-payload-preview">{log.details}</div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="terminal-empty">
                              <span>Awaiting BLE transactions... Connect to ESP32 to monitor live GATT packets.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Notice Management Feed */}
                    <div className="right-panel">
                      <div className="panel-title-row">
                        <div className="panel-title">
                          <Layers size={18} className="text-blue" />
                          <h2>Notice Management & Scheduling</h2>
                        </div>
                        <span className="count-pill">
                          {notices.length} Notice{notices.length === 1 ? '' : 's'} Total
                        </span>
                      </div>

                      {/* Notice List with Filters & Admin Guard */}
                      <NoticeList
                        notices={notices}
                        activeNoticeId={activeNotice?._id}
                        onDisplayOnBoard={handleDisplayOnBoard}
                        onEditNotice={(notice) => {
                          if (!user) {
                            handleRequireAuth('Only authenticated administrators can edit notices');
                            return;
                          }
                          setEditNoticeData(notice);
                          setIsNoticeModalOpen(true);
                        }}
                        onDeleteNotice={handleDeleteNotice}
                        onSyncBLE={handleDisplayOnBoard}
                        bleState={bleState}
                        isAdmin={Boolean(user)}
                        onRequireAuth={handleRequireAuth}
                        onOpenNewNotice={() => {
                          if (!user) {
                            handleRequireAuth('Only authenticated administrators can post notices');
                            return;
                          }
                          setEditNoticeData(null);
                          setIsNoticeModalOpen(true);
                        }}
                      />
                    </div>
                  </div>
                </>
              )
            }
          />

          {/* Catch-all Wildcard Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Modals */}
      <NoticeModal
        isOpen={isNoticeModalOpen}
        onClose={() => {
          setIsNoticeModalOpen(false);
          setEditNoticeData(null);
        }}
        onSave={handleSaveNotice}
        editNotice={editNoticeData}
        bleConnected={bleState.isConnected}
      />

      <AuditHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onReSendNotice={handleDisplayOnBoard}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(authData) => {
          setUser(authData);
          navigate('/dashboard');
          showToast(`Welcome back, ${authData.username}! Admin dashboard unlocked.`, 'success');
        }}
      />

      {/* App Styles */}
      <style>{`
        .app-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .main-content {
          flex: 1;
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
          padding: 24px 28px 48px 28px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 460px 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 1100px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        .left-panel, .right-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .panel-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 4px;
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .panel-title h2 {
          font-size: 1.15rem;
          color: #f8fafc;
        }

        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 240, 255, 0.12);
          border: 1px solid rgba(0, 240, 255, 0.3);
          color: #00f0ff;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 3px 8px;
          border-radius: 999px;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #00f0ff;
          box-shadow: 0 0 6px #00f0ff;
          animation: ringPulse 1.5s infinite;
        }

        .count-pill {
          font-size: 0.75rem;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 8px;
          border-radius: 6px;
        }

        /* BLE Terminal */
        .ble-terminal-card {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .terminal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .terminal-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #f1f5f9;
        }

        .terminal-count {
          font-size: 0.72rem;
          color: #64748b;
          font-family: var(--font-mono);
        }

        .terminal-log-window {
          background: #040711;
          border: 1px solid #111c33;
          border-radius: 8px;
          padding: 10px 12px;
          height: 180px;
          overflow-y: auto;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .terminal-log-line {
          line-height: 1.4;
          word-break: break-word;
        }

        .log-time {
          color: #64748b;
          margin-right: 6px;
        }

        .log-info { color: #94a3b8; }
        .log-success { color: #10b981; }
        .log-warning { color: #f59e0b; }
        .log-error { color: #f43f5e; }
        .log-ble-tx { color: #00f0ff; }
        .log-ble-rx { color: #a855f7; }

        .log-payload-preview {
          font-size: 0.7rem;
          color: #64748b;
          background: rgba(255, 255, 255, 0.03);
          padding: 4px;
          border-radius: 4px;
          margin-top: 2px;
          white-space: pre-wrap;
        }

        .terminal-empty {
          color: #64748b;
          font-style: italic;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
        }

        /* Toast */
        .toast-notification {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 10px;
          font-size: 0.875rem;
          font-weight: 500;
          z-index: 2000;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
          animation: slideUp 0.25s ease-out;
        }

        .toast-success {
          background: #064e3b;
          color: #a7f3d0;
          border: 1px solid #059669;
        }

        .toast-error {
          background: #881337;
          color: #fecdd3;
          border: 1px solid #e11d48;
        }

        .toast-info {
          background: #0c4a6e;
          color: #bae6fd;
          border: 1px solid #0284c7;
        }

        .toast-close {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          opacity: 0.7;
          margin-left: 6px;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
