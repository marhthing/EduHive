import { differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears } from 'date-fns';

export function formatTimeShort(date: string | Date): string {
  const now = new Date();
  const targetDate = new Date(date);

  const minutes = differenceInMinutes(now, targetDate);
  const hours = differenceInHours(now, targetDate);
  const days = differenceInDays(now, targetDate);
  const weeks = differenceInWeeks(now, targetDate);
  const months = differenceInMonths(now, targetDate);
  const years = differenceInYears(now, targetDate);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 4) return `${weeks}w`;
  if (months < 12) return `${months}mo`;
  return `${years}y`;
}