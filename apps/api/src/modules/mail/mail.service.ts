import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EnvConfig } from '../../config/env.schema';
import { MailContent } from './mail-templates';

export interface SentMail extends MailContent {
  to: string;
}

/**
 * Sends email over SMTP when SMTP_HOST is set. Without it the message is only
 * logged (dev) — and kept in `outbox` under NODE_ENV=test so tests can read the
 * link that would have been emailed. Sending never throws into a request: a
 * mail outage must not break registration or password reset.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  /** Populated only when NODE_ENV is "test" and SMTP is not configured. */
  readonly outbox: SentMail[] = [];

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    const host = this.config.get('SMTP_HOST', { infer: true });
    if (host) {
      const user = this.config.get('SMTP_USER', { infer: true });
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT', { infer: true })),
        secure:
          String(this.config.get('SMTP_SECURE', { infer: true })) === 'true',
        auth: user
          ? { user, pass: this.config.get('SMTP_PASS', { infer: true }) }
          : undefined,
      });
    }
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  /** Links inside emails point at the web app. */
  webUrl(path: string): string {
    const base = String(
      this.config.get('WEB_PUBLIC_URL', { infer: true }),
    ).replace(/\/+$/, '');
    return `${base}${path}`;
  }

  async send(to: string, content: MailContent): Promise<boolean> {
    if (!this.transporter) {
      if (this.config.get('NODE_ENV', { infer: true }) === 'test') {
        this.outbox.push({ to, ...content });
      } else {
        this.logger.warn(
          `SMTP not configured — email to ${to} not sent. Subject: "${content.subject}"\n${content.text}`,
        );
      }
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM', { infer: true }),
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
