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
  Volume2,
  VolumeX,
  BellRing,
  Send,
} from 'lucide-react';

export const OledDisplaySimulator = ({
  activeNotice,
  bleState,
  onSendToBoard,
  onSyncAllToBoard,
  activeNoticesList = [],
}) => {
  // Theme state: cyan (classic OLED), amber, emerald, white
  const [theme, setTheme] = useState('cyan'); // 'cyan' | 'amber' | 'emerald' | 'white'
  const [isPaused, setIsPaused] = useState(false);
  const [showPacketInspector, setShowPacketInspector] = useState(false);
  const [urgentBlink, setUrgentBlink] = useState(false);
  const [buzzerPulsing, setBuzzerPulsing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [scrollOffsets, setScrollOffsets] = useState([0, 0, 0, 0]);

  // Audio Context Ref for simulated 2700Hz buzzer
  const audioCtxRef = useRef(null);

  // Priority sorting helper
  const priorityRank = { Urgent: 3, Important: 2, Normal: 1 };

  // Prepare up to 4 active notices sorted by priority (Urgent -> Important -> Normal)
  // No fake default notice: if empty, displayNotices is empty []
  const displayNotices = React.useMemo(() => {
    let list = [...activeNoticesList];
    if (list.length === 0 && activeNotice) {
      list = [activeNotice];
    }
    // Sort by priority rank descending
    return list
      .sort((a, b) => (priorityRank[b.priority] || 1) - (priorityRank[a.priority] || 1))
      .slice(0, 4);
  }, [activeNoticesList, activeNotice]);

  const hasUrgent = displayNotices.some((n) => n.priority === 'Urgent');

  // Urgent blink timer (500ms)
  useEffect(() => {
    if (hasUrgent) {
      const interval = setInterval(() => {
        setUrgentBlink((prev) => !prev);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setUrgentBlink(false);
    }
  }, [hasUrgent]);

  // Play simulated 2700Hz Double Warning Tone via Web Audio API
  const triggerBuzzerAudio = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      // Beep 1: 2700 Hz square wave, 100ms
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(2700, now);
      gain1.gain.setValueAtTime(0.09, now);
      gain1.gain.setValueAtTime(0.0, now + 0.10);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.10);

      // Beep 2: 2700 Hz square wave, 100ms (after 80ms gap -> offset 0.18s)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(2700, now + 0.18);
      gain2.gain.setValueAtTime(0.09, now + 0.18);
      gain2.gain.setValueAtTime(0.0, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.28);
    } catch (err) {
      console.warn('Web Audio error:', err);
    }
  };

  // 5-Second Interval Urgent Buzzer Loop
  useEffect(() => {
    if (!hasUrgent) {
      setBuzzerPulsing(false);
      return;
    }

    const fireDoubleBeep = () => {
      setBuzzerPulsing(true);
      if (audioEnabled) {
        triggerBuzzerAudio();
      }
      setTimeout(() => {
        setBuzzerPulsing(false);
      }, 300);
    };

    // Fire immediately upon urgent notice detection
    fireDoubleBeep();

    // Repeat every 5000ms
    const interval = setInterval(fireDoubleBeep, 5000);
    return () => clearInterval(interval);
  }, [hasUrgent, audioEnabled]);

  // Independent horizontal side-scrolling for each notice row
  useEffect(() => {
    if (isPaused || displayNotices.length === 0) return;

    const interval = setInterval(() => {
      setScrollOffsets((prevOffsets) =>
        displayNotices.map((n, idx) => {
          const fullText = `${n.title}: ${n.content}`;
          const textPixelLen = fullText.length * 7.5;
          const visibleWidth = 230; // container px width

          if (textPixelLen <= visibleWidth) {
            return 0; // fits statically
          }

          const curOffset = prevOffsets[idx] || 0;
          const speedStep = n.scrollSpeed === 'Fast' ? 2.2 : n.scrollSpeed === 'Slow' ? 1.0 : 1.5;

          if (curOffset > textPixelLen + 60) {
            return -30;
          }
          return curOffset + speedStep;
        })
      );
    }, 32);

    return () => clearInterval(interval);
  }, [displayNotices, isPaused]);

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

  // JSON payload preview for BLE inspector
  const gattPacketPreview = {
    action: 'sync',
    count: displayNotices.length,
    notices: displayNotices.map((n) => ({
      title: n.title,
      content: n.content,
      priority: n.priority,
      category: n.category || 'General',
    })),
    timestamp: new Date().toISOString(),
    hardware: {
      oled: 'SSD1306_128x64_I2C_0x3C',
      buzzer: 'LEDC PWM 2700Hz Double-Beep (5s interval)',
      leds: 'Green (D25 BLE), Red (D26 Urgent)',
    },
  };

  return (
    <div className="oled-simulator-wrapper">
      {/* Hardware Chassis */}
      <div className={`oled-hardware-frame ${buzzerPulsing ? 'buzzer-pulsing-frame' : ''}`}>
        {/* Top PCB Pin Header */}
        <div className="oled-pcb-header">
          <div className="oled-pins">
            <span className="oled-pin highlight" title="3.3V Supply">
              <span className="pin-dot"></span> VCC (3.3V)
            </span>
            <span className="oled-pin highlight" title="Ground">
              <span className="pin-dot"></span> GND
            </span>
            <span className="oled-pin highlight" title="I2C Clock SCL (GPIO 22)">
              <span className="pin-dot"></span> SCL (D22)
            </span>
            <span className="oled-pin highlight" title="I2C Data SDA (GPIO 21)">
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
            {/* Scanlines & Pixel Grid */}
            <div className="oled-scanlines"></div>
            <div className="oled-pixel-grid"></div>

            {/* SCREEN CONTENT: Clean Multi-Line Priority Stack */}
            <div className="oled-screen-content">
              {displayNotices.length === 0 ? (
                <div className="oled-empty-state">
                  <div className="oled-empty-title">No Active Notices</div>
                  <div className="oled-empty-sub">
                    {bleState?.isConnected ? 'BLE Connected • Ready' : 'Ready for BLE Sync'}
                  </div>
                </div>
              ) : (
                <div className="oled-stack-container">
                  {displayNotices.map((n, idx) => {
                    const isUrgent = n.priority === 'Urgent';
                    const isImportant = n.priority === 'Important';
                    const fullText = `${n.title}: ${n.content}`;
                    const offset = scrollOffsets[idx] || 0;
                    const isScrolling = offset > 0;

                    return (
                      <div key={idx} className="oled-stack-row">
                        {/* Fixed Priority Badge on Left */}
                        <div
                          className={`oled-row-badge ${
                            isUrgent ? 'badge-urgent' : isImportant ? 'badge-important' : 'badge-normal'
                          }`}
                        >
                          {isUrgent ? (
                            <span className={urgentBlink ? 'badge-blink' : ''}>!</span>
                          ) : isImportant ? (
                            '*'
                          ) : (
                            '-'
                          )}
                        </div>

                        {/* Side-Scrolling Notice Text */}
                        <div className="oled-row-track-container">
                          <div
                            className="oled-row-track"
                            style={{
                              transform: isScrolling ? `translateX(-${offset}px)` : 'translateX(0)',
                            }}
                          >
                            <span className="oled-row-text">{fullText}</span>
                            {isScrolling && (
                              <>
                                <span className="oled-row-spacer">✦ ✦ ✦</span>
                                <span className="oled-row-text">{fullText}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bezel Bottom Status & Hardware LED / Buzzer Indicators */}
          <div className="oled-bezel-footer">
            <div className="oled-status-left">
              {/* Green LED: BLE Connected */}
              <div className="hw-indicator" title="GPIO 25: Green LED (BLE Connection)">
                <span
                  className={`oled-indicator-led led-green ${
                    bleState?.isConnected ? 'active' : 'idle'
                  }`}
                ></span>
                <span className="oled-hw-label">D25:BLE</span>
              </div>

              {/* Red LED: Urgent Notice Active */}
              <div className="hw-indicator" title="GPIO 26: Red LED (Urgent Notice)">
                <span
                  className={`oled-indicator-led led-red ${hasUrgent ? 'active' : 'idle'}`}
                ></span>
                <span className="oled-hw-label">D26:URG</span>
              </div>

              {/* Buzzer: 2700Hz Alert Indicator */}
              <div
                className={`hw-indicator ${buzzerPulsing ? 'buzzer-active' : ''}`}
                title="GPIO 27: Buzzer (2700Hz Double-Beep every 5s)"
              >
                <BellRing
                  size={11}
                  className={buzzerPulsing ? 'text-red-pulse' : hasUrgent ? 'text-amber' : 'text-muted'}
                />
                <span className="oled-hw-label">
                  D27:BUZZ {buzzerPulsing ? '(2.7kHz BEEP)' : hasUrgent ? '(5s Int)' : '(OFF)'}
                </span>
              </div>
            </div>

            {/* Audio Toggle for browser sound preview */}
            <button
              className={`btn-sound-toggle ${audioEnabled ? 'sound-on' : ''}`}
              onClick={() => setAudioEnabled(!audioEnabled)}
              title={audioEnabled ? 'Mute 2700Hz Buzzer sound preview' : 'Enable 2700Hz buzzer sound preview'}
            >
              {audioEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
              <span>{audioEnabled ? 'AUDIO ON' : 'TEST SOUND'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Control Toolbar */}
      <div className="oled-sim-controls">
        <div className="sim-control-group">
          {/* Pause / Play Scrolling */}
          <button
            className={`btn-control-icon ${isPaused ? 'active' : ''}`}
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume Scrolling' : 'Pause Scrolling'}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>

          {/* Reset Scroll Offsets */}
          <button
            className="btn-control-icon"
            onClick={() => setScrollOffsets([0, 0, 0, 0])}
            title="Reset All Lines to Start"
          >
            <RotateCcw size={13} />
          </button>

          {/* Theme Palette Dots */}
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

        <div className="sim-action-group">
          {/* Sync All Active Notices to ESP32 */}
          {onSyncAllToBoard && (
            <button
              className="btn-sync-all"
              onClick={onSyncAllToBoard}
              title="Transmit active notices to ESP32 priority stack"
            >
              <Send size={12} />
              <span>Sync All to Board ({displayNotices.length})</span>
            </button>
          )}

          {/* Packet Inspector Toggle */}
          <button
            className="btn-text-inspector"
            onClick={() => setShowPacketInspector(!showPacketInspector)}
          >
            <Code2 size={13} />
            <span>BLE Payload</span>
            {showPacketInspector ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Active Notice Quick Selector Chips */}
      {displayNotices.length > 0 && (
        <div className="quick-notice-selector">
          <span className="selector-label">
            <Layers size={12} /> Active Notices ({displayNotices.length}):
          </span>
          <div className="selector-chips">
            {displayNotices.map((n, idx) => (
              <button
                key={n._id || idx}
                className={`selector-chip ${n.priority === 'Urgent' ? 'chip-urgent' : ''}`}
                onClick={() => onSendToBoard && onSendToBoard(n)}
                title={`Click to push "${n.title}" to board`}
              >
                <span className="chip-badge">{n.priority === 'Urgent' ? '!' : n.priority === 'Important' ? '*' : '-'}</span>
                {n.title.length > 16 ? n.title.substring(0, 16) + '...' : n.title}
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
              <span>GATT Characteristic Sync Packet (128x64 Priority Stack)</span>
            </div>
            <span className="payload-size">{JSON.stringify(gattPacketPreview).length} bytes</span>
          </div>
          <pre className="inspector-code">{JSON.stringify(gattPacketPreview, null, 2)}</pre>
        </div>
      )}

      {/* Embedded Component Styles */}
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
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .oled-hardware-frame.buzzer-pulsing-frame {
          border-color: rgba(244, 63, 94, 0.7);
          box-shadow: 0 0 24px rgba(244, 63, 94, 0.35), inset 0 0 12px rgba(244, 63, 94, 0.2);
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
          height: 165px;
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
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%);
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
          font-family: 'Courier New', Courier, monospace;
        }

        /* Empty State */
        .oled-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          gap: 6px;
        }

        .oled-empty-title {
          font-size: 13px;
          font-weight: 800;
          color: var(--oled-color);
          text-shadow: 0 0 6px var(--oled-glow);
          letter-spacing: 0.05em;
        }

        .oled-empty-sub {
          font-size: 10px;
          color: var(--oled-dim);
          letter-spacing: 0.04em;
        }

        /* Multi-Line Stack Container */
        .oled-stack-container {
          display: flex;
          flex-direction: column;
          gap: 2px;
          height: 100%;
          justify-content: space-around;
        }

        .oled-stack-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.15);
          overflow: hidden;
          position: relative;
        }

        .oled-stack-row:last-child {
          border-bottom: none;
        }

        /* Fixed Priority Badge on Left */
        .oled-row-badge {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 900;
          border-radius: 2px;
          z-index: 6;
        }

        .badge-urgent {
          background: var(--oled-inv-bg);
          color: var(--oled-inv-text);
          box-shadow: 0 0 5px var(--oled-glow);
        }

        .badge-important {
          border: 1px solid var(--oled-color);
          color: var(--oled-color);
        }

        .badge-normal {
          color: var(--oled-dim);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .badge-blink {
          animation: textBlink 0.5s infinite;
        }

        @keyframes textBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        /* Horizontal Track Container */
        .oled-row-track-container {
          overflow: hidden;
          flex: 1;
          display: flex;
          align-items: center;
          position: relative;
        }

        .oled-row-track {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          will-change: transform;
        }

        .oled-row-text {
          font-size: 11px;
          font-weight: 700;
          color: var(--oled-color);
          text-shadow: 0 0 4px var(--oled-glow);
          letter-spacing: 0.04em;
        }

        .oled-row-spacer {
          margin: 0 16px;
          color: var(--oled-dim);
          font-size: 9px;
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
          gap: 12px;
        }

        .hw-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .oled-indicator-led {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #475569;
          transition: all 0.25s;
        }

        .led-green.active {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .led-green.idle {
          background: #334155;
        }

        .led-red.active {
          background: #f43f5e;
          box-shadow: 0 0 8px #f43f5e;
          animation: textBlink 0.5s infinite;
        }

        .led-red.idle {
          background: #334155;
        }

        .oled-hw-label {
          font-family: var(--font-mono, monospace);
          font-size: 9px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.04em;
        }

        .text-red-pulse {
          color: #f43f5e;
          animation: pulseIcon 0.3s infinite alternate;
        }

        @keyframes pulseIcon {
          from { transform: scale(1); filter: drop-shadow(0 0 1px #f43f5e); }
          to { transform: scale(1.3); filter: drop-shadow(0 0 6px #f43f5e); }
        }

        .btn-sound-toggle {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-sound-toggle:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .btn-sound-toggle.sound-on {
          background: rgba(244, 63, 94, 0.2);
          border-color: #f43f5e;
          color: #f43f5e;
        }

        /* Controls Bar */
        .oled-sim-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(16, 24, 40, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 6px 10px;
          border-radius: 8px;
          gap: 8px;
        }

        .sim-control-group, .sim-action-group {
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

        .btn-sync-all {
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.15) 0%, rgba(14, 165, 233, 0.25) 100%);
          border: 1px solid rgba(0, 240, 255, 0.4);
          color: #38bdf8;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-sync-all:hover {
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.25) 0%, rgba(14, 165, 233, 0.4) 100%);
          color: #fff;
          box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
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
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }

        .selector-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .selector-chip.chip-urgent {
          border-color: rgba(244, 63, 94, 0.4);
          color: #f43f5e;
        }

        .chip-badge {
          font-weight: 900;
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
