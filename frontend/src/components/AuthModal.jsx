import React, { useState, useEffect } from 'react';
import { X, User, Mail, ShieldCheck, Key, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
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

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username/email and password');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      if (res.success && res.data?.token) {
        localStorage.setItem('ble_notice_token', res.data.token);
        onAuthSuccess(res.data);
        onClose();
      } else {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !email.trim() || !password) {
      setError('Please provide all required fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim() || username.trim(),
      });
      if (res.success && res.data?.token) {
        localStorage.setItem('ble_notice_token', res.data.token);
        onAuthSuccess(res.data);
        onClose();
      } else {
        setError(res.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. A user with this email or username may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="flex items-center gap-2">
              <ShieldCheck size={22} className="text-cyan" />
              <h2>{isRegister ? 'Admin Registration' : 'Administrator Sign In'}</h2>
            </div>
            <span className="modal-sub">
              Secure authentication for ESP32 notice broadcast & scheduling
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="form-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Mode Toggle Tabs */}
        <div className="auth-tab-switch">
          <button
            type="button"
            className={`auth-tab-btn ${!isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(false);
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(true);
              setError('');
            }}
          >
            Create Account
          </button>
        </div>

        {/* Real Authenticated Form */}
        <form onSubmit={isRegister ? handleRegister : handleLogin} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. Prof. R. K. Patel"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input has-icon"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{isRegister ? 'Username' : 'Username or Email'}</label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                type="text"
                placeholder={isRegister ? 'admin_pdeu' : 'admin or admin@pdeu.ac.in'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input has-icon"
                required
                autoFocus
              />
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  placeholder="admin@pdeu.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input has-icon"
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Key size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input has-icon has-action"
                required
              />
              <button
                type="button"
                className="input-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isRegister && (
              <span className="input-hint">Minimum 6 characters with letters or numbers</span>
            )}
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              'Authenticating...'
            ) : isRegister ? (
              'Register & Log In'
            ) : (
              'Sign In as Administrator'
            )}
          </button>
        </form>

        <div className="auth-footer-notice">
          <ShieldCheck size={14} className="text-cyan" />
          <span>Secured via bcrypt password hashing & JSON Web Token (JWT)</span>
        </div>
      </div>

      <style>{`
        .auth-modal-content {
          max-width: 440px;
          border-radius: var(--radius-lg);
          background: rgba(10, 15, 26, 0.98);
          border: 1px solid rgba(0, 240, 255, 0.25);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 240, 255, 0.15);
        }

        .form-error-banner {
          background: rgba(244, 63, 94, 0.15);
          border: 1px solid rgba(244, 63, 94, 0.35);
          color: #fb7185;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .auth-tab-switch {
          display: flex;
          background: rgba(16, 24, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 3px;
          margin-bottom: 20px;
        }

        .auth-tab-btn {
          flex: 1;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .auth-tab-btn.active {
          background: rgba(0, 240, 255, 0.15);
          color: var(--accent-cyan);
          border: 1px solid rgba(0, 240, 255, 0.3);
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.15);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          color: var(--text-dim);
          pointer-events: none;
        }

        .form-input.has-icon {
          padding-left: 38px;
          width: 100%;
        }

        .form-input.has-action {
          padding-right: 38px;
        }

        .input-eye-btn {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .input-eye-btn:hover {
          color: var(--accent-cyan);
        }

        .input-hint {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: var(--text-dim);
        }

        .auth-footer-notice {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 11px;
          color: var(--text-dim);
        }
      `}</style>
    </div>
  );
};
