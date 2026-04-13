import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Usb, CheckCircle, XCircle, Loader, Trash2, Eye, Plus, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageShell from '@/components/layout/PageShell';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// R307 Serial Protocol
const R307_COMMANDS = {
  GENIMG: 0x01,
  IMG2TZ: 0x02,
  MATCH: 0x03,
  SEARCH: 0x04,
  REGMODEL: 0x05,
  STORE: 0x06,
  DELETCHAR: 0x0C,
  EMPTY: 0x0D,
  VERIFYPASSWORD: 0x13,
  TEMPLATENUM: 0x1D,
  READINDEXTABLE: 0x1F
};

const FINGERPRINT_OK = 0x00;
const FINGERPRINT_NOFINGER = 0x02;

interface FingerprintDevice {
  id: string;
  device_code: string;
  device_name: string | null;
  status: string;
  firmware_version: string | null;
  last_seen_at: string | null;
}

class R307Sensor {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.buffer = [];
  }

  async connect(portInfo) {
    try {
      this.port = await navigator.serial.open(portInfo, { baudRate: 57600 });
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();

      // Clear buffer
      this.buffer = [];

      // Verify connection
      const response = await this.sendCommand(R307_COMMANDS.VERIFYPASSWORD);
      if (response?.data?.[0] !== FINGERPRINT_OK) {
        throw new Error('R307 password verification failed');
      }

      return true;
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.reader) {
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  async sendCommand(command, data = []) {
    if (!this.port || !this.writer) {
      throw new Error('Not connected to sensor');
    }

    try {
      const packet = this.buildPacket(command, data);
      await this.writer.write(new Uint8Array(packet));
      return await this.readResponse(5000);
    } catch (error) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  buildPacket(command, data) {
    const header = [0xEF, 0x01];
    const address = [0xFF, 0xFF, 0xFF, 0xFF];
    const length = data.length + 2;
    const lengthBytes = [(length >> 8) & 0xFF, length & 0xFF];
    const fullData = [command, ...lengthBytes, ...data];
    const checksum = this.calculateChecksum(fullData);

    return [
      ...header,
      ...address,
      ...fullData,
      (checksum >> 8) & 0xFF,
      checksum & 0xFF
    ];
  }

  calculateChecksum(data) {
    return data.reduce((a, b) => a + b, 0) & 0xFFFF;
  }

  async readResponse(timeout = 5000) {
    const startTime = Date.now();
    this.buffer = [];

    while (Date.now() - startTime < timeout) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.buffer.push(...value);

        // Check for complete packet
        if (this.buffer.length >= 12 && this.buffer[0] === 0xEF && this.buffer[1] === 0x01) {
          const length = (this.buffer[7] << 8) | this.buffer[8];
          if (this.buffer.length >= 9 + length) {
            const packetType = this.buffer[6];
            const packetData = this.buffer.slice(9, 9 + length - 2);
            this.buffer = this.buffer.slice(9 + length); // Keep remaining data
            return { type: packetType, data: packetData };
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          await new Promise(r => setTimeout(r, 50));
        }
      }
    }

    throw new Error('Response timeout - no data received from sensor');
  }

  async captureImage() {
    const response = await this.sendCommand(R307_COMMANDS.GENIMG);
    return response?.data?.[0] === FINGERPRINT_OK;
  }

  async convertToTemplate(slot = 1) {
    const response = await this.sendCommand(R307_COMMANDS.IMG2TZ, [slot]);
    return response?.data?.[0] === FINGERPRINT_OK;
  }

  async createModel() {
    const response = await this.sendCommand(R307_COMMANDS.REGMODEL);
    return response?.data?.[0] === FINGERPRINT_OK;
  }

  async storeModel(slot, id) {
    const idBytes = [(id >> 8) & 0xFF, id & 0xFF];
    const response = await this.sendCommand(R307_COMMANDS.STORE, [slot, ...idBytes]);
    return response?.data?.[0] === FINGERPRINT_OK;
  }

  async getTemplateCount() {
    const response = await this.sendCommand(R307_COMMANDS.TEMPLATENUM);
    if (response?.data && response.data.length >= 3) {
      return (response.data[1] << 8) | response.data[2];
    }
    return 0;
  }

  async getNextAvailableId() {
    for (let i = 1; i <= 1000; i++) {
      // Simple approach: just use incrementing ID
      // In production, query which IDs are used
      return i;
    }
    return null;
  }

  async deleteModel(id) {
    const idBytes = [(id >> 8) & 0xFF, id & 0xFF];
    const response = await this.sendCommand(R307_COMMANDS.DELETCHAR, idBytes);
    return response?.data?.[0] === FINGERPRINT_OK;
  }

  async emptyDatabase() {
    const response = await this.sendCommand(R307_COMMANDS.EMPTY);
    return response?.data?.[0] === FINGERPRINT_OK;
  }
}

const FingerprintEnrollmentPage: React.FC = () => {
  // Connection state
  const [sensor, setSensor] = useState<R307Sensor | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [portInfo, setPortInfo] = useState(null);

  // UI state
  const [step, setStep] = useState('idle'); // idle, searching, enrolling, saving
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [student, setStudent] = useState(null);
  const [fingerprintId, setFingerprintId] = useState(0);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState(0);

  // Device registration state
  const [deviceCode, setDeviceCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('3.0');
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [devices, setDevices] = useState<FingerprintDevice[]>([]);

  // Log
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef(null);

  const addLog = (msg: string, level: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] ${msg}`;
    setLogs(prev => [...prev, logMsg]);
    console.log(logMsg);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isDeviceOnline = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return false;
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    return diff < 2 * 60 * 1000;
  };

  const loadDevices = async () => {
    try {
      setDeviceLoading(true);
      const { data, error } = await supabase
        .from('fingerprint_devices')
        .select('id, device_code, device_name, status, firmware_version, last_seen_at')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load fingerprint devices',
        variant: 'destructive'
      });
    } finally {
      setDeviceLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const saveDevice = async () => {
    if (!deviceCode.trim()) {
      toast({
        title: 'Error',
        description: 'Device code is required',
        variant: 'destructive'
      });
      return;
    }

    try {
      setDeviceSaving(true);

      const payload = {
        device_code: deviceCode.trim().toUpperCase(),
        device_name: deviceName.trim() || null,
        status: 'ACTIVE',
        firmware_version: firmwareVersion.trim() || '3.0',
        last_seen_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('fingerprint_devices')
        .upsert(payload, { onConflict: 'device_code' });

      if (error) throw error;

      addLog(`✓ Device saved: ${payload.device_code}`, 'success');
      toast({
        title: 'Device Saved',
        description: `${payload.device_code} is ready for attendance sessions`
      });

      setDeviceCode('');
      setDeviceName('');
      setFirmwareVersion('3.0');
      await loadDevices();
    } catch (error) {
      addLog(`✗ Device save failed: ${error.message}`, 'error');
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setDeviceSaving(false);
    }
  };

  const checkBrowserSupport = () => {
    if (!navigator.serial) {
      toast({
        title: 'Browser Not Supported',
        description: 'Please use Chrome, Edge, or Brave browser',
        variant: 'destructive'
      });
      return false;
    }
    return true;
  };

  const connectSensor = async () => {
    try {
      setIsLoading(true);
      addLog('Connecting to R307 sensor...');

      if (!checkBrowserSupport()) return;

      const ports = await navigator.serial.requestPort();
      setPortInfo(ports);

      const r307 = new R307Sensor();
      addLog('Opening serial connection at 57600 baud...');

      if (await r307.connect(ports)) {
        addLog('✓ R307 sensor connected successfully');

        const count = await r307.getTemplateCount();
        addLog(`✓ Sensor verified! ${count} templates stored`);
        setEnrolledCount(count);

        setSensor(r307);
        setIsConnected(true);
        setMessage('Ready to enroll fingerprints');

        toast({
          title: 'Success',
          description: 'Connected to R307 sensor'
        });
      }
    } catch (error) {
      addLog(`✗ Connection failed: ${error.message}`, 'error');
      setMessage(`Error: ${error.message}`);
      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const searchStudent = async () => {
    if (!enrollmentNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter enrollment number',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      addLog(`Searching for student: ${enrollmentNumber}`);
      setStep('searching');

      // Query Supabase for student
      const { data, error } = await supabase
        .from('students')
        .select('id, name, enrollment_no, roll_no, class_id, classes(name, division)')
        .eq('enrollment_no', enrollmentNumber)
        .single();

      if (error) throw new Error('Student not found');
      if (!data) throw new Error('No student with this enrollment number');

      addLog(`✓ Student found: ${data.name}`);

      // Check if already enrolled
      const { data: fingerprint } = await supabase
        .from('fingerprint_templates')
        .select('id')
        .eq('student_id', data.id)
        .single();

      if (fingerprint) {
        addLog('⚠ Student already has fingerprint enrolled', 'error');
        toast({
          title: 'Already Enrolled',
          description: `${data.name} already has a fingerprint enrolled`,
          variant: 'destructive'
        });
        setStep('idle');
        return;
      }

      setStudent(data);
      setStep('enrolling');
      setMessage(`Ready to enroll: ${data.name}`);
      toast({
        title: 'Student Found',
        description: data.name
      });
    } catch (error) {
      addLog(`✗ Search failed: ${error.message}`, 'error');
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      setStep('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const captureFirstFinger = async () => {
    if (!sensor || !isConnected) {
      toast({
        title: 'Error',
        description: 'Sensor not connected',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      addLog('Step 1: Capturing first fingerprint...');
      setMessage('Place your finger on the sensor...');

      if (!(await sensor.captureImage())) {
        throw new Error('No finger detected');
      }
      addLog('✓ Image captured');

      if (!(await sensor.convertToTemplate(1))) {
        throw new Error('Template conversion failed');
      }
      addLog('✓ Template created');

      setMessage('First fingerprint saved! Remove your finger and place again.');
      toast({ title: 'Success', description: 'First fingerprint captured' });
    } catch (error) {
      addLog(`✗ Capture failed: ${error.message}`, 'error');
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const captureSecondFinger = async () => {
    if (!sensor || !isConnected) {
      toast({
        title: 'Error',
        description: 'Sensor not connected',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      addLog('Step 2: Capturing second fingerprint...');
      setMessage('Capturing second fingerprint...');

      if (!(await sensor.captureImage())) {
        throw new Error('No finger detected');
      }
      addLog('✓ Image captured');

      if (!(await sensor.convertToTemplate(2))) {
        throw new Error('Template conversion failed');
      }
      addLog('✓ Template created');

      addLog('Creating fingerprint model...');
      if (!(await sensor.createModel())) {
        throw new Error('Model creation failed - fingerprints do not match well enough');
      }
      addLog('✓ Model created');

      // Get next available ID
      const nextId = await sensor.getNextAvailableId();
      if (!nextId) throw new Error('No available fingerprint IDs');

      addLog(`Storing model with ID: ${nextId}`);
      if (!(await sensor.storeModel(1, nextId))) {
        throw new Error('Failed to store fingerprint on sensor');
      }
      addLog(`✓ Fingerprint stored at ID ${nextId}`);

      setFingerprintId(nextId);
      setStep('saving');
      await saveToDatabase(nextId);
    } catch (error) {
      addLog(`✗ Capture failed: ${error.message}`, 'error');
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToDatabase = async (fpId: number) => {
    if (!student) return;

    try {
      addLog('Saving fingerprint to database...');

      const { error } = await supabase
        .from('fingerprint_templates')
        .insert([{
          student_id: student.id,
          fingerprint_id: fpId,
          is_verified: true
        }]);

      if (error) throw error;

      addLog(`✓ Fingerprint saved for ${student.name}`);
      setMessage('✓ Enrollment Complete!');
      setEnrolledCount(enrolledCount + 1);

      toast({
        title: 'Success!',
        description: `${student.name} enrolled successfully`
      });

      // Reset form
      setTimeout(() => {
        setEnrollmentNumber('');
        setStudent(null);
        setFingerprintId(0);
        setStep('idle');
        setMessage('');
      }, 2000);
    } catch (error) {
      addLog(`✗ Database save failed: ${error.message}`, 'error');
      toast({
        title: 'Error',
        description: `Failed to save: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const disconnectSensor = async () => {
    if (sensor) {
      addLog('Disconnecting sensor...');
      await sensor.disconnect();
      setSensor(null);
      setIsConnected(false);
      setStep('idle');
      setMessage('');
      addLog('✓ Disconnected');
    }
  };

  return (
    <PageShell role="admin">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Fingerprint Enrollment</h1>
          <p className="text-muted-foreground">Add fingerprint devices and enroll student fingerprints for attendance</p>
        </div>

        {/* Device Registration */}
        <div className="rounded-lg border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Device Registration
            </h2>
            <Button variant="outline" onClick={loadDevices} disabled={deviceLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${deviceLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input
              placeholder="Device code (DEVICE_001)"
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value.toUpperCase())}
              disabled={deviceSaving}
            />
            <Input
              placeholder="Device name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              disabled={deviceSaving}
            />
            <Input
              placeholder="Firmware (3.0)"
              value={firmwareVersion}
              onChange={(e) => setFirmwareVersion(e.target.value)}
              disabled={deviceSaving}
            />
            <Button onClick={saveDevice} disabled={deviceSaving || !deviceCode.trim()}>
              {deviceSaving ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Save Device
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {devices.map((d) => {
              const online = isDeviceOnline(d.last_seen_at);
              return (
                <div key={d.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{d.device_name || d.device_code}</p>
                    <p className="text-xs text-muted-foreground">{d.device_code} • v{d.firmware_version || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">
                      Last seen: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {online ? 'Online' : 'Offline'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Main Panel */}
          <div className="col-span-2 space-y-4">
            {/* Connection */}
            <div className={`rounded-lg p-4 border-2 ${
              isConnected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-gray-400" />
                  )}
                  <div>
                    <h3 className="font-semibold">
                      {isConnected ? 'Sensor Connected' : 'Sensor Disconnected'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isConnected ? `${enrolledCount} templates enrolled` : 'Connect USB R307 sensor'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={isConnected ? disconnectSensor : connectSensor}
                  disabled={isLoading}
                  variant={isConnected ? 'outline' : 'default'}
                >
                  {isLoading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Usb className="w-4 h-4 mr-2" />}
                  {isConnected ? 'Disconnect' : 'Connect Sensor'}
                </Button>
              </div>
            </div>

            {isConnected && step === 'idle' && (
              <div className="rounded-lg p-6 border bg-white space-y-4">
                <h2 className="text-xl font-semibold">Step 1: Find Student</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">Enrollment Number</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter enrollment number (e.g., 101)"
                      value={enrollmentNumber}
                      onChange={(e) => setEnrollmentNumber(e.target.value)}
                      disabled={isLoading}
                      onKeyPress={(e) => e.key === 'Enter' && searchStudent()}
                    />
                    <Button onClick={searchStudent} disabled={isLoading || !enrollmentNumber}>
                      Search
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 'enrolling' && student && (
              <div className="rounded-lg p-6 border bg-white space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-bold">{student.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{student.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {student.enrollment_no} • {student.classes?.name} {student.classes?.division}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={captureFirstFinger}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    {isLoading && step === 'enrolling' ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Scan First Finger
                  </Button>

                  <Button
                    onClick={captureSecondFinger}
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    {isLoading && step === 'enrolling' ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Scan Second Finger
                  </Button>

                  <Button
                    onClick={() => {
                      setStep('idle');
                      setStudent(null);
                      setEnrollmentNumber('');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground text-center">{message}</p>
              </div>
            )}

            {step === 'saving' && (
              <div className="rounded-lg p-6 border bg-green-50 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                <h3 className="font-semibold text-lg">✓ Enrollment Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  {student?.name} can now use fingerprint for attendance
                </p>
              </div>
            )}
          </div>

          {/* Log Panel */}
          <div className="rounded-lg p-4 border bg-white h-[600px] flex flex-col">
            <h3 className="font-semibold mb-3">Activity Log</h3>
            <div className="flex-1 overflow-y-auto bg-black/5 rounded p-3 font-mono text-xs space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-muted-foreground">{log}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Browser Support Warning */}
        {!navigator.serial && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">Chrome/Edge Required</p>
              <p className="text-sm text-blue-700">Use Chrome, Edge, or Brave for WebSerial support</p>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default FingerprintEnrollmentPage;
