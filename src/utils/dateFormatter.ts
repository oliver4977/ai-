/**
 * Unified Date and Timestamp Formatting Utilities for Korean Standard Time (KST, Asia/Seoul)
 * Ensures accurate UTC <-> KST conversion and safe timestamp parsing for sorting and display.
 */

/**
 * Parses any timestamp representation (ISO string, Unix timestamp in ms or sec, Date object, or legacy string)
 * into a valid Unix timestamp in milliseconds.
 * Returns 0 if invalid.
 */
export function parseTimestampToMs(val: string | number | Date | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    // If it's in seconds (e.g. 1700000000 instead of 1700000000000)
    if (val < 1e11) return val * 1000;
    return val;
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? 0 : val.getTime();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return 0;
    
    // Try standard ISO / Date.parse
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return parsed;

    // Handle legacy Korean strings like "2026. 9. 3. 오후 6:05:23"
    try {
      const match = trimmed.match(/(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        
        let hour = 0;
        let minute = 0;
        let second = 0;
        
        const isPM = trimmed.includes('오후') || trimmed.toLowerCase().includes('pm');
        const isAM = trimmed.includes('오전') || trimmed.toLowerCase().includes('am');
        
        const timeMatch = trimmed.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (timeMatch) {
          hour = parseInt(timeMatch[1], 10);
          minute = parseInt(timeMatch[2], 10);
          second = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
          if (isPM && hour < 12) hour += 12;
          if (isAM && hour === 12) hour = 0;
        }
        
        const d = new Date(year, month, day, hour, minute, second);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      }
    } catch (e) {
      return 0;
    }
  }
  return 0;
}

/**
 * Formats a UTC ISO timestamp or date value to Korean Standard Time (KST, Asia/Seoul)
 * Output Format: "YYYY-MM-DD HH:mm:ss"
 */
export function formatKST(val: string | number | Date | undefined | null): string {
  if (!val) return '-';
  const ms = parseTimestampToMs(val);
  if (ms <= 0) {
    // If it's already a clean non-empty string, return it as fallback
    return typeof val === 'string' ? val : '-';
  }

  try {
    const d = new Date(ms);
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const year = parts.find((p) => p.type === 'year')?.value || '';
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    const second = parts.find((p) => p.type === 'second')?.value || '00';

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (e) {
    return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
  }
}

/**
 * Formats a timestamp to KST Time only: "HH:mm:ss"
 */
export function formatKSTTime(val: string | number | Date | undefined | null): string {
  if (!val) return '-';
  const ms = parseTimestampToMs(val);
  if (ms <= 0) return typeof val === 'string' ? val : '-';

  try {
    const d = new Date(ms);
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    const second = parts.find((p) => p.type === 'second')?.value || '00';
    return `${hour}:${minute}:${second}`;
  } catch (e) {
    return new Date(ms).toTimeString().slice(0, 8);
  }
}
