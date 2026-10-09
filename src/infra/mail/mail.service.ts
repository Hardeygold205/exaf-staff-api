import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { escapeHtml } from "../../common/escape-html.util";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private from: string;

  constructor(private config: ConfigService) {
    this.from = this.config.get("SMTP_FROM", "");
    const host = this.config.get<string>("SMTP_HOST");
    if (!host) {
      this.logger.warn(
        "SMTP_HOST not set — request notification emails will be skipped",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get("SMTP_PORT", 587)),
      secure: Number(this.config.get("SMTP_PORT", 587)) === 465,
      auth: this.config.get("SMTP_USER")
        ? {
            user: this.config.get<string>("SMTP_USER"),
            pass: this.config.get<string>("SMTP_PASS"),
          }
        : undefined,
    });
  }

  async send(options: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    subject: string;
    html: string;
    organizationName?: string;
  }) {
    if (!this.transporter) {
      this.logger.log(
        `Skip email "${options.subject}" to ${options.to.join(", ")} (SMTP not configured)`,
      );
      return;
    }

    const to = options.to.filter(Boolean);
    const bcc = options.bcc?.filter(Boolean);
    if (!to.length && !bcc?.length) return;

    const organizationName = options.organizationName?.trim();
    const subject =
      organizationName && !options.subject.includes(organizationName)
        ? `[${organizationName}] ${options.subject}`
        : options.subject;
    const html = organizationName
      ? this.wrapForOrganization(organizationName, options.html)
      : options.html;

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: to.length ? to.join(", ") : undefined,
        cc: options.cc?.filter(Boolean).join(", ") || undefined,
        bcc: bcc?.length ? bcc.join(", ") : undefined,
        replyTo: options.replyTo,
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send "${options.subject}": ${(err as Error).message}`,
      );
    }
  }

  private wrapForOrganization(organizationName: string, bodyHtml: string) {
    const name = escapeHtml(organizationName);
    return `
      <div style="font-family:Arial,sans-serif;color:#111827;max-width:560px">
        <p style="margin:0 0 16px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#164A30">${name}</p>
        ${bodyHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="font-size:12px;color:#6b7280;margin:0">
          Sent for ${name} by the workplace platform. Replies, if any, go to the address on this message — the sender address is the platform mailbox.
        </p>
      </div>
    `;
  }
}
