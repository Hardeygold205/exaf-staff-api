export const REQUEST_CATEGORIES = [
  'LEAVE',
  'TRAVEL',
  'EQUIPMENT',
  'REPAIR',
  'REIMBURSEMENT',
  'OTHER',
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const DATE_REQUIRED_CATEGORIES: RequestCategory[] = ['LEAVE', 'TRAVEL'];
