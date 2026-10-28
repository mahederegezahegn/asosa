import { MealPeriodName, SystemSettings } from '../types/gate';

/**
 * Calculates which meal period is currently active based on current time
 * and the configured start and end times in SystemSettings.
 */
export function getActiveMealPeriod(mealPeriods?: SystemSettings['mealPeriods']): MealPeriodName {
  const defaultPeriods = {
    Breakfast: { start: '07:00', end: '10:30' },
    Lunch: { start: '11:30', end: '14:30' },
    Dinner: { start: '17:30', end: '21:00' },
  };

  const periods = mealPeriods || defaultPeriods;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const toMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const bStart = toMinutes(periods.Breakfast?.start || '07:00');
  const bEnd = toMinutes(periods.Breakfast?.end || '10:30');
  const lStart = toMinutes(periods.Lunch?.start || '11:30');
  const lEnd = toMinutes(periods.Lunch?.end || '14:30');
  const dStart = toMinutes(periods.Dinner?.start || '17:30');
  const dEnd = toMinutes(periods.Dinner?.end || '21:00');

  if (currentMinutes >= bStart && currentMinutes <= bEnd) return 'Breakfast';
  if (currentMinutes >= lStart && currentMinutes <= lEnd) return 'Lunch';
  if (currentMinutes >= dStart && currentMinutes <= dEnd) return 'Dinner';

  // If outside all periods, choose closest natural period:
  if (currentMinutes < lStart) return 'Breakfast';
  if (currentMinutes < dStart) return 'Lunch';
  return 'Dinner';
}

/**
 * Formats a 24h time string like "07:00" to friendly "7:00 AM"
 */
export function formatTimeFriendly(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = (h || 0) >= 12 ? 'PM' : 'AM';
  const hour12 = (h || 0) % 12 || 12;
  const minutePadded = String(m || 0).padStart(2, '0');
  return `${hour12}:${minutePadded} ${period}`;
}
