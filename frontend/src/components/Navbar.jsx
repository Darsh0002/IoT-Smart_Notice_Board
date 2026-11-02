import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bluetooth,
  Radio,
  PlusCircle,
  LogIn,
  LogOut,
  User,
  Activity,
  History,
  ChevronDown,
  LayoutDashboard,
  Home,
} from 'lucide-react';

export const Navbar = ({
  user,
  bleState,
  onConnectPhysical,
  onConnectVirtual,
  onDisconnectBLE,
  onOpenNewNotice,
  onOpenAuth,
  onLogout,
  onOpenHistory,
}) => {
  const [showBleMenu, setShowBleMenu] = useState(false);
  const bleMenuRef = useRef(null);

  // Close BLE dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bleMenuRef.current && !bleMenuRef.current.contains(event.target)) {
        setShowBleMenu(false);
      }
    };
    if (showBleMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBleMenu]);

  return (
    <header className="navbar-container">
      {/* Brand & Contextual Nav Links */}
      <div className="navbar-left">
        <Link to="/" className="brand-logo" title="BLE Smart Notice Board">
          <div className="logo-icon-pulse">
            <Bluetooth className="bluetooth-logo" size={19} />
            <span className="pulse-ring"></span>
          </div>
          <div className="brand-text">
            <span className="brand-title">BLE SMART NOTICE BOARD</span>
            <span className="brand-sub">ESP32 • SSD1306 OLED (0x3C)</span>
          </div>
        </Link>

        {/* Authenticated Navigation Links */}
        {user && (
          <nav className="navbar-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Home size={14} />
              <span>Home & Demo</span>
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={14} />
              <span>Dashboard</span>
            </NavLink>
          </nav>
        )}
      </div>

      {/* Right Actions: Minimal & Purposeful */}
      <div className="navbar-right">
        {/* Bluetooth Connect Hub */}
        <div className="ble-connect-wrapper" ref={bleMenuRef}>
          {bleState?.isConnected ? (
            <div className="ble-connected-badge">
              <span
                className={`status-dot ${
                  bleState.isSimulated ? 'simulated' : 'connected'
                }`}
              ></span>
              <span className="ble-label">
                {bleState.isSimulated
                  ? 'Virtual ESP32'
                  : bleState.device?.name || 'ESP32 Connected'}
              </span>
              <button
                className="ble-disconnect-btn"
                onClick={onDisconnectBLE}
                title="Disconnect Bluetooth"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="ble-connect-group">
              <button
                className="btn-ble-connect"
                onClick={() => setShowBleMenu(!showBleMenu)}
                aria-expanded={showBleMenu}
              >
                <Radio size={14} />
                <span>Connect ESP32</span>
                <ChevronDown size={13} className={showBleMenu ? 'rotate-180' : ''} />
              </button>

              {showBleMenu && (
                <div className="dropdown-menu ble-menu">
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowBleMenu(false);
                      onConnectPhysical();
                    }}
                  >
                    <Bluetooth size={16} className="text-blue" />
                    <div>
                      <div className="font-semibold text-xs">Web Bluetooth (Hardware)</div>
                      <div className="text-xxs text-muted">Pair physical ESP32 notice board</div>
                    </div>
                  </div>


                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowBleMenu(false);
                      onConnectVirtual();
                    }}
                  >
                    <Activity size={16} className="text-cyan" />
                    <div>
                      <div className="font-semibold text-xs">Virtual ESP32 Simulator</div>
                      <div className="text-xxs text-muted">Test OLED without hardware</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Context: Logged Out vs Logged In */}
        {!user ? (
          <button className="btn-primary btn-sign-in" onClick={onOpenAuth}>
            <LogIn size={15} />
            <span>Admin Sign In</span>
          </button>
        ) : (
          <>
            <button
              className="nav-btn-subtle"
              onClick={onOpenHistory}
              title="Audit Logs & Notice History"
            >
              <History size={15} />
              <span className="nav-btn-text">Audit Logs</span>
            </button>

            <button className="btn-primary btn-new-notice" onClick={onOpenNewNotice}>
              <PlusCircle size={15} />
              <span>New Notice</span>
            </button>

            <div className="user-profile-badge">
              <div className="user-avatar">
                <User size={14} />
              </div>
              <div className="user-details">
                <span className="username">{user.username}</span>
                <span className="user-role">ADMIN</span>
              </div>
              <button
                className="logout-btn"
                onClick={onLogout}
                title="Log out of admin portal"
              >
                <LogOut size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .navbar-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 28px;
          background: rgba(10, 14, 26, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 240, 255, 0.12);
          position: sticky;
          top: 0;
          z-index: 100;
          gap: 16px;
        }

        .navbar-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          user-select: none;
        }

        .logo-icon-pulse {
          position: relative;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(99, 102, 241, 0.25));
          border: 1px solid rgba(0, 240, 255, 0.35);
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-cyan);
        }

        .pulse-ring {
          position: absolute;
          inset: -4px;
          border-radius: 13px;
          border: 1px solid rgba(0, 240, 255, 0.25);
          animation: ringPulse 2.5s infinite;
        }

        @keyframes ringPulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }

        .brand-text {
          display: flex;
          flex-direction: column;
        }

        .brand-title {
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: 14px;
          letter-spacing: -0.01em;
          background: linear-gradient(135deg, #ffffff 40%, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .brand-sub {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--accent-cyan);
          letter-spacing: 0.04em;
        }

        .navbar-links {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(16, 24, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 3px;
          border-radius: 8px;
        }

        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .nav-link:hover {
          color: var(--text-main);
        }

        .nav-link.active {
          background: rgba(0, 240, 255, 0.12);
          color: var(--accent-cyan);
          border: 1px solid rgba(0, 240, 255, 0.25);
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.12);
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ble-connect-wrapper {
          position: relative;
        }

        .btn-ble-connect {
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(14, 165, 233, 0.12);
          border: 1px solid rgba(14, 165, 233, 0.3);
          color: #38bdf8;
          border-radius: var(--radius-md);
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-ble-connect:hover {
          background: rgba(14, 165, 233, 0.22);
          border-color: #38bdf8;
        }

        .rotate-180 {
          transform: rotate(180deg);
        }

        .ble-connected-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          border-radius: var(--radius-md);
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .ble-disconnect-btn {
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: #fb7185;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ble-disconnect-btn:hover {
          background: rgba(244, 63, 94, 0.3);
        }

        .dropdown-menu.ble-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 240px;
          background: #090e1a;
          border: 1px solid rgba(0, 240, 255, 0.25);
          border-radius: var(--radius-md);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65);
          padding: 6px;
          z-index: 110;
          animation: menuFadeIn 0.15s ease-out;
        }

        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .dropdown-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .text-xxs {
          font-size: 10px;
        }

        .nav-btn-subtle {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-main);
          border-radius: var(--radius-md);
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-btn-subtle:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(0, 240, 255, 0.25);
        }

        .btn-sign-in {
          padding: 7px 16px;
          font-size: 12px;
        }

        .btn-new-notice {
          padding: 7px 14px;
          font-size: 12px;
        }

        @media (max-width: 768px) {
          .nav-btn-text {
            display: none;
          }
        }

        .user-profile-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 3px 10px 3px 5px;
        }

        .user-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(0, 240, 255, 0.2);
          color: var(--accent-cyan);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .user-details {
          display: flex;
          flex-direction: column;
        }

        .user-details .username {
          font-size: 11px;
          font-weight: 600;
          line-height: 1.1;
        }

        .user-details .user-role {
          font-size: 8px;
          color: var(--accent-cyan);
          font-family: var(--font-mono);
        }

        .logout-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .logout-btn:hover {
          color: #fb7185;
        }
      `}</style>
    </header>
  );
};
