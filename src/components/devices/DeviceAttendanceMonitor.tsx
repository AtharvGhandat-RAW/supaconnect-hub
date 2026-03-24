import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Wifi,
  WifiOff,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  StopCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  getDeviceByCode,
  isDeviceOnline,
  endDeviceSession,
  subscribeToDeviceStatus,
  subscribeToAttendanceRecords,
  FingerprintDevice
} from '@/services/devices';
import { getAttendanceRecords } from '@/services/attendance';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  name: string;
  roll_no: number;
  enrollment_no: string;
  status: 'PRESENT' | 'ABSENT';
}

interface DeviceAttendanceMonitorProps {
  deviceCode: string;
  deviceSessionId: string;
  attendanceSessionId: string;
  students: Student[];
  onSessionEnd: () => void;
}

const DeviceAttendanceMonitor: React.FC<DeviceAttendanceMonitorProps> = ({
  deviceCode,
  deviceSessionId,
  attendanceSessionId,
  students: initialStudents,
  onSessionEnd,
}) => {
  const { toast } = useToast();
  const [device, setDevice] = useState<FingerprintDevice | null>(null);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [isEnding, setIsEnding] = useState(false);

  // Load device info
  useEffect(() => {
    const loadDevice = async () => {
      const d = await getDeviceByCode(deviceCode);
      setDevice(d);
    };
    loadDevice();
  }, [deviceCode]);

  // Subscribe to device status
  useEffect(() => {
    const subscription = subscribeToDeviceStatus(deviceCode, (updatedDevice) => {
      setDevice(updatedDevice);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [deviceCode]);

  // Subscribe to attendance record changes
  useEffect(() => {
    const subscription = subscribeToAttendanceRecords(
      attendanceSessionId,
      (record) => {
        setStudents(prev => {
          const updated = prev.map(s => {
            if (s.id === record.student_id) {
              // Add to recent activity
              const studentName = s.name;
              setRecentActivity(prev => [
                `${studentName} marked ${record.status}`,
                ...prev.slice(0, 4)
              ]);

              return { ...s, status: record.status as 'PRESENT' | 'ABSENT' };
            }
            return s;
          });
          return updated;
        });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [attendanceSessionId]);

  // Refresh attendance data
  const refreshData = useCallback(async () => {
    try {
      const records = await getAttendanceRecords(attendanceSessionId);
      const statusMap = new Map(
        records.map((r: { student_id: string; status: string }) => [r.student_id, r.status])
      );

      setStudents(prev =>
        prev.map(s => ({
          ...s,
          status: (statusMap.get(s.id) as 'PRESENT' | 'ABSENT') || 'ABSENT'
        }))
      );
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, [attendanceSessionId]);

  // End device session
  const handleEndSession = async () => {
    setIsEnding(true);
    try {
      await endDeviceSession(deviceSessionId);
      toast({
        title: 'Session Ended',
        description: 'Device has been disconnected from this attendance session.',
      });
      onSessionEnd();
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: 'Error',
        description: 'Failed to end device session.',
        variant: 'destructive',
      });
    } finally {
      setIsEnding(false);
    }
  };

  const presentCount = students.filter(s => s.status === 'PRESENT').length;
  const totalCount = students.length;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const deviceOnline = device ? isDeviceOnline(device) : false;

  return (
    <div className="space-y-4">
      {/* Device Status Bar */}
      <div className={`flex items-center justify-between p-4 rounded-lg border ${
        deviceOnline ? 'border-success/50 bg-success/5' : 'border-warning/50 bg-warning/5'
      }`}>
        <div className="flex items-center gap-3">
          <Fingerprint className="w-6 h-6" />
          <div>
            <p className="font-medium">{device?.device_name || deviceCode}</p>
            <p className="text-xs text-muted-foreground">
              {deviceOnline ? 'Device connected and ready' : 'Device offline - attendance may not sync'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {deviceOnline ? (
            <Wifi className="w-5 h-5 text-success animate-pulse" />
          ) : (
            <WifiOff className="w-5 h-5 text-warning" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndSession}
            disabled={isEnding}
          >
            {isEnding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <StopCircle className="w-4 h-4 mr-1" />
                End
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Attendance Progress */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Attendance Progress</span>
          </div>
          <span className="text-2xl font-bold text-foreground">
            {presentCount}/{totalCount}
          </span>
        </div>
        <Progress value={percentage} className="h-3" />
        <p className="text-sm text-muted-foreground mt-2">
          {percentage}% attendance marked via fingerprint
        </p>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            Recent Activity
          </h4>
          <AnimatePresence>
            {recentActivity.map((activity, index) => (
              <motion.div
                key={`${activity}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="text-sm text-muted-foreground py-1"
              >
                {activity}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Student List */}
      <div className="glass-card rounded-xl p-4">
        <h4 className="font-medium mb-3">Student Status</h4>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {students
            .sort((a, b) => a.roll_no - b.roll_no)
            .map(student => (
              <motion.div
                key={student.id}
                layout
                className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                  student.status === 'PRESENT' ? 'bg-success/10' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-8 text-muted-foreground">{student.roll_no}</span>
                  <span>{student.name}</span>
                </div>
                {student.status === 'PRESENT' ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
              </motion.div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default DeviceAttendanceMonitor;
