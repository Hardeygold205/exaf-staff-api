import { z } from 'zod';
import { companyEmailRefineMessage, isCompanyEmail } from './company-email';

export const companyEmail = z.string().email().superRefine((email, ctx) => {
  if (!isCompanyEmail(email)) {
    ctx.addIssue({ code: 'custom', message: companyEmailRefineMessage() });
  }
});
