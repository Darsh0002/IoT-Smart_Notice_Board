import React, { useState, useEffect, useRef } from 'react';

export const OledDisplaySimulator = ({
  activeNotice,
  bleState,
  onSendToBoard,
  onSyncAllToBoard,
  activeNoticesList = [],
}) => {
  const [urgentBlink, setUrgentBlink] = useState(false);
  const [buzzerPulsing, setBuzzerPulsing] = useState(false);
  const [scrollOffsets, setScrollOffsets] = useState([0, 0, 0, 0]);

  // Web Audio for simulated buzzer (auto-plays when urgent notice present)
  const audioCtxRef = useRef(null);

  // Priority sorting
  const priorityRank = { Urgent: 3, Important: 2, Normal: 1 };

  // Up to 4 notices sorted Urgent → Important → Normal
  const displayNotices = React.useMemo(() => {
    let list = [...activeNoticesList];
    if (list.length === 0 && activeNotice) {
      list = [activeNotice];
    }
    return list
      .sort((a, b) => (priorityRank[b.priority] || 1) - (priorityRank[a.priority] || 1))
      .slice(0, 4);
  }, [activeNoticesList, activeNotice]);

  const hasUrgent = displayNotices.some((n) => n.priority === 'Urgent');

  // Urgent badge blink (500ms)
  useEffect(() => {
    if (!hasUrgent) { setUrgentBlink(false); return; }
    const id = setInterval(() => setUrgentBlink((p) => !p), 500);
    return () => clearInterval(id);
  }, [hasUrgent]);

  // Play 2700 Hz double-beep via Web Audio API
  const triggerBuzzerAudio = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const makeBeep = (start) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(2700, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.setValueAtTime(0.0, start + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.1);
      };
      makeBeep(now);        // Beep 1 at t=0
      makeBeep(now + 0.18); // Beep 2 at t=180ms
    } catch (e) {
      console.warn('Web Audio:', e);
    }
  };

  // 5-second urgent buzzer loop (visual pulse + audio)
  useEffect(() => {
    if (!hasUrgent) { setBuzzerPulsing(false); return; }

    const fire = () => {
      setBuzzerPulsing(true);
      triggerBuzzerAudio();
      setTimeout(() => setBuzzerPulsing(false), 300);
    };

    fire(); // fire immediately when urgent notice appears
    const id = setInterval(fire, 5000);
    return () => clearInterval(id);
  }, [hasUrgent]);

  // Independent horizontal side-scrolling per row
  useEffect(() => {
    if (displayNotices.length === 0) return;
    const id = setInterval(() => {
      setScrollOffsets((prev) =>
        displayNotices.map((n, idx) => {
          const fullText = `${n.title}: ${n.content}`;
          const textPx = fullText.length * 7.5;
          const visiblePx = 230;
          if (textPx <= visiblePx) return 0;
          const cur = prev[idx] || 0;
          const step = n.scrollSpeed === 'Fast' ? 2.2 : n.scrollSpeed === 'Slow' ? 1.0 : 1.5;
          if (cur > textPx + 60) return -30;
          return cur + step;
        })
      );
    }, 32);
    return () => clearInterval(id);
  }, [displayNotices]);

  return (
    <>
      {/* OLED Screen — pure display, no chrome */}
      <div
        className={`oled-screen-surface${buzzerPulsing ? ' oled-urgent-pulse' : ''}`}
        style={{ '--oled-color': '#38f8ff', '--oled-glow': '#00f0ff', '--oled-dim': '#004d54', '--oled-inv-bg': '#00f0ff', '--oled-inv-text': '#040b14' }}
      >
        {/* Scanlines + pixel grid overlays */}
        <div className="oled-scanlines" />
        <div className="oled-pixel-grid" />

        {/* Content */}
        <div className="oled-screen-content">
          {displayNotices.length === 0 ? (
            <div className="oled-empty-state">
              <div className="oled-empty-title">No Active Notices</div>
              <div className="oled-empty-sub">
                {bleState?.isConnected ? 'BLE Connected · Ready' : 'Ready for BLE Sync'}
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
                  <div key={n._id || idx} className="oled-stack-row">
                    {/* Priority badge */}
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

                    {/* Side-scrolling text */}
                    <div className="oled-row-track-container">
                      <div
                        className="oled-row-track"
                        style={{ transform: isScrolling ? `translateX(-${offset}px)` : 'translateX(0)' }}
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

      <style>{`
        /* ── OLED Screen Surface ───────────────────────────────────────── */
        .oled-screen-surface {
          background: #040b14;
          position: relative;
          height: 170px;
          border-radius: 6px;
          overflow: hidden;
          padding: 6px 8px;
          box-shadow:
            inset 0 0 30px rgba(0,0,0,0.95),
            0 0 0 2px #1a2234,
            0 0 0 10px #0a0d18,
            0 0 0 12px #1a2234;
          border: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.2s;
          user-select: none;
        }

        .oled-screen-surface.oled-urgent-pulse {
          box-shadow:
            inset 0 0 30px rgba(0,0,0,0.95),
            0 0 0 2px #1a2234,
            0 0 0 10px #0a0d18,
            0 0 0 12px rgba(244,63,94,0.7),
            0 0 24px rgba(244,63,94,0.35);
        }

        /* Scanlines */
        .oled-scanlines {
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.35) 50%);
          background-size: 100% 3px;
          pointer-events: none;
          z-index: 10;
          opacity: 0.7;
        }

        /* Pixel grid */
        .oled-pixel-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.04) 1px, transparent 0);
          background-size: 3px 3px;
          pointer-events: none;
          z-index: 9;
        }

        /* Content layer */
        .oled-screen-content {
          position: relative;
          z-index: 5;
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: 'Courier New', Courier, monospace;
        }

        /* Empty state */
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

        /* Notice stack */
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
          border-bottom: 1px dashed rgba(255,255,255,0.12);
          overflow: hidden;
          position: relative;
          min-height: 0;
        }
        .oled-stack-row:last-child { border-bottom: none; }

        /* Badge */
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
          border: 1px solid rgba(255,255,255,0.2);
        }
        .badge-blink { animation: blinkAnim 0.5s infinite; }
        @keyframes blinkAnim {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }

        /* Scrolling text */
        .oled-row-track-container {
          overflow: hidden;
          flex: 1;
          display: flex;
          align-items: center;
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
      `}</style>
    </>
  );
};
