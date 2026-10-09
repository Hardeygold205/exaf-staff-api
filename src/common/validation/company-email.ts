/** Empty, "*", or "any" means any email domain is allowed (SaaS default). */
export function companyEmailDomain(): string {
  return (process.env.COMPANY_EMAIL_DOMAIN ?? "*").toLowerCase();
}

export function isCompanyEmail(email: string): boolean {
  const domain = companyEmailDomain();
  if (!domain || domain === "*" || domain === "any") return true;
  return email.toLowerCase().endsWith(`@${domain}`);
}

export function companyEmailRefineMessage(): string {
  const domain = companyEmailDomain();
  if (!domain || domain === "*" || domain === "any") return "Email must be valid";
  return `Email must use the @${domain} company domain`;
}
