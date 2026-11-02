import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Palette, Terminal, Zap, Cpu, Sun, Sliders } from 'lucide-react';

export const LcdDisplaySimulator = ({
  activeNotice,
  bleState,
  onSendToBoard,
  activeNoticesList = [],
}) => {
  // Simulator configurations
  const [theme, setTheme] = useState('blue'); // 'blue', 'green', 'dark'
  const [backlightOn, setBacklightOn] = useState(true);
  const [contrast, setContrast] = useState(90); // 0 to 100
  const [isPaused, setIsPaused] = useState(false);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [showPacketInspector, setShowPacketInspector] = useState(false);
  const [urgentBlink, setUrgentBlink] = useState(false);
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);

  // Active or Fallback notice
  const displayNotice = activeNotice ||
    (activeNoticesList.length > 0 ? activeNoticesList[currentNoticeIndex] : {
      title: 'SMART NOTICE BD',
      content: 'Awaiting BLE connection from Admin Web Portal...',
      priority: 'Normal',
      category: 'System',
      scrollSpeed: 'Medium',
    });

  // Auto-rotate multiple notices if enabled
  useEffect(() => {
    if (!autoRotate || activeNoticesList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentNoticeIndex((prev) => (prev + 1) % activeNoticesList.length);
      setScrollIndex(0);
    }, 9000);
    return () => clearInterval(interval);
  }, [autoRotate, activeNoticesList]);

  // Urgent notice blinking effect on Line 1 (every 1.2s, exactly like ESP32 firmware)
  useEffect(() => {
    if (displayNotice.priority !== 'Urgent') {
      setUrgentBlink(false);
      return;
    }
    const interval = setInterval(() => {
      setUrgentBlink((prev) => !prev);
    }, 1200);
    return () => clearInterval(interval);
  }, [displayNotice.priority]);

  // Prepare scrolling text for Line 2 (Marquee loop matching ESP32 firmware)
  const rawMessage = (displayNotice.content || '').trim();
  const marqueeText = rawMessage.length <= 16
    ? rawMessage.padEnd(16, ' ')
    : rawMessage + '    '; // 4 spaces separator

  // Character Marquee Scrolling Timer for Line 2
  useEffect(() => {
    if (isPaused || marqueeText.length <= 16) return;

    let delayMs = 350; // Medium default
    if (displayNotice.scrollSpeed === 'Fast') delayMs = 220;
    if (displayNotice.scrollSpeed === 'Slow') delayMs = 500;

    const interval = setInterval(() => {
      setScrollIndex((prev) => (prev + 1) % marqueeText.length);
    }, delayMs);

    return () => clearInterval(interval);
  }, [isPaused, displayNotice.scrollSpeed, marqueeText]);

  // Reset scroll on notice change
  useEffect(() => {
    setScrollIndex(0);
  }, [displayNotice.content, displayNotice.title]);

  // Format Line 1 (16 chars)
  const getLine1Text = () => {
    let text = '';
    if (displayNotice.priority === 'Urgent') {
      text = urgentBlink ? '[!URGENT NOTICE]' : (displayNotice.title || 'URGENT NOTICE');
    } else if (displayNotice.priority === 'Important') {
      text = '*' + (displayNotice.title || 'NOTICE');
    } else {
      text = displayNotice.title || 'SMART NOTICE BD';
    }
    return text.substring(0, 16).padEnd(16, ' ');
  };

  // Format Line 2 (16 chars)
  const getLine2Text = () => {
    if (marqueeText.length <= 16) {
      return marqueeText.substring(0, 16).padEnd(16, ' ');
    }
    let windowStr = '';
    for (let i = 0; i < 16; i++) {
      const charPos = (scrollIndex + i) % marqueeText.length;
      windowStr += marqueeText.charAt(charPos);
    }
    return windowStr;
  };

  const line1Chars = getLine1Text().split('');
  const line2Chars = getLine2Text().split('');

  // LCD Color Palettes
  const themeStyles = {
    blue: {
      pcbBg: '#0b1d3a',
      screenBg: backlightOn ? '#0f42b3' : '#142038',
      charBg: backlightOn ? 'rgba(8, 30, 85, 0.45)' : 'rgba(10, 15, 25, 0.6)',
      textColor: backlightOn ? '#ffffff' : '#475569',
      glow: backlightOn ? '0 0 8px rgba(255, 255, 255, 0.7)' : 'none',
      screenBorder: '#1e3a8a',
      accent: '#38bdf8',
    },
    green: {
      pcbBg: '#112918',
      screenBg: backlightOn ? '#7a8c17' : '#283311',
      charBg: backlightOn ? 'rgba(95, 110, 15, 0.45)' : 'rgba(25, 33, 12, 0.6)',
      textColor: backlightOn ? '#1a2205' : '#404c24',
      glow: 'none',
      screenBorder: '#4d5c10',
      accent: '#84cc16',
    },
    dark: {
      pcbBg: '#090d16',
      screenBg: backlightOn ? '#111827' : '#0a0d14',
      charBg: backlightOn ? 'rgba(31, 41, 55, 0.5)' : 'rgba(15, 23, 42, 0.6)',
      textColor: backlightOn ? '#f3f4f6' : '#374151',
      glow: backlightOn ? '0 0 6px rgba(243, 244, 246, 0.5)' : 'none',
      screenBorder: '#374151',
      accent: '#9ca3af',
    },
  }[theme];

  // Opacity derived from contrast potentiometer
  const textOpacity = contrast / 100;

  // Raw BLE Payload for packet inspector
  const rawPayload = JSON.stringify({
    title: displayNotice.title,
    content: displayNotice.content,
    priority: displayNotice.priority,
    category: displayNotice.category || 'General',
    scrollSpeed: displayNotice.scrollSpeed || 'Medium',
    timestamp: Date.now(),
  }, null, 2);

  return (
    <div className="lcd-simulator-wrapper">
      {/* Outer Hardware Enclosure */}
      <div className="lcd-hardware-frame" style={{ borderColor: themeStyles.accent }}>
        {/* Top PCB Header with Pin Labels & I2C Address */}
        <div className="lcd-pcb-header">
          <div className="lcd-pins">
            <span className="lcd-pin"><span className="pin-dot"></span>GND</span>
            <span className="lcd-pin"><span className="pin-dot"></span>VCC (5V)</span>
            <span className="lcd-pin highlight"><span className="pin-dot"></span>SDA (D21)</span>
            <span className="lcd-pin highlight"><span className="pin-dot"></span>SCL (D22)</span>
          </div>
          <div className="lcd-model-badge">
            <Cpu size={14} className="text-cyan" />
            <span>16x2 HD44780 • I2C Addr: <strong>0x27</strong></span>
          </div>
        </div>

        {/* Physical LCD Bezel Frame */}
        <div className="lcd-screen-bezel">
          {/* Active Screen Surface */}
          <div
            className="lcd-screen-surface"
            style={{
              backgroundColor: themeStyles.screenBg,
              borderColor: themeStyles.screenBorder,
              boxShadow: backlightOn ? `inset 0 0 25px rgba(0,0,0,0.5), 0 0 20px ${themeStyles.accent}33` : 'inset 0 0 35px rgba(0,0,0,0.8)',
            }}
          >
            {/* LCD Matrix Row 0 (Line 1: 16 character cells) */}
            <div className="lcd-matrix-row">
              {line1Chars.map((char, index) => (
                <div
                  key={`r0-c${index}`}
                  className="lcd-char-cell"
                  style={{ backgroundColor: themeStyles.charBg }}
                >
                  <span
                    className="lcd-char-glyph"
                    style={{
                      color: themeStyles.textColor,
                      opacity: textOpacity,
                      textShadow: themeStyles.glow,
                    }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                </div>
              ))}
            </div>

            {/* LCD Matrix Row 1 (Line 2: 16 character cells) */}
            <div className="lcd-matrix-row">
              {line2Chars.map((char, index) => (
                <div
                  key={`r1-c${index}`}
                  className="lcd-char-cell"
                  style={{ backgroundColor: themeStyles.charBg }}
                >
                  <span
                    className="lcd-char-glyph"
                    style={{
                      color: themeStyles.textColor,
                      opacity: textOpacity,
                      textShadow: themeStyles.glow,
                    }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Bezel Sub-bar with Hardware Status Indicator */}
          <div className="lcd-bezel-footer">
            <div className="lcd-status-left">
              <span className={`lcd-indicator-led ${bleState?.isConnected ? 'connected' : 'disconnected'}`}></span>
              <span className="lcd-status-text">
                {bleState?.isConnected ? (
                  <>BLE: <strong className="text-cyan">ONLINE</strong> ({bleState.isSimulated ? 'Virtual' : 'Hardware ESP32'})</>
                ) : (
                  <>BLE: <span className="text-muted">ADVERTISING</span> ('ESP32-Smart-Notice-Board')</>
                )}
              </span>
            </div>
            <div className="lcd-speed-indicator">
              <span>Shift Delay: {displayNotice.scrollSpeed === 'Fast' ? '220ms' : displayNotice.scrollSpeed === 'Slow' ? '500ms' : '350ms'}</span>
            </div>
          </div>
        </div>

        {/* Backplane Trimmer & Controls Bar (Simulates LCD Contrast & Backlight) */}
        <div className="lcd-trimmer-bar">
          <div className="trimmer-control">
            <Sliders size={14} className="text-muted" />
            <label className="trimmer-label">Potentiometer Contrast:</label>
            <input
              type="range"
              min="20"
              max="100"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="contrast-slider"
              title="Simulates rotating the blue trimmer potentiometer on the back of PCF8574 backpack"
            />
            <span className="trimmer-value">{contrast}%</span>
          </div>

          <div className="trimmer-actions">
            <button
              className={`btn-subtle ${backlightOn ? 'active' : ''}`}
              onClick={() => setBacklightOn(!backlightOn)}
              title="Toggle LCD Backlight (Pin 15/16)"
            >
              <Sun size={14} />
              <span>Backlight: {backlightOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Control Toolbar */}
      <div className="lcd-sim-controls">
        <div className="controls-left">
          {/* Pause / Play scrolling */}
          <button
            className={`btn-icon-label ${isPaused ? 'btn-paused' : ''}`}
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume Scrolling' : 'Pause Scrolling'}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Reset scrolling */}
          <button
            className="btn-icon-label"
            onClick={() => setScrollIndex(0)}
            title="Reset Scroll to Start"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          {/* Theme Switcher */}
          <div className="theme-selector-group">
            <Palette size={14} className="text-muted" />
            <button
              className={`theme-chip ${theme === 'blue' ? 'active' : ''}`}
              onClick={() => setTheme('blue')}
              style={{ backgroundColor: '#0f42b3' }}
              title="Classic Blue Backlight (White Chars)"
            />
            <button
              className={`theme-chip ${theme === 'green' ? 'active' : ''}`}
              onClick={() => setTheme('green')}
              style={{ backgroundColor: '#7a8c17' }}
              title="Retro Yellow-Green Backlight"
            />
            <button
              className={`theme-chip ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              style={{ backgroundColor: '#111827' }}
              title="Monochrome Dark"
            />
          </div>
        </div>

        <div className="controls-right">
          {/* Auto Rotate Notice Switch */}
          {activeNoticesList.length > 1 && (
            <button
              className={`btn-chip ${autoRotate ? 'active' : ''}`}
              onClick={() => setAutoRotate(!autoRotate)}
            >
              Auto-Cycle ({activeNoticesList.length})
            </button>
          )}

          {/* Packet Inspector Toggle */}
          <button
            className={`btn-icon-label ${showPacketInspector ? 'active' : ''}`}
            onClick={() => setShowPacketInspector(!showPacketInspector)}
          >
            <Terminal size={14} />
            <span>GATT Packet</span>
          </button>

          {/* Transmit Button if connected */}
          {onSendToBoard && activeNotice && (
            <button
              className="btn-transmit-quick"
              onClick={() => onSendToBoard(activeNotice)}
              title="Send active notice payload to ESP32 over BLE"
            >
              <Zap size={14} />
              <span>Push to Board</span>
            </button>
          )}
        </div>
      </div>

      {/* BLE JSON GATT Packet Inspector Modal/Panel */}
      {showPacketInspector && (
        <div className="packet-inspector-card glass-panel">
          <div className="packet-header">
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-cyan" />
              <span className="font-semibold text-sm">ESP32 BLE GATT Packet (JSON Wire Format)</span>
            </div>
            <span className="text-xs text-muted">UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8</span>
          </div>
          <pre className="packet-json-body">{rawPayload}</pre>
          <div className="packet-footer">
            <span className="text-xs text-dim">
              Encoded size: {new TextEncoder().encode(rawPayload).length} bytes • Transmitted via writeValueWithResponse()
            </span>
          </div>
        </div>
      )}

      {/* Component Styles */}
      <style>{`
        .lcd-simulator-wrapper {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .lcd-hardware-frame {
          background: #090e1a;
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: var(--radius-lg);
          padding: 16px;
          box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.7);
          transition: all 0.3s ease;
        }

        .lcd-pcb-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
          margin-bottom: 14px;
        }

        .lcd-pins {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .lcd-pin {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.04);
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .lcd-pin.highlight {
          color: var(--accent-cyan);
          border-color: rgba(0, 240, 255, 0.3);
          background: rgba(0, 240, 255, 0.06);
        }

        .pin-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #fbbf24;
          box-shadow: 0 0 4px #fbbf24;
        }

        .lcd-model-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-main);
          background: rgba(16, 24, 42, 0.8);
          padding: 3px 10px;
          border-radius: 12px;
          border: 1px solid rgba(0, 240, 255, 0.2);
        }

        .lcd-screen-bezel {
          background: #020610;
          border: 4px solid #1e293b;
          border-radius: 8px;
          padding: 14px;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);
        }

        .lcd-screen-surface {
          border-radius: 4px;
          padding: 16px 12px;
          border: 2px solid;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: background-color 0.3s ease, border-color 0.3s ease;
          overflow: hidden;
        }

        .lcd-matrix-row {
          display: grid;
          grid-template-columns: repeat(16, minmax(0, 1fr));
          gap: 3px;
        }

        .lcd-char-cell {
          aspect-ratio: 5 / 8;
          min-height: clamp(26px, 2.8vw, 36px);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 2px;
          box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.4);
          transition: background-color 0.3s ease;
        }

        .lcd-char-glyph {
          font-family: 'Courier New', 'VT323', monospace;
          font-size: clamp(14px, 1.6vw, 20px);
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.5px;
          user-select: none;
          transition: opacity 0.15s ease;
        }

        .lcd-bezel-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .lcd-status-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .lcd-indicator-led {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .lcd-indicator-led.connected {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .lcd-indicator-led.disconnected {
          background: #f59e0b;
          box-shadow: 0 0 8px #f59e0b;
        }

        .lcd-trimmer-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 10px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .trimmer-control {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .contrast-slider {
          width: 110px;
          accent-color: var(--accent-cyan);
          cursor: pointer;
        }

        .trimmer-value {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-main);
          min-width: 32px;
        }

        .btn-subtle {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-muted);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-subtle.active {
          background: rgba(0, 240, 255, 0.12);
          border-color: rgba(0, 240, 255, 0.4);
          color: var(--accent-cyan);
        }

        .lcd-sim-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          background: rgba(16, 24, 42, 0.6);
          padding: 8px 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--glass-border);
        }

        .controls-left, .controls-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-icon-label {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-main);
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-icon-label:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(0, 240, 255, 0.3);
        }

        .btn-icon-label.btn-paused {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.4);
          color: #fbbf24;
        }

        .btn-icon-label.active {
          background: rgba(0, 240, 255, 0.15);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }

        .theme-selector-group {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-left: 6px;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }

        .theme-chip {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s;
        }

        .theme-chip.active {
          border-color: #ffffff;
          transform: scale(1.15);
        }

        .btn-transmit-quick {
          display: flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #0284c7, #06b6d4);
          border: none;
          color: white;
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 0 12px rgba(6, 182, 212, 0.35);
          transition: all 0.2s;
        }

        .btn-transmit-quick:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 16px rgba(6, 182, 212, 0.5);
        }

        .packet-inspector-card {
          margin-top: 4px;
          padding: 14px;
          border-radius: var(--radius-md);
          background: rgba(10, 15, 26, 0.95);
          border: 1px solid rgba(0, 240, 255, 0.25);
        }

        .packet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          flex-wrap: wrap;
          gap: 6px;
        }

        .packet-json-body {
          font-family: var(--font-mono);
          font-size: 12px;
          color: #38bdf8;
          background: #060913;
          padding: 10px 14px;
          border-radius: 6px;
          overflow-x: auto;
          line-height: 1.45;
          border: 1px solid rgba(56, 189, 248, 0.15);
        }

        .packet-footer {
          margin-top: 8px;
          display: flex;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
};

