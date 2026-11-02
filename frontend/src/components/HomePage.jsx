import React, { useState } from 'react';
import {
  Bluetooth,
  Radio,
  Cpu,
  Layers,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Activity,
  Sliders,
  Send,
  Sparkles,
  Terminal,
  LogIn,
} from 'lucide-react';
import { OledDisplaySimulator } from './OledDisplaySimulator';

export const HomePage = ({
  bleState,
  onConnectPhysical,
  onConnectVirtual,
  onNavigateToDashboard,
  onTransmitNotice,
  user,
  onOpenAuth,
}) => {
  // Interactive Sandbox Form State (Available for public demo)
  const [demoNotice, setDemoNotice] = useState({
    title: 'PDEU IOT EXAM',
    content: 'Final IoT practical evaluation scheduled this Friday at 10:30 AM in Lab 302.',
    priority: 'Urgent',
    category: 'Academic',
    scrollSpeed: 'Medium',
  });

  const [activeSimulatorNotice, setActiveSimulatorNotice] = useState(demoNotice);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const handleApplyToSimulator = (e) => {
    e?.preventDefault();
    setActiveSimulatorNotice({ ...demoNotice });
    setFeedbackMsg('Updated on OLED simulator!');
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleSendToPhysicalHardware = async () => {
    if (!user) {
      setFeedbackMsg('Admin authentication required to transmit notices to hardware');
      onOpenAuth();
      return;
    }
    if (!bleState.isConnected) {
      setFeedbackMsg('Please connect ESP32 Bluetooth first (use the top Connect button)');
      setTimeout(() => setFeedbackMsg(''), 4000);
      return;
    }
    try {
      await onTransmitNotice(demoNotice);
      setFeedbackMsg('Notice transmitted to physical ESP32 OLED display!');
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (err) {
      setFeedbackMsg(`Transmission error: ${err.message}`);
    }
  };

  const quickPresets = [
    {
      label: '🚨 Fire Drill (Urgent)',
      title: 'FIRE EVACUATION',
      content: 'Emergency drill today at 3:30 PM. Evacuate calmly to Assembly Point A.',
      priority: 'Urgent',
      scrollSpeed: 'Fast',
    },
    {
      label: '🎓 Exam Schedule',
      title: 'MID-SEM EXAMS',
      content: 'Mid-semester examinations commence Monday 10:00 AM. Hall tickets mandatory.',
      priority: 'Important',
      scrollSpeed: 'Medium',
    },
    {
      label: '🎉 Tech Fest Notice',
      title: 'TECHNO-FEST 2026',
      content: 'Project exhibition entries open until tomorrow 5:00 PM in the Auditorium.',
      priority: 'Normal',
      scrollSpeed: 'Slow',
    },
  ];

  return (
    <div className="homepage-root">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-glow-orb"></div>
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-pulse"></span>
            <span>PDEU • Sem 7 IoT Engineering Capstone</span>
          </div>

          <h1 className="hero-title">
            ESP32 Bluetooth Low Energy <br />
            <span className="text-gradient-cyan">Smart Notice Board</span>
          </h1>

          <p className="hero-subtitle">
            A wireless digital notice board engineered with an <strong>ESP32 Microcontroller</strong>,{' '}
            <strong>0.96" SSD1306 OLED Display</strong> over I2C (Address <code>0x3C</code>), Web Bluetooth GATT communication,
            and non-volatile flash memory persistence for offline reliability.
          </p>

          <div className="hero-actions">
            {user ? (
              <button className="btn-hero-primary" onClick={onNavigateToDashboard}>
                <Layers size={18} />
                <span>Open Admin Dashboard</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn-hero-primary" onClick={onOpenAuth}>
                <LogIn size={18} />
                <span>Admin Login to Dashboard</span>
                <ArrowRight size={16} />
              </button>
            )}

            <button
              className="btn-hero-secondary"
              onClick={() => {
                document.getElementById('demo-sandbox')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Cpu size={18} />
              <span>Try Live OLED Demo</span>
            </button>

            {!bleState.isConnected ? (
              <button className="btn-hero-bluetooth" onClick={onConnectPhysical}>
                <Bluetooth size={18} />
                <span>Pair ESP32 (BLE)</span>
              </button>
            ) : (
              <div className="hero-ble-status">
                <span className="status-dot connected"></span>
                <span>ESP32 Connected via BLE</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Interactive Live Demo & Sandbox Section */}
      <section id="demo-sandbox" className="demo-section">
        <div className="section-header">
          <div className="section-tag">
            <Sparkles size={14} className="text-cyan" />
            <span>Interactive Hardware Sandbox</span>
          </div>
          <h2 className="section-title">Live OLED Display Simulation</h2>
          <p className="section-desc">
            Test how our firmware formats Zone 0 & Zone 1 for title & priority alerts, and dynamically scrolls notices
            across the 128×64 pixel matrix with scanline rendering.
          </p>
        </div>

        <div className="demo-grid">
          {/* Left: Live OLED Simulator */}
          <div className="demo-screen-panel">
            <div className="panel-subhead">
              <Cpu size={16} className="text-cyan" />
              <span>Simulated 128x64 OLED Display (I2C 0x3C)</span>
            </div>

            <OledDisplaySimulator
              activeNotice={activeSimulatorNotice}
              bleState={bleState}
              onSendToBoard={() => handleSendToPhysicalHardware()}
            />

            {feedbackMsg && (
              <div className="sandbox-feedback-toast">
                <CheckCircle2 size={16} />
                <span>{feedbackMsg}</span>
              </div>
            )}

            {/* Quick Presets */}
            <div className="presets-group">
              <span className="presets-label">Quick Test Presets:</span>
              <div className="presets-buttons">
                {quickPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn-preset"
                    onClick={() => {
                      setDemoNotice(preset);
                      setActiveSimulatorNotice(preset);
                      setFeedbackMsg(`Applied "${preset.title}" preset!`);
                      setTimeout(() => setFeedbackMsg(''), 2500);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Interactive Controls Form */}
          <div className="demo-controls-panel glass-panel">
            <div className="panel-subhead">
              <Sliders size={16} className="text-blue" />
              <span>Notice Dispatch Sandbox Controls</span>
            </div>

            <form onSubmit={handleApplyToSimulator} className="demo-form">
              <div className="form-group">
                <label className="form-label">
                  Notice Title <span className="text-dim">(Zone 1 • Header Title on OLED)</span>
                </label>
                <input
                  type="text"
                  maxLength={24}
                  value={demoNotice.title}
                  onChange={(e) => setDemoNotice({ ...demoNotice, title: e.target.value })}
                  placeholder="e.g. EXAM SCHEDULE"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Notice Content <span className="text-dim">(Zone 3 • Pixel-scrolls on OLED)</span>
                </label>
                <textarea
                  rows={3}
                  value={demoNotice.content}
                  onChange={(e) => setDemoNotice({ ...demoNotice, content: e.target.value })}
                  placeholder="Type full announcement message here..."
                  className="form-textarea"
                  required
                />
              </div>

              <div className="demo-form-row">
                <div className="form-group flex-1">
                  <label className="form-label">Priority Level</label>
                  <select
                    value={demoNotice.priority}
                    onChange={(e) => setDemoNotice({ ...demoNotice, priority: e.target.value })}
                    className="form-select"
                  >
                    <option value="Normal">Normal (Standard notice)</option>
                    <option value="Important">Important (* Title mark)</option>
                    <option value="Urgent">Urgent (Blinks [!URGENT NOTICE!])</option>
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label className="form-label">Marquee Scroll Speed</label>
                  <select
                    value={demoNotice.scrollSpeed}
                    onChange={(e) => setDemoNotice({ ...demoNotice, scrollSpeed: e.target.value })}
                    className="form-select"
                  >
                    <option value="Fast">Fast (15ms / px)</option>
                    <option value="Medium">Medium (30ms / px)</option>
                    <option value="Slow">Slow (50ms / px)</option>
                  </select>
                </div>
              </div>

              <div className="demo-actions-row">
                <button type="submit" className="btn-primary flex-1">
                  <Zap size={16} />
                  <span>Update OLED Simulator</span>
                </button>

                <button
                  type="button"
                  className="btn-transmit-hardware"
                  onClick={handleSendToPhysicalHardware}
                  title={user ? 'Send to ESP32' : 'Admin login required'}
                >
                  <Bluetooth size={16} />
                  <span>{user ? 'Transmit to ESP32' : 'Admin Login to Transmit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* How the Project Works (Architecture & Pipeline) */}
      <section className="architecture-section">
        <div className="section-header">
          <div className="section-tag">
            <Activity size={14} className="text-cyan" />
            <span>End-to-End IoT Pipeline</span>
          </div>
          <h2 className="section-title">How the Notice Board Works</h2>
          <p className="section-desc">
            Complete data flow from administrator browser dispatch to physical microcontroller execution.
          </p>
        </div>

        <div className="pipeline-steps-grid">
          {/* Step 1 */}
          <div className="pipeline-card">
            <div className="step-number">01</div>
            <div className="step-icon-wrap">
              <ShieldCheck size={24} className="text-cyan" />
            </div>
            <h3 className="step-title">Admin Web Portal</h3>
            <p className="step-desc">
              Administrator creates or schedules notice payloads in React. The app communicates directly using the
              native <strong>Web Bluetooth API</strong> in Chrome or Edge without any auxiliary mobile apps.
            </p>
          </div>

          {/* Step 2 */}
          <div className="pipeline-card">
            <div className="step-number">02</div>
            <div className="step-icon-wrap">
              <Radio size={24} className="text-blue" />
            </div>
            <h3 className="step-title">BLE 2.4 GHz GATT Link</h3>
            <p className="step-desc">
              Encodes structured JSON payloads containing Title, Content, Priority, and Scroll Speed across Service UUID{' '}
              <code>4fafc201-1fb5-459e-8fcc-c5c9c331914b</code> with two-way ACK notifications.
            </p>
          </div>

          {/* Step 3 */}
          <div className="pipeline-card">
            <div className="step-number">03</div>
            <div className="step-icon-wrap">
              <Cpu size={24} className="text-purple" />
            </div>
            <h3 className="step-title">ESP32 Dual-Core SoC</h3>
            <p className="step-desc">
              Arduino C++ firmware deserializes JSON packets with <code>ArduinoJson</code>. The notice is written to{' '}
              <strong>NVS Flash Memory (Preferences)</strong> so it survives power cuts and reboots.
            </p>
          </div>

          {/* Step 4 */}
          <div className="pipeline-card">
            <div className="step-number">04</div>
            <div className="step-icon-wrap">
              <Sliders size={24} className="text-amber" />
            </div>
            <h3 className="step-title">I2C Serial Bus</h3>
            <p className="step-desc">
              Communicates with the OLED controller using high-speed 2-wire I2C protocol at hardware address{' '}
              <code>0x3C</code> via GPIO 21 (SDA) and GPIO 22 (SCL).
            </p>
          </div>

          {/* Step 5 */}
          <div className="pipeline-card">
            <div className="step-number">05</div>
            <div className="step-icon-wrap">
              <HardDrive size={24} className="text-emerald" />
            </div>
            <h3 className="step-title">SSD1306 OLED 128×64</h3>
            <p className="step-desc">
              Renders Title and blinking Urgent indicators on Zone 0 & 1, while executing a smooth, flicker-free pixel
              marquee ticker across Zone 3.
            </p>
          </div>
        </div>
      </section>

      {/* Hardware Wiring Pinout Reference */}
      <section className="wiring-section">
        <div className="glass-panel wiring-card">
          <div className="wiring-header">
            <div>
              <h3 className="text-lg font-bold">Physical Hardware Pinout Blueprint</h3>
              <p className="text-sm text-muted">Direct jumper wire connections between ESP32 and 0.96" SSD1306 OLED Display</p>
            </div>
            <span className="badge-i2c">I2C Address: 0x3C</span>
          </div>

          <div className="pinout-table-wrapper">
            <table className="pinout-table">
              <thead>
                <tr>
                  <th>ESP32 Development Board</th>
                  <th>SSD1306 OLED Display</th>
                  <th>Signal Type</th>
                  <th>Operational Role</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="pin-badge">3.3V</span></td>
                  <td><span className="pin-badge highlight">VCC</span></td>
                  <td>Power (+3.3V DC)</td>
                  <td>Regulated logic supply for SSD1306 driver IC</td>
                </tr>
                <tr>
                  <td><span className="pin-badge">GND</span></td>
                  <td><span className="pin-badge highlight">GND</span></td>
                  <td>Ground Reference</td>
                  <td>Common return path</td>
                </tr>
                <tr>
                  <td><span className="pin-badge cyan">GPIO 21 (D21)</span></td>
                  <td><span className="pin-badge highlight cyan">SDA</span></td>
                  <td>I2C Serial Data</td>
                  <td>Bi-directional data line for frame buffer stream</td>
                </tr>
                <tr>
                  <td><span className="pin-badge cyan">GPIO 22 (D22)</span></td>
                  <td><span className="pin-badge highlight cyan">SCL</span></td>
                  <td>I2C Serial Clock</td>
                  <td>Clock synchronization pulse generated by ESP32</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Styles for Home Page */}
      <style>{`
        .homepage-root {
          display: flex;
          flex-direction: column;
          gap: 48px;
          padding: 20px 0 60px;
        }

        .hero-section {
          position: relative;
          text-align: center;
          padding: 50px 20px 30px;
          max-width: 900px;
          margin: 0 auto;
        }

        .hero-glow-orb {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          width: 320px;
          height: 180px;
          background: radial-gradient(circle, rgba(0, 240, 255, 0.25) 0%, rgba(99, 102, 241, 0.1) 60%, transparent 80%);
          filter: blur(40px);
          z-index: -1;
          pointer-events: none;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 20px;
          padding: 5px 14px;
          font-size: 12px;
          font-family: var(--font-mono);
          color: var(--accent-cyan);
          margin-bottom: 20px;
        }

        .badge-pulse {
          width: 8px;
          height: 8px;
          background: var(--accent-cyan);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--accent-cyan);
          animation: pulse 2s infinite;
        }

        .hero-title {
          font-size: 42px;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin-bottom: 18px;
        }

        .text-gradient-cyan {
          background: linear-gradient(135deg, #00f0ff 0%, #38bdf8 50%, #818cf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          font-size: 16px;
          color: var(--text-muted);
          line-height: 1.6;
          max-width: 740px;
          margin: 0 auto 30px;
        }

        .hero-actions {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .btn-hero-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #0284c7, #06b6d4);
          color: white;
          padding: 12px 24px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 14px;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(6, 182, 212, 0.35);
          transition: all 0.25s ease;
        }

        .btn-hero-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 26px rgba(6, 182, 212, 0.5);
        }

        .btn-hero-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: var(--text-main);
          padding: 12px 22px;
          border-radius: var(--radius-md);
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-hero-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(0, 240, 255, 0.3);
        }

        .btn-hero-bluetooth {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(30, 58, 138, 0.35);
          border: 1px solid rgba(56, 189, 248, 0.4);
          color: #38bdf8;
          padding: 12px 20px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-hero-bluetooth:hover {
          background: rgba(30, 58, 138, 0.6);
          border-color: #38bdf8;
        }

        .hero-ble-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 600;
        }

        /* Demo Section */
        .demo-section {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .section-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .section-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-family: var(--font-mono);
          color: var(--accent-cyan);
          margin-bottom: 8px;
        }

        .section-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .section-desc {
          font-size: 14px;
          color: var(--text-muted);
          max-width: 620px;
          margin: 0 auto;
        }

        .demo-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 980px) {
          .demo-grid {
            grid-template-columns: 1fr;
          }
        }

        .panel-subhead {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 12px;
          font-family: var(--font-mono);
        }

        .demo-controls-panel {
          padding: 20px;
          border-radius: var(--radius-lg);
        }

        .demo-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .demo-form-row {
          display: flex;
          gap: 12px;
        }

        .demo-actions-row {
          display: flex;
          gap: 12px;
          margin-top: 6px;
        }

        .btn-transmit-hardware {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(30, 58, 138, 0.5);
          border: 1px solid rgba(56, 189, 248, 0.4);
          color: #38bdf8;
          border-radius: var(--radius-md);
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-transmit-hardware:hover {
          background: rgba(30, 58, 138, 0.8);
          border-color: #38bdf8;
        }

        .sandbox-feedback-toast {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #34d399;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 12px;
        }

        .presets-group {
          margin-top: 14px;
          padding: 12px;
          background: rgba(16, 24, 42, 0.5);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .presets-label {
          font-size: 11px;
          font-family: var(--font-mono);
          color: var(--text-muted);
          display: block;
          margin-bottom: 8px;
        }

        .presets-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .btn-preset {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-main);
          font-size: 11px;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-preset:hover {
          background: rgba(0, 240, 255, 0.12);
          border-color: rgba(0, 240, 255, 0.3);
          color: var(--accent-cyan);
        }

        /* Pipeline Section */
        .architecture-section {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .pipeline-steps-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        @media (max-width: 1100px) {
          .pipeline-steps-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 700px) {
          .pipeline-steps-grid {
            grid-template-columns: 1fr;
          }
        }

        .pipeline-card {
          background: rgba(16, 24, 42, 0.7);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 20px 16px;
          position: relative;
          transition: all 0.3s ease;
        }

        .pipeline-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent-cyan);
          box-shadow: 0 10px 24px rgba(0, 240, 255, 0.15);
        }

        .step-number {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: var(--accent-cyan);
          opacity: 0.6;
          margin-bottom: 8px;
        }

        .step-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }

        .step-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 8px;
          color: var(--text-main);
        }

        .step-desc {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .step-desc code {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--accent-cyan);
          background: rgba(0, 240, 255, 0.08);
          padding: 1px 4px;
          border-radius: 3px;
        }

        /* Wiring Section */
        .wiring-section {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .wiring-card {
          padding: 24px;
          border-radius: var(--radius-lg);
        }

        .wiring-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .badge-i2c {
          font-family: var(--font-mono);
          font-size: 12px;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          padding: 4px 12px;
          border-radius: 12px;
        }

        .pinout-table-wrapper {
          overflow-x: auto;
        }

        .pinout-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }

        .pinout-table th {
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-muted);
          font-weight: 600;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .pinout-table td {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }

        .pin-badge {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .pin-badge.highlight {
          border-color: rgba(251, 191, 36, 0.4);
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.1);
        }

        .pin-badge.cyan {
          border-color: rgba(0, 240, 255, 0.4);
          color: var(--accent-cyan);
          background: rgba(0, 240, 255, 0.1);
        }
      `}</style>
    </div>
  );
};
