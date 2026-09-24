import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

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

  /**
   * `from` is always the service account (SMTP_FROM) — never set it to a staff
   * member's real address without domain-level send-as delegation configured
   * with your mail provider, or receiving servers will treat it as spoofing.
   * Use `replyTo` instead when a reply should reach a specific person: the
   * message still sends cleanly, but hitting "Reply" goes straight to them.
   * Use `bcc` for broadcasts (e.g. company-wide event emails) so recipients
   * don't see each other's addresses — never put a whole staff list in `to`.
   */
  async send(options: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    subject: string;
    html: string;
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

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: to.length ? to.join(", ") : undefined,
        cc: options.cc?.filter(Boolean).join(", ") || undefined,
        bcc: bcc?.length ? bcc.join(", ") : undefined,
        replyTo: options.replyTo,
        subject: options.subject,
        html: options.html,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send "${options.subject}": ${(err as Error).message}`,
      );
    }
  }
}
