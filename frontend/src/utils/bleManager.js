// Web Bluetooth Manager for ESP32 Notice Board
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export class BLEManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    this.isSimulated = false;
    this.listeners = new Set();
    this.logs = [];
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyStateChange() {
    this.listeners.forEach((cb) =>
      cb({
        isConnected: this.isConnected,
        isSimulated: this.isSimulated,
        device: this.device,
        logs: [...this.logs],
      })
    );
  }

  addLog(type, message, details = null) {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    this.notifyStateChange();
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // ─── WRITE HELPER ──────────────────────────────────────────────────────────
  async _write(payloadStr) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr);
    if (this.characteristic.writeValueWithResponse) {
      await this.characteristic.writeValueWithResponse(data);
    } else {
      await this.characteristic.writeValue(data);
    }
  }

  // ─── CONNECT PHYSICAL ──────────────────────────────────────────────────────
  async connectPhysical() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported. Use Chrome/Edge or enable Virtual Simulator.');
    }
    try {
      this.addLog('info', 'Scanning for ESP32 BLE devices...');
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'ESP32' }, { name: 'ESP32-Smart-Notice-Board' }],
        optionalServices: [SERVICE_UUID],
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect('Hardware device disconnected');
      });

      this.addLog('info', `Pairing with ${this.device.name || 'ESP32 Notice Board'}...`);
      this.server = await this.device.gatt.connect();
      this.addLog('info', 'GATT connected. Discovering service...');
      this.service = await this.server.getPrimaryService(SERVICE_UUID);
      this.characteristic = await this.service.getCharacteristic(CHARACTERISTIC_UUID);

      try {
        await this.characteristic.startNotifications();
        this.characteristic.addEventListener('characteristicvaluechanged', (e) => {
          const value = new TextDecoder().decode(e.target.value);
          this.addLog('ble-rx', `ESP32 ACK: ${value}`);
        });
      } catch (e) { /* notifications optional */ }

      this.isConnected = true;
      this.isSimulated = false;
      this.addLog('success', `Connected to ${this.device.name}! Ready to send notices.`);
      this.notifyStateChange();
      return true;
    } catch (err) {
      this.addLog('error', `BLE Connection failed: ${err.message}`);
      throw err;
    }
  }

  // ─── CONNECT VIRTUAL ───────────────────────────────────────────────────────
  async connectVirtual(deviceName = 'ESP32-Virtual-Board-01') {
    this.addLog('info', `Initializing Virtual ESP32 link: ${deviceName}...`);
    await new Promise((r) => setTimeout(r, 600));
    this.device = {
      name: deviceName,
      id: 'VIRTUAL-ESP32-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
    };
    this.isConnected = true;
    this.isSimulated = true;
    this.addLog('success', `Connected to Virtual ESP32 (${deviceName}) — OLED mirror active!`);
    this.notifyStateChange();
    return true;
  }

  // ─── DISCONNECT ────────────────────────────────────────────────────────────
  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.handleDisconnect('User disconnected from BLE');
  }

  handleDisconnect(reason) {
    this.isConnected = false;
    this.isSimulated = false;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.addLog('warning', reason || 'Disconnected from BLE device');
    this.notifyStateChange();
  }

  // ─── SEND SINGLE NOTICE (add / update) ────────────────────────────────────
  async sendNotice(notice) {
    if (!this.isConnected) {
      throw new Error('No Bluetooth device connected.');
    }

    const payload = JSON.stringify({
      title: notice.title,
      content: notice.content,
      priority: notice.priority,
      category: notice.category || 'General',
      scrollSpeed: notice.scrollSpeed || 'Medium',
      timestamp: Date.now(),
    });

    const byteLen = new TextEncoder().encode(payload).length;
    this.addLog('ble-tx', `Sending notice (${byteLen}B) to ESP32...`, payload);

    if (this.isSimulated) {
      await new Promise((r) => setTimeout(r, 400));
      this.addLog('ble-rx', 'ESP32 ACK: ACK:NOTICE_UPDATED');
      return { success: true, simulated: true };
    }

    try {
      await this._write(payload);
      this.addLog('success', 'Notice transmitted to ESP32!');
      return { success: true, simulated: false };
    } catch (err) {
      this.addLog('error', `Failed to send notice: ${err.message}`);
      throw err;
    }
  }

  // ─── SYNC ALL (Full replace — delete-aware) ────────────────────────────────
  // Sends the ENTIRE current active notice list to the board.
  // Board replaces its contents exactly — deleted notices disappear from OLED,
  // new/updated ones appear. Board persists them to NVS (survives disconnect).
  async syncAllNotices(notices) {
    if (!this.isConnected) {
      throw new Error('No Bluetooth device connected.');
    }

    const weights = { Urgent: 3, Important: 2, Normal: 1 };
    const sorted = [...notices]
      .sort((a, b) => (weights[b.priority] || 1) - (weights[a.priority] || 1))
      .slice(0, 4)
      .map((n) => ({
        title: n.title,
        content: n.content,
        priority: n.priority || 'Normal',
        category: n.category || 'General',
        scrollSpeed: n.scrollSpeed || 'Medium',
      }));

    const payload = JSON.stringify({
      action: 'sync',
      notices: sorted,
      timestamp: Date.now(),
    });

    const byteLen = new TextEncoder().encode(payload).length;
    this.addLog('ble-tx', `Syncing ${sorted.length} notice(s) to ESP32 (${byteLen}B)...`, payload);

    if (this.isSimulated) {
      await new Promise((r) => setTimeout(r, 500));
      this.addLog('ble-rx', `ESP32 ACK: ACK:SYNC_OK (${sorted.length} notices → OLED priority stack)`);
      return { success: true, simulated: true, count: sorted.length };
    }

    try {
      await this._write(payload);
      this.addLog('success', `Synced ${sorted.length} notice(s) to ESP32 OLED priority display!`);
      return { success: true, simulated: false, count: sorted.length };
    } catch (err) {
      this.addLog('error', `Sync failed: ${err.message}`);
      throw err;
    }
  }

  // ─── DELETE ONE NOTICE from ESP32 OLED ────────────────────────────────────
  // Sends a targeted delete command so only that one notice is removed from
  // the OLED without disturbing the rest of the priority stack.
  async deleteNoticeFromBoard(title) {
    if (!this.isConnected) {
      // Not connected → board will sync on next reconnect (NVS reflects DB)
      this.addLog('info', `BLE not connected — notice "${title}" will be removed on next board sync.`);
      return { success: false, offline: true };
    }

    const payload = JSON.stringify({ action: 'delete', title });
    const byteLen = new TextEncoder().encode(payload).length;
    this.addLog('ble-tx', `Deleting "${title}" from ESP32 board (${byteLen}B)...`);

    if (this.isSimulated) {
      await new Promise((r) => setTimeout(r, 300));
      this.addLog('ble-rx', `ESP32 ACK: ACK:DELETED ("${title}" removed from OLED)`);
      return { success: true, simulated: true };
    }

    try {
      await this._write(payload);
      this.addLog('success', `"${title}" removed from ESP32 OLED board.`);
      return { success: true, simulated: false };
    } catch (err) {
      this.addLog('error', `Delete command failed: ${err.message}`);
      throw err;
    }
  }

  // ─── CLEAR ALL NOTICES ─────────────────────────────────────────────────────
  async clearNotice() {
    if (!this.isConnected) return;
    const payload = JSON.stringify({ action: 'clear' });
    this.addLog('ble-tx', 'Sending CLEAR ALL to ESP32...');

    if (this.isSimulated) {
      await new Promise((r) => setTimeout(r, 300));
      this.addLog('ble-rx', 'ESP32 ACK: ACK:CLEARED');
      return true;
    }

    try {
      await this._write(payload);
      this.addLog('success', 'ESP32 board cleared successfully.');
      return true;
    } catch (err) {
      this.addLog('error', `Clear command failed: ${err.message}`);
      throw err;
    }
  }
}

export const ble = new BLEManager();
