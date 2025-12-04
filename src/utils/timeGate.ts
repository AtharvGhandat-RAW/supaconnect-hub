// Time-gate utility for attendance window validation

export interface TimeGateResult {
  enabled: boolean;
  reason?: string;
}

/**
 * Check if attendance can be taken for a given slot time
 * @param startTime - Slot start time in HH:MM format
 * @param windowBefore - Minutes before start time (default: 5)
 * @param windowAfter - Minutes after start time (default: 15)
 * @returns TimeGateResult with enabled status and reason
 */
export function checkTimeGate(
  startTime: string,
  windowBefore: number = 5,
  windowAfter: number = 15
): TimeGateResult {
  const now = new Date();
  const [hours, minutes] = startTime.split(':').map(Number);
  
  const slotTime = new Date();
  slotTime.setHours(hours, minutes, 0, 0);
  
  const windowStart = new Date(slotTime.getTime() - windowBefore * 60 * 1000);
  const windowEnd = new Date(slotTime.getTime() + windowAfter * 60 * 1000);
  
  if (now < windowStart) {
    const diffMs = windowStart.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / 60000);
    return {
      enabled: false,
      reason: `Too early. Opens in ${diffMins} minute${diffMins > 1 ? 's' : ''}`
    };
  }
  
  if (now > windowEnd) {
    return {
      enabled: false,
      reason: 'Attendance window closed'
    };
  }
  
  return { enabled: true };
}

/**
 * Get slot status based on current time
 * @param startTime - Slot start time in HH:MM format
 * @param isCompleted - Whether attendance is already taken
 * @returns Status string
 */
export function getSlotStatus(
  startTime: string,
  isCompleted: boolean
): 'upcoming' | 'ongoing' | 'completed' | 'missed' {
  if (isCompleted) return 'completed';
  
  const now = new Date();
  const [hours, minutes] = startTime.split(':').map(Number);
  
  const slotTime = new Date();
  slotTime.setHours(hours, minutes, 0, 0);
  
  const windowStart = new Date(slotTime.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(slotTime.getTime() + 15 * 60 * 1000);
  const slotEnd = new Date(slotTime.getTime() + 60 * 60 * 1000);
  
  if (now < windowStart) return 'upcoming';
  if (now >= windowStart && now <= windowEnd) return 'ongoing';
  if (now > slotEnd) return 'missed';
  
  return 'upcoming';
}
