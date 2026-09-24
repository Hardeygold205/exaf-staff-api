/** Reads env at parse-time (after ConfigModule loads dotenv), not at import-time. */
export function companyEmailDomain(): string {
  return (process.env.COMPANY_EMAIL_DOMAIN ?? 'extensionafrica.com').toLowerCase();
}

export function isCompanyEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${companyEmailDomain()}`);
}

export function companyEmailRefineMessage(): string {
  return `Email must use the @${companyEmailDomain()} company domain`;
}
