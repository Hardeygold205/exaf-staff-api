const WAT_OFFSET_MS = 60 * 60 * 1000;

const CHECK_IN_OPEN_SECONDS = 8 * 3600;
const OFFICIAL_START_SECONDS = 9 * 3600;
const BREAK_START_SECONDS = 13 * 3600;
const BREAK_END_SECONDS = 14 * 3600;
const OFFICIAL_END_SECONDS = 17 * 3600;
const CHECK_OUT_GRACE_END_SECONDS = 18 * 3600;

export function watSecondsOfDay(date: Date = new Date()): number {
  const wat = new Date(date.getTime() + WAT_OFFSET_MS);
  return wat.getUTCHours() * 3600 + wat.getUTCMinutes() * 60 + wat.getUTCSeconds();
}

export function isCheckInAllowed(at: Date = new Date()): boolean {
  const seconds = watSecondsOfDay(at);
  return seconds >= CHECK_IN_OPEN_SECONDS;
}

const LATE_CHECK_IN_SECONDS = 9 * 3600 + 30 * 60;

export function isLateCheckIn(at: Date = new Date()): boolean {
  return watSecondsOfDay(at) > LATE_CHECK_IN_SECONDS;
}

export function isTrackingAllowed(at: Date = new Date()): boolean {
  const seconds = watSecondsOfDay(at);
  return (
    (seconds >= OFFICIAL_START_SECONDS && seconds < BREAK_START_SECONDS) ||
    (seconds >= BREAK_END_SECONDS && seconds < CHECK_OUT_GRACE_END_SECONDS)
  );
}

export function isBreakTime(at: Date = new Date()): boolean {
  const seconds = watSecondsOfDay(at);
  return seconds >= BREAK_START_SECONDS && seconds < BREAK_END_SECONDS;
}

export function isBeforeOfficialEnd(at: Date = new Date()): boolean {
  return watSecondsOfDay(at) < OFFICIAL_END_SECONDS;
}

export function isCheckoutGracePeriod(at: Date = new Date()): boolean {
  const seconds = watSecondsOfDay(at);
  return seconds >= OFFICIAL_END_SECONDS && seconds <= CHECK_OUT_GRACE_END_SECONDS;
}

export function isAfterCheckoutGrace(at: Date = new Date()): boolean {
  return watSecondsOfDay(at) > CHECK_OUT_GRACE_END_SECONDS;
}

export function isEarlyCheckOut(at: Date = new Date()): boolean {
  return isBeforeOfficialEnd(at);
}

export const CHECKOUT_REASON_OPTIONS = [
  { value: 'FORGOT_TO_CHECKOUT', label: 'I forgot to check out' },
  { value: 'WORKING_IN_OFFICE', label: "I'm in the office working" },
  { value: 'URGENT_TASK', label: 'I was completing an urgent task' },
  { value: 'MEETING', label: 'I was attending a meeting' },
  { value: 'COMPANY_ASSIGNMENT', label: 'I was handling a company assignment' },
  { value: 'REQUESTED_TO_WORK_LATE', label: 'I was asked to work late' },
  { value: 'TECHNICAL_ISSUE', label: 'I had a technical issue' },
  { value: 'OTHER', label: 'Other' },
] as const;
