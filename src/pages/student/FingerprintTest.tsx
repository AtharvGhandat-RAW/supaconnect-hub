import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import PageShell from '@/components/layout/PageShell';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FingerprintMatch {
  fingerprintId: number;
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  confidence: number;
}

interface ActivityLog {
  timestamp: string;
  action: string;
  status: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

const R307_COMMANDS = {
  GENIMG: 0x01,
  IMG2TZ: 0x02,
  SEARCH: 0x04,
};

const FINGERPRINT_OK = 0x00;
const COMMAND_TIMEOUT = 8000;
const RESPONSE_TIMEOUT = 5000;

class R307Interface {
  constructor(onLog) {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.onLog = onLog;
  }

  log(action, status, message) {
    if (this.onLog) {
      this.onLog({ action, status, message });
    }
  }

  async connect(portInfo) {
    try {
      this.log('Connect', 'info', 'Connecting to serial port...');
      this.port = await navigator.serial.open(portInfo, {
        baudRate: 57600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();

      this.log('Connect', 'success', 'Serial port opened successfully');
      return true;
    } catch (error) {
      this.log('Connect', 'error', `Connection failed: ${error.message}`);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.reader) {
        this.reader.releaseLock();
      }
      if (this.writer) {
        this.writer.releaseLock();
      }
      if (this.port) {
        await this.port.close();
      }
      this.log('Disconnect', 'success', 'Serial port closed');
    } catch (e) {
      this.log('Disconnect', 'warning', `Disconnect error: ${e.message}`);
    }
  }

  async sendCommand(command, data = [], timeout = COMMAND_TIMEOUT) {
    try {
      const packet = this.buildPacket(command, data);
      await this.writer.write(new Uint8Array(packet));

      const response = await this.readResponse(timeout);
      if (!response) {
        throw new Error('No response from sensor');
      }

      return response;
    } catch (error) {
      this.log('Command', 'error', `Send failed: ${error.message}`);
      throw error;
    }
  }

  buildPacket(command, data) {
    const header = [0xEF, 0x01];
    const address = [0xFF, 0xFF, 0xFF, 0xFF];
    const length = data.length + 2;
    const lengthBytes = [(length >> 8) & 0xFF, length & 0xFF];

    const packet = [...header, ...address, command, ...lengthBytes, ...data];
    const checksum = this.calculateChecksum([command, ...lengthBytes, ...data]);

    return [...packet, (checksum >> 8) & 0xFF, checksum & 0xFF];
  }

  calculateChecksum(data) {
    return data.reduce((a, b) => a + b, 0) & 0xFFFF;
  }

  async readResponse(timeout = RESPONSE_TIMEOUT) {
    const buffer = [];
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;

        if (value) {
          buffer.push(...value);
        }

        // Check if we have a complete packet
        if (buffer.length >= 12) {
          if (buffer[0] === 0xEF && buffer[1] === 0x01) {
            const length = (buffer[7] << 8) | buffer[8];
            const totalLength = 9 + length;

            if (buffer.length >= totalLength) {
              const response = {
                type: buffer[6],
                data: buffer.slice(9, 9 + length - 2)
              };
              return response;
            }
          }
        }
      } catch (error) {
        // Continue reading on error
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return null;
  }

  async scanAndSearch() {
    try {
      // Capture image
      this.log('Scan', 'info', 'Capturing fingerprint image...');
      let response = await this.sendCommand(R307_COMMANDS.GENIMG);
      if (!response?.data?.[0] === FINGERPRINT_OK) {
        throw new Error('Failed to capture image - no finger detected or sensor error');
      }
      this.log('Scan', 'success', 'Image captured');

      // Convert to template
      this.log('Scan', 'info', 'Converting image to template...');
      response = await this.sendCommand(R307_COMMANDS.IMG2TZ, [1]);
      if (!response?.data?.[0] === FINGERPRINT_OK) {
        throw new Error('Failed to convert image to template');
      }
      this.log('Scan', 'success', 'Template created');

      // Search database
      this.log('Scan', 'info', 'Searching fingerprint database...');
      response = await this.sendCommand(R307_COMMANDS.SEARCH, [1, 0, 0, 0xFF]);

      if (response?.data?.[0] === FINGERPRINT_OK) {
        const id = (response.data[1] << 8) | response.data[2];
        const confidence = (response.data[3] << 8) | response.data[4];
        this.log('Scan', 'success', `Match found - ID: ${id}, Confidence: ${confidence}`);
        return { id, confidence };
      }

      this.log('Scan', 'warning', 'No matching fingerprint found');
      return null;
    } catch (error) {
      this.log('Scan', 'error', error.message);
      throw error;
    }
  }
}

const FingerprintTestPage: React.FC = () => {
  const [sensor, setSensor] = useState<R307Interface | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<FingerprintMatch | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const addLog = (log: Omit<ActivityLog, 'timestamp'>) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { ...log, timestamp }].slice(-20));
  };

  const connectSensor = async () => {
    try {
      setStatus('connecting');
      setError('');
      addLog({ action: 'Connect', status: 'info', message: 'Requesting serial port...' });

      const ports = await navigator.serial.requestPort();
      const r307 = new R307Interface(addLog);

      if (await r307.connect(ports)) {
        setSensor(r307);
        setIsConnected(true);
        setStatus('connected');
        addLog({ action: 'Connect', status: 'success', message: 'Connected to fingerprint sensor' });
        toast({
          title: 'Success',
          description: 'Connected to fingerprint sensor'
        });
      } else {
        throw new Error('Failed to connect to sensor');
      }
    } catch (error: any) {
      setError(error.message);
      setStatus('error');
      addLog({ action: 'Connect', status: 'error', message: error.message });
      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const scanFingerprint = async () => {
    if (!sensor || !isConnected) return;

    try {
      setIsScanning(true);
      setError('');
      setStatus('scanning');
      setResult(null);
      addLog({ action: 'Scan', status: 'info', message: 'Starting fingerprint scan...' });

      const match = await sensor.scanAndSearch();

      if (match) {
        addLog({
          action: 'Scan',
          status: 'info',
          message: `Fingerprint found (ID: ${match.id}), fetching student details...`
        });

        // Query Supabase for student details
        const { data: fpData, error: fpError } = await supabase
          .from('fingerprint_templates')
          .select(
            `
            student_id,
            students(id, name, enrollment_no)
          `
          )
          .eq('fingerprint_id', match.id)
          .single();

        if (fpError || !fpData) {
          throw new Error('Student not found in system');
        }

        const student = fpData.students;

        // Mark attendance if in active session
        if (student) {
          setResult({
            fingerprintId: match.id,
            studentId: student.id,
            studentName: student.name,
            enrollmentNo: student.enrollment_no,
            confidence: match.confidence
          });
          setStatus('matched');
          addLog({
            action: 'Match',
            status: 'success',
            message: `Found: ${student.name} (${student.enrollment_no}) - Confidence: ${match.confidence}%`
          });
          toast({
            title: 'Match Found!',
            description: `${student.name} - Confidence: ${match.confidence}%`
          });
        }
      } else {
        setError('No matching fingerprint found in database');
        setStatus('no_match');
        addLog({ action: 'Scan', status: 'warning', message: 'No matching fingerprint found' });
        toast({
          title: 'No Match',
          description: 'Fingerprint not registered in system',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setError(error.message);
      setStatus('error');
      addLog({ action: 'Scan', status: 'error', message: error.message });
      toast({
        title: 'Scan Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const disconnectSensor = async () => {
    if (sensor) {
      await sensor.disconnect();
      setSensor(null);
      setIsConnected(false);
      setStatus('idle');
      setResult(null);
      setError('');
      addLog({ action: 'Disconnect', status: 'success', message: 'Disconnected from sensor' });
    }
  };

  return (
    <PageShell role="student">
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <Fingerprint className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold">Fingerprint Verification</h1>
          <p className="text-muted-foreground mt-2">
            Verify your fingerprint and test the system
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Browser Support */}
            {!navigator.serial && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-red-900">Unsupported Browser</p>
                  <p className="text-sm text-red-700">
                    Please use Chrome, Edge, or Brave browser for fingerprint verification
                  </p>
                </div>
              </div>
            )}

            {/* Connection Status */}
            <div
              className={`rounded-lg p-6 border-2 ${
                isConnected
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                {isConnected ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-gray-400" />
                )}
                <span className="font-semibold">
                  {isConnected ? 'Sensor Connected' : 'Sensor Not Connected'}
                </span>
              </div>

              {!isConnected ? (
                <Button
                  onClick={connectSensor}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!navigator.serial}
                >
                  Connect Sensor
                </Button>
              ) : (
                <Button
                  onClick={disconnectSensor}
                  variant="outline"
                  className="w-full"
                >
                  Disconnect
                </Button>
              )}
            </div>

            {/* Scanning Area */}
            {isConnected && (
              <div className="bg-white rounded-lg p-8 border text-center space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Ready to Scan</h2>
                  <p className="text-muted-foreground">
                    Place your finger on the sensor
                  </p>
                </div>

                <Button
                  onClick={scanFingerprint}
                  disabled={isScanning || !isConnected}
                  size="lg"
                  className="w-full h-16 text-lg bg-green-600 hover:bg-green-700"
                >
                  {isScanning ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-5 h-5 mr-2" />
                      Scan Fingerprint
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Results */}
            {result && status === 'matched' && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-green-900">Match Found!</h3>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Student Name:</span>
                    <span className="ml-2">{result.studentName}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Enrollment Number:</span>
                    <span className="ml-2">{result.enrollmentNo}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Confidence:</span>
                    <span className="ml-2">{result.confidence}%</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setResult(null);
                    setStatus('idle');
                    setError('');
                  }}
                  className="w-full mt-4"
                >
                  Scan Another
                </Button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-semibold text-red-900">Scan Failed</h3>
                </div>
                <p className="text-red-700 text-sm">{error}</p>
                <Button
                  onClick={scanFingerprint}
                  disabled={isScanning}
                  className="w-full mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-4 text-sm">
              <h3 className="font-semibold mb-2 text-blue-900">Instructions:</h3>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Click "Connect Sensor" to connect the fingerprint scanner</li>
                <li>Place your finger firmly and steadily on the sensor</li>
                <li>Click "Scan Fingerprint"</li>
                <li>If recognized, your information will be displayed</li>
              </ol>
            </div>
          </div>

          {/* Activity Log Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white border rounded-lg p-4 sticky top-4 max-h-[600px] overflow-hidden flex flex-col">
              <h3 className="font-semibold mb-3 text-sm text-gray-700">Activity Log</h3>
              <Textarea
                value={logs.map(log => `[${log.timestamp}] ${log.action}: ${log.message}`).join('\n')}
                readOnly
                className="text-xs font-mono flex-1 resize-none"
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setLogs([])}
              >
                Clear Log
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default FingerprintTestPage;
