// How facts read on screen. Built by hand rather than with Intl's locale data,
// which differs between ICU versions ("Sep" vs "Sept", U+2212 minus), so the
// browser, the APK's WebView and the tests all print the same thing.

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// No-break space: "1 184,00 kr" must never wrap inside the number.
const NBSP = ' ';

// Norwegian money style, "1 184,00 kr", since the archive is Norwegian
// receipts. Other currencies keep their ISO code: "12,50 EUR".
export function formatAmount(amountMinor: number, currency: string): string {
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, '0');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  let sign = '';
  if (negative) {
    sign = '-';
  }
  let unit = currency;
  if (currency === 'NOK') {
    unit = 'kr';
  }
  return `${sign}${grouped},${cents}${NBSP}${unit}`;
}

// "2026-09-27" → "27 Sep"
export function formatDayShort(date: string): string {
  const { month, day } = splitDate(date);
  return `${day} ${MONTHS[month - 1]?.slice(0, 3)}`;
}

// "2026-09-27" → "27 Sep 2026"
export function formatDayLong(date: string): string {
  const { year, month, day } = splitDate(date);
  return `${day} ${MONTHS[month - 1]?.slice(0, 3)} ${year}`;
}

// "2026-09" → "September 2026"
export function formatMonth(monthKey: string): string {
  const { year, month } = splitDate(`${monthKey}-01`);
  return `${MONTHS[month - 1]} ${year}`;
}

// The calendar day a UTC timestamp falls on in the given IANA time zone.
// Stored times are UTC; this is the "convert only when rendering" step.
export function localDate(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values: Record<string, string> = {};
  for (const part of parts) {
    values[part.type] = part.value;
  }
  return `${values.year}-${values.month}-${values.day}`;
}

// "2026-09-25T04:12:00Z" in Europe/Oslo → "25 Sep 2026, 06:12". A 24-hour
// clock, as Norwegian receipts print it.
export function formatDateTime(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const values: Record<string, string> = {};
  for (const part of parts) {
    values[part.type] = part.value;
  }
  return `${formatDayLong(localDate(timestamp, timeZone))}, ${values.hour}:${values.minute}`;
}

// File sizes as a file manager shows them: "812 bytes", "184 KB", "2.4 MB".
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${Math.round(kilobytes)} KB`;
  }
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function splitDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-');
  return { year: Number(year), month: Number(month), day: Number(day) };
}
