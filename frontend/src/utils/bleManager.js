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

  // Subscribe to state changes
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
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      type, // 'info', 'success', 'warning', 'error', 'ble-tx', 'ble-rx'
      message,
      details,
    };
    this.logs.unshift(logEntry);
    if (this.logs.length > 50) this.logs.pop();
    this.notifyStateChange();
  }

  // Check if Web Bluetooth API is supported in browser
  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // Connect to Physical ESP32 via Native Web Bluetooth
  async connectPhysical() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or enable Virtual Simulator.');
    }

    try {
      this.addLog('info', 'Scanning for ESP32 Bluetooth Low Energy devices...');

      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'ESP32' },
          { name: 'ESP32-Smart-Notice-Board' },
        ],
        optionalServices: [SERVICE_UUID],
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect('Hardware device disconnected');
      });

      this.addLog('info', `Pairing with device: ${this.device.name || 'ESP32 Notice Board'}...`);

      this.server = await this.device.gatt.connect();
      this.addLog('info', 'GATT Server connected. Discovering Notice Service...');

      this.service = await this.server.getPrimaryService(SERVICE_UUID);
      this.characteristic = await this.service.getCharacteristic(CHARACTERISTIC_UUID);

      // Try starting notifications if supported
      try {
        await this.characteristic.startNotifications();
        this.characteristic.addEventListener('characteristicvaluechanged', (e) => {
          const decoder = new TextDecoder();
          const value = decoder.decode(e.target.value);
          this.addLog('ble-rx', `ESP32 ACK Received: ${value}`);
        });
      } catch (notifyErr) {
        console.warn('Notifications not supported or enabled:', notifyErr);
      }

      this.isConnected = true;
      this.isSimulated = false;
      this.addLog('success', `Connected successfully to ${this.device.name}! Ready to send notices.`);
      this.notifyStateChange();
      return true;
    } catch (error) {
      this.addLog('error', `BLE Connection failed: ${error.message}`);
      throw error;
    }
  }

  // Connect to Virtual ESP32 Simulator
  async connectVirtual(deviceName = 'ESP32-Virtual-Board-01') {
    this.addLog('info', `Initializing Virtual ESP32 BLE link with ${deviceName}...`);
    await new Promise((resolve) => setTimeout(resolve, 600));

    this.device = {
      name: deviceName,
      id: 'VIRTUAL-ESP32-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
    };
    this.isConnected = true;
    this.isSimulated = true;
    this.addLog('success', `Connected to Virtual ESP32 (${deviceName}) with 128x64 OLED simulation!`);
    this.notifyStateChange();
    return true;
  }

  // Disconnect
  disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
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

  // Transmit Notice payload to ESP32
  async sendNotice(notice) {
    if (!this.isConnected) {
      throw new Error('No Bluetooth device connected. Please connect to ESP32 first.');
    }

    const payload = JSON.stringify({
      title: notice.title,
      content: notice.content,
      priority: notice.priority,
      category: notice.category || 'General',
      scrollSpeed: notice.scrollSpeed || 'Medium',
      timestamp: Date.now(),
    });

    const byteLength = new TextEncoder().encode(payload).length;
    this.addLog('ble-tx', `Transmitting packet (${byteLength} bytes) to ESP32...`, payload);

    if (this.isSimulated) {
      // Simulate real BLE transmission latency
      await new Promise((resolve) => setTimeout(resolve, 450));
      this.addLog('ble-rx', `ESP32 ACK Received: ACK:NOTICE_UPDATED (NVS Flash memory synced)`);
      return { success: true, simulated: true, bytesSent: byteLength };
    }

    // Physical BLE transmission
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);

      // Most BLE devices support up to 512 bytes with MTU negotiation, but fallback to chunks if necessary
      if (this.characteristic.writeValueWithResponse) {
        await this.characteristic.writeValueWithResponse(data);
      } else {
        await this.characteristic.writeValue(data);
      }

      this.addLog('success', `Notice packet successfully written to ESP32 characteristic!`);
      return { success: true, simulated: false, bytesSent: byteLength };
    } catch (err) {
      this.addLog('error', `Failed to send BLE packet: ${err.message}`);
      throw err;
    }
  }

  // Clear Notice from board
  async clearNotice() {
    if (!this.isConnected) return;
    const clearPayload = JSON.stringify({ action: 'clear' });
    this.addLog('ble-tx', 'Sending CLEAR command to ESP32 OLED...');

    if (this.isSimulated) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      this.addLog('ble-rx', 'ESP32 ACK Received: ACK:CLEARED');
      return true;
    }

    try {
      const encoder = new TextEncoder();
      await this.characteristic.writeValue(encoder.encode(clearPayload));
      this.addLog('success', 'Board cleared successfully.');
      return true;
    } catch (err) {
      this.addLog('error', `Failed to send clear command: ${err.message}`);
      throw err;
    }
  }
}

export const ble = new BLEManager();
