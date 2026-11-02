import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  Code2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Radio,
  Clock,
  Wifi,
} from 'lucide-react';

export const OledDisplaySimulator = ({
  activeNotice,
  bleState,
  onSendToBoard,
  activeNoticesList = [],
}) => {
  // Theme state: cyan (classic OLED), amber, emerald, white
  const [theme, setTheme] = useState('cyan'); // 'cyan' | 'amber' | 'emerald' | 'white'
  const [isPaused, setIsPaused] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showPacketInspector, setShowPacketInspector] = useState(false);
  const [urgentBlink, setUrgentBlink] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  // References
  const animationFrameRef = useRef(null);
  const lastTickRef = useRef(Date.now());

  // Current notice defaults
  const notice = activeNotice || {
    title: 'SMART NOTICE BD',
    content: 'Awaiting BLE transmission from Admin Web Portal. Pair via Web Bluetooth to push live campus notices.',
    priority: 'Normal',
    category: 'System',
    scrollSpeed: 'Medium',
  };

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Urgent title blink effect
  useEffect(() => {
    if (notice.priority === 'Urgent') {
      const interval = setInterval(() => {
        setUrgentBlink((prev) => !prev);
      }, 600);
      return () => clearInterval(interval);
    } else {
      setUrgentBlink(false);
    }
  }, [notice.priority]);

  // Pixel scroll animation
  useEffect(() => {
    // Determine speed delay: Fast=18px/s, Medium=32px/s, Slow=50px/s (or pixel step)
    const speedMs = notice.scrollSpeed === 'Fast' ? 22 : notice.scrollSpeed === 'Slow' ? 55 : 35;
    
    // Reset offset on notice change
    setScrollOffset(0);

    const scrollInterval = setInterval(() => {
      if (!isPaused) {
        setScrollOffset((prev) => {
          // Wrap around after full text has scrolled
          const maxScroll = (notice.content.length * 8.5) + 240;
          if (prev > maxScroll) {
            return -220; // reset to right side
          }
          return prev + 1.5;
        });
      }
    }, speedMs);

    return () => clearInterval(scrollInterval);
  }, [notice.content, notice.scrollSpeed, isPaused]);

  // Color themes definition
  const themes = {
    cyan: {
      name: 'Electric Cyan',
      glow: '#00f0ff',
      dim: '#004d54',
      bg: '#040b14',
      text: '#38f8ff',
      accent: '#00f0ff',
      invertedBg: '#00f0ff',
      invertedText: '#040b14',
    },
    amber: {
      name: 'Retro Amber',
      glow: '#ffb000',
      dim: '#4d3300',
      bg: '#140c02',
      text: '#ffc83b',
      accent: '#ffb000',
      invertedBg: '#ffb000',
      invertedText: '#140c02',
    },
    emerald: {
      name: 'Matrix Emerald',
      glow: '#10b981',
      dim: '#064e3b',
      bg: '#03140a',
      text: '#34d399',
      accent: '#10b981',
      invertedBg: '#10b981',
      invertedText: '#03140a',
    },
    white: {
      name: 'Monochrome White',
      glow: '#f8fafc',
      dim: '#475569',
      bg: '#0a0d14',
      text: '#ffffff',
      accent: '#cbd5e1',
      invertedBg: '#f8fafc',
      invertedText: '#0a0d14',
    },
  };

  const activePalette = themes[theme] || themes.cyan;

  // JSON payload structure representing what ESP32 receives over GATT
  const gattPacketPreview = {
    title: notice.title,
    content: notice.content,
    priority: notice.priority || 'Normal',
    category: notice.category || 'General',
    scrollSpeed: notice.scrollSpeed || 'Medium',
    timestamp: new Date().toISOString(),
    display: 'SSD1306_128x64_I2C',
    i2c_address: '0x3C',
  };

  return (
    <div className="oled-simulator-wrapper">
      {/* Hardware Chassis */}
      <div className="oled-hardware-frame">
        {/* Top PCB Pin Header */}
        <div className="oled-pcb-header">
          <div className="oled-pins">
            <span className="oled-pin highlight" title="3.3V Logic Supply (ESP32 3.3V)">
              <span className="pin-dot"></span> VCC (3.3V)
            </span>
            <span className="oled-pin highlight" title="Ground (ESP32 GND)">
              <span className="pin-dot"></span> GND
            </span>
            <span className="oled-pin highlight" title="I2C Clock SCL (ESP32 GPIO 22)">
              <span className="pin-dot"></span> SCL (D22)
            </span>
            <span className="oled-pin highlight" title="I2C Data SDA (ESP32 GPIO 21)">
              <span className="pin-dot"></span> SDA (D21)
            </span>
          </div>
          <div className="oled-model-badge">
            <span className="chip-label">SSD1306 • 128×64</span>
            <span className="addr-tag">0x3C</span>
          </div>
        </div>

        {/* OLED Glass Screen Bezel */}
        <div className="oled-screen-bezel">
          {/* OLED Surface */}
          <div
            className="oled-screen-surface"
            style={{
              backgroundColor: activePalette.bg,
              '--oled-color': activePalette.text,
              '--oled-glow': activePalette.glow,
              '--oled-dim': activePalette.dim,
              '--oled-inv-bg': activePalette.invertedBg,
              '--oled-inv-text': activePalette.invertedText,
            }}
          >
            {/* CRT / Pixel Scanline Mesh Overlay */}
            <div className="oled-scanlines"></div>
            <div className="oled-pixel-grid"></div>

            {/* SCREEN CONTENT ZONES */}
            <div className="oled-screen-content">
              {/* Zone 0: Inverted Header Bar (10px) */}
              <div className="oled-zone-header">
                <span className="oled-header-priority">
                  {notice.priority === 'Urgent'
                    ? '[!URGENT]'
                    : notice.priority === 'Important'
                    ? '[IMP]'
                    : '[INFO]'}
                </span>
                <span className="oled-header-clock">{currentTime}</span>
                <span className="oled-header-ble">
                  {bleState?.isConnected ? 'BLE:CONNECTED' : 'BLE:ADV'}
                </span>
              </div>

              {/* Zone 1: Notice Title (12-22px) */}
              <div className="oled-zone-title">
                {notice.priority === 'Urgent' && urgentBlink ? (
                  <span className="oled-urgent-blink">*** {notice.title.toUpperCase()} ***</span>
                ) : (
                  <span className="oled-title-text">{notice.title}</span>
                )}
              </div>

              {/* Zone 2: Horizontal Divider Rule */}
              <div className="oled-divider"></div>

              {/* Zone 3: Smooth Pixel Marquee Ticker (24px) */}
              <div className="oled-zone-marquee">
                <div
                  className="oled-marquee-track"
                  style={{
                    transform: `translateX(${-scrollOffset}px)`,
                  }}
                >
                  <span className="oled-marquee-text">{notice.content}</span>
                  <span className="oled-marquee-spacer">✦ ✦ ✦</span>
                  <span className="oled-marquee-text">{notice.content}</span>
                </div>
              </div>

              {/* Zone 4: Divider Rule */}
              <div className="oled-divider"></div>

              {/* Zone 5: Status Footer Bar (12px) */}
              <div className="oled-zone-footer">
                <span className="oled-footer-cat">
                  {notice.category || 'General'}
                </span>
                <span className="oled-footer-speed">
                  SPD: {notice.scrollSpeed === 'Fast' ? 'F' : notice.scrollSpeed === 'Slow' ? 'S' : 'M'}
                </span>
                <span className="oled-footer-res">128×64 px</span>
              </div>
            </div>
          </div>

          {/* Bezel Bottom Labels */}
          <div className="oled-bezel-footer">
            <div className="oled-status-left">
              <span
                className={`oled-indicator-led ${
                  bleState?.isConnected ? 'active' : 'idle'
                }`}
              ></span>
              <span className="oled-hw-label">
                {bleState?.isConnected
                  ? bleState.isSimulated
                    ? 'VIRTUAL OLED MIRROR'
                    : 'HARDWARE LINKED'
                  : 'STANDBY (0x3C)'}
              </span>
            </div>
            <span className="oled-screen-spec">0.96" MONOCHROME OLED</span>
          </div>
        </div>
      </div>

      {/* Simulator Control Bar */}
      <div className="oled-sim-controls">
        <div className="sim-control-group">
          {/* Pause / Play */}
          <button
            className={`btn-control-icon ${isPaused ? 'active' : ''}`}
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume Scrolling' : 'Pause Scrolling'}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>

          {/* Reset Scroll */}
          <button
            className="btn-control-icon"
            onClick={() => setScrollOffset(0)}
            title="Reset Marquee to Start"
          >
            <RotateCcw size={13} />
          </button>

          {/* Theme Selector */}
          <div className="palette-picker">
            <Sparkles size={12} className="text-muted" />
            {Object.keys(themes).map((tKey) => (
              <button
                key={tKey}
                className={`theme-dot ${theme === tKey ? 'active' : ''}`}
                style={{ backgroundColor: themes[tKey].glow }}
                onClick={() => setTheme(tKey)}
                title={`Switch to ${themes[tKey].name}`}
              />
            ))}
          </div>
        </div>

        {/* View GATT Packet Inspector */}
        <button
          className="btn-text-inspector"
          onClick={() => setShowPacketInspector(!showPacketInspector)}
        >
          <Code2 size={13} />
          <span>BLE GATT JSON</span>
          {showPacketInspector ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Active Notice Quick Selector Dropdown (if multiple exist) */}
      {activeNoticesList.length > 1 && (
        <div className="quick-notice-selector">
          <span className="selector-label">
            <Layers size={12} /> Switch Mirror:
          </span>
          <div className="selector-chips">
            {activeNoticesList.map((n) => (
              <button
                key={n._id || n.title}
                className={`selector-chip ${
                  n.title === notice.title ? 'active' : ''
                }`}
                onClick={() => onSendToBoard && onSendToBoard(n)}
                title={n.content}
              >
                {n.title.length > 18 ? n.title.substring(0, 18) + '...' : n.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BLE Packet Inspector Collapsible */}
      {showPacketInspector && (
        <div className="packet-inspector-panel">
          <div className="inspector-header">
            <div className="inspector-title">
              <Radio size={13} className="text-cyan" />
              <span>BLE GATT Characteristic Write Payload (0x2902)</span>
            </div>
            <span className="payload-size">
              {JSON.stringify(gattPacketPreview).length} bytes
            </span>
          </div>
          <pre className="inspector-code">
            {JSON.stringify(gattPacketPreview, null, 2)}
          </pre>
        </div>
      )}

      {/* Component Styles */}
      <style>{`
        .oled-simulator-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
          user-select: none;
        }

        .oled-hardware-frame {
          background: linear-gradient(180deg, #121826 0%, #0a0d16 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 14px 16px 16px 16px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          position: relative;
        }

        .oled-pcb-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
        }

        .oled-pins {
          display: flex;
          gap: 10px;
        }

        .oled-pin {
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.03);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .oled-pin.highlight {
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.25);
        }

        .pin-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #eab308;
          box-shadow: 0 0 4px #eab308;
        }

        .oled-model-badge {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .chip-label {
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #94a3b8;
        }

        .addr-tag {
          font-family: var(--font-mono, monospace);
          font-size: 8px;
          background: rgba(0, 240, 255, 0.15);
          color: #00f0ff;
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid rgba(0, 240, 255, 0.3);
        }

        /* Screen Bezel */
        .oled-screen-bezel {
          background: #020408;
          border-radius: 8px;
          padding: 10px;
          border: 2px solid #1a2234;
          box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.95);
        }

        /* Pixel Screen Surface */
        .oled-screen-surface {
          position: relative;
          height: 160px;
          border-radius: 4px;
          overflow: hidden;
          padding: 6px 8px;
          box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
        }

        /* Scanlines Overlay */
        .oled-scanlines {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%,
            rgba(0, 0, 0, 0.35) 50%
          );
          background-size: 100% 3px;
          pointer-events: none;
          z-index: 10;
          opacity: 0.75;
        }

        .oled-pixel-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 0);
          background-size: 3px 3px;
          pointer-events: none;
          z-index: 9;
        }

        /* Screen Content */
        .oled-screen-content {
          position: relative;
          z-index: 5;
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          font-family: 'Courier New', Courier, monospace;
        }

        /* Zone 0: Header */
        .oled-zone-header {
          background: var(--oled-inv-bg);
          color: var(--oled-inv-text);
          font-weight: 800;
          font-size: 10px;
          line-height: 1.2;
          padding: 2px 4px;
          border-radius: 2px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          letter-spacing: 0.05em;
        }

        .oled-header-priority {
          font-weight: 900;
        }

        .oled-header-clock {
          font-size: 9px;
          font-weight: 700;
        }

        .oled-header-ble {
          font-size: 8px;
          font-weight: 800;
        }

        /* Zone 1: Title */
        .oled-zone-title {
          padding: 4px 0 2px 0;
          color: var(--oled-color);
          text-shadow: 0 0 6px var(--oled-glow);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .oled-urgent-blink {
          color: #f43f5e;
          text-shadow: 0 0 8px #f43f5e;
          animation: blink 0.6s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        /* Dividers */
        .oled-divider {
          height: 1px;
          background: var(--oled-color);
          opacity: 0.45;
          box-shadow: 0 0 3px var(--oled-glow);
          margin: 1px 0;
        }

        /* Zone 3: Marquee */
        .oled-zone-marquee {
          overflow: hidden;
          position: relative;
          height: 48px;
          display: flex;
          align-items: center;
        }

        .oled-marquee-track {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          will-change: transform;
        }

        .oled-marquee-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--oled-color);
          text-shadow: 0 0 5px var(--oled-glow);
          letter-spacing: 0.05em;
        }

        .oled-marquee-spacer {
          margin: 0 24px;
          color: var(--oled-dim);
          font-size: 10px;
        }

        /* Zone 5: Footer */
        .oled-zone-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
          color: var(--oled-color);
          opacity: 0.85;
          text-shadow: 0 0 4px var(--oled-glow);
          padding-top: 2px;
        }

        .oled-footer-cat {
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .oled-footer-speed, .oled-footer-res {
          font-size: 8px;
          font-weight: 600;
        }

        /* Bezel Footer */
        .oled-bezel-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          padding: 0 2px;
        }

        .oled-status-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .oled-indicator-led {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #475569;
          transition: all 0.3s;
        }

        .oled-indicator-led.active {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .oled-indicator-led.idle {
          background: #f59e0b;
          box-shadow: 0 0 5px #f59e0b;
        }

        .oled-hw-label {
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.06em;
        }

        .oled-screen-spec {
          font-family: var(--font-mono, monospace);
          font-size: 8px;
          color: #64748b;
        }

        /* Controls */
        .oled-sim-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(16, 24, 40, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 6px 10px;
          border-radius: 8px;
        }

        .sim-control-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-control-icon {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          padding: 5px 8px;
          border-radius: 5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .btn-control-icon:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .btn-control-icon.active {
          background: rgba(245, 158, 11, 0.2);
          border-color: #f59e0b;
          color: #fbbf24;
        }

        .palette-picker {
          display: flex;
          align-items: center;
          gap: 5px;
          padding-left: 6px;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
        }

        .theme-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .theme-dot:hover {
          transform: scale(1.15);
        }

        .theme-dot.active {
          border-color: #ffffff;
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
        }

        .btn-text-inspector {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-text-inspector:hover {
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.08);
        }

        /* Chips */
        .quick-notice-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          padding: 2px 0;
        }

        .selector-label {
          font-size: 11px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        .selector-chips {
          display: flex;
          gap: 6px;
        }

        .selector-chip {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 10px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .selector-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .selector-chip.active {
          background: rgba(0, 240, 255, 0.15);
          border-color: rgba(0, 240, 255, 0.35);
          color: #00f0ff;
          font-weight: 600;
        }

        /* Packet Inspector */
        .packet-inspector-panel {
          background: #020611;
          border: 1px solid #101c34;
          border-radius: 8px;
          padding: 10px 12px;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .inspector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .inspector-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #cbd5e1;
        }

        .payload-size {
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          color: #64748b;
        }

        .inspector-code {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: #38bdf8;
          background: rgba(0, 0, 0, 0.4);
          padding: 8px;
          border-radius: 6px;
          overflow-x: auto;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};

