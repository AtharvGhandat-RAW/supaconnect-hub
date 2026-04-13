import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Fingerprint,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  Smartphone
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getDeviceByCode,
  isDeviceOnline,
  subscribeToDeviceStatus,
  FingerprintDevice
} from '@/services/devices';

interface DeviceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facultyId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  className: string;
  batchId?: string;
  attendanceSessionId: string;
  startTime: string;
  onConfigured: (deviceCode: string) => void;
}

const DeviceConfigDialog: React.FC<DeviceConfigDialogProps> = ({
  open,
  onOpenChange,
  facultyId,
  classId,
  subjectId,
  subjectName,
  className,
  batchId,
  attendanceSessionId,
  startTime,
  onConfigured,
}) => {
  const { toast } = useToast();
  const [deviceCode, setDeviceCode] = useState('');
  const [device, setDevice] = useState<FingerprintDevice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDeviceCode('');
      setDevice(null);
      setError(null);
    }
  }, [open]);

  // Check device when code is entered
  const handleCheckDevice = async () => {
    if (!deviceCode.trim()) {
      setError('Please enter a device code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const foundDevice = await getDeviceByCode(deviceCode.trim().toUpperCase());

      if (!foundDevice) {
        setError('Device not found. Please check the code.');
        setDevice(null);
        return;
      }

      setDevice(foundDevice);

      if (!isDeviceOnline(foundDevice)) {
        setError('Device appears to be offline. Please check if it is powered on.');
      }
    } catch (err) {
      console.error('Error checking device:', err);
      setError('Failed to check device. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Configure device for attendance - only verify and store device code
  // Actual device session creation happens in handleSubmit after attendance session is created
  const handleConfigure = async () => {
    if (!device) return;

    // Just verify device is online, don't create device session yet
    if (!isDeviceOnline(device)) {
      setError('Device appears to be offline. Please check if it is powered on.');
      return;
    }

    toast({
      title: 'Device Selected',
      description: `Device ${device.device_code} will be configured when attendance is submitted.`,
    });

    onConfigured(device.device_code);
    onOpenChange(false);
  };

  // Subscribe to device status updates
  useEffect(() => {
    if (!device) return;

    const subscription = subscribeToDeviceStatus(device.device_code, (updatedDevice) => {
      setDevice(updatedDevice);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [device?.device_code]);

  const deviceOnline = device ? isDeviceOnline(device) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5" />
            Configure Fingerprint Device
          </DialogTitle>
          <DialogDescription>
            Enter the device code to enable biometric attendance for this session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Session Info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p><strong>Subject:</strong> {subjectName}</p>
            <p><strong>Class:</strong> {className}</p>
            <p><strong>Time:</strong> {startTime}</p>
          </div>

          {/* Device Code Input */}
          <div className="space-y-2">
            <Label htmlFor="device-code">Device Code</Label>
            <div className="flex gap-2">
              <Input
                id="device-code"
                placeholder="e.g., DEVICE_001"
                value={deviceCode}
                onChange={(e) => setDeviceCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckDevice()}
                disabled={isLoading || !!device}
              />
              {!device && (
                <Button
                  onClick={handleCheckDevice}
                  disabled={isLoading || !deviceCode.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Check'
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Find the device code printed on the attendance device
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}

          {/* Device Info */}
          {device && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className={`flex items-center justify-between p-3 rounded-lg border ${
                deviceOnline ? 'border-success/50 bg-success/10' : 'border-warning/50 bg-warning/10'
              }`}>
                <div className="flex items-center gap-3">
                  <Smartphone className="w-8 h-8" />
                  <div>
                    <p className="font-medium">{device.device_name || device.device_code}</p>
                    <p className="text-xs text-muted-foreground">
                      Code: {device.device_code}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deviceOnline ? (
                    <>
                      <Wifi className="w-5 h-5 text-success" />
                      <span className="text-sm text-success">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-5 h-5 text-warning" />
                      <span className="text-sm text-warning">Offline</span>
                    </>
                  )}
                </div>
              </div>

              {device.firmware_version && (
                <p className="text-xs text-muted-foreground">
                  Firmware: v{device.firmware_version}
                </p>
              )}

              {device.last_seen_at && (
                <p className="text-xs text-muted-foreground">
                  Last seen: {new Date(device.last_seen_at).toLocaleString()}
                </p>
              )}

              {/* Change Device Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDevice(null);
                  setDeviceCode('');
                  setError(null);
                }}
              >
                Change Device
              </Button>
            </motion.div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {device && (
            <Button
              onClick={handleConfigure}
              disabled={!deviceOnline}
              className="btn-gradient"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Select Device
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceConfigDialog;
