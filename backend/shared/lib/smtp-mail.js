/**
 * Gmail SMTP helper for transactional mail (OTP / notices).
 * From address always matches SMTP_USER so Gmail does not treat the
 * message as spoofed (a common spam-folder cause).
 *
 * Default transport stays `service: 'gmail'` so local (already working) is unchanged.
 * If that send fails — common on MilesWeb when port 465 is blocked — retry
 * smtp.gmail.com:587 STARTTLS with the same credentials.
 * Optional SMTP_HOST / SMTP_PORT / SMTP_SECURE replace Gmail (cPanel mail).
 */
import nodemailer from 'nodemailer';
import logger from './logger.js';

const SMTP_TIMEOUTS = Object.freeze({
  connectionTimeout: 12000,
  greetingTimeout: 12000,
  socketTimeout: 15000,
});

export function smtpCredentials() {
  return {
    user: String(process.env.SMTP_USER || '').trim(),
    pass: String(process.env.SMTP_PASS || '').replace(/\s+/g, ''),
  };
}

export function smtpFromAddress() {
  const { user } = smtpCredentials();
  return user
    ? `"Wellness Valley" <${user}>`
    : '"Wellness Valley" <easy2work.india@gmail.com>';
}

/**
 * Ordered transports to try. First entry is the current local Gmail path
 * unless SMTP_HOST is set.
 * @returns {{ name: string, options: object }[]}
 */
export function listSmtpTransportAttempts() {
  const { user, pass } = smtpCredentials();
  const auth = { user, pass };
  const host = String(process.env.SMTP_HOST || '').trim();

  if (host) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
      || port === 465;
    return [{
      name: 'custom',
      options: { host, port, secure, auth, ...SMTP_TIMEOUTS },
    }];
  }

  return [
    {
      name: 'gmail-service',
      options: { service: 'gmail', auth, ...SMTP_TIMEOUTS },
    },
    {
      name: 'gmail-587',
      options: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth,
        ...SMTP_TIMEOUTS,
      },
    },
  ];
}

async function sendOnce(transporter, mail) {
  const info = await transporter.sendMail(mail);
  if (!info.accepted || info.accepted.length === 0) {
    throw new Error(`Email was not accepted by the mail server (${info.response || 'no response'})`);
  }
  return { accepted: info.accepted, response: info.response };
}

/**
 * Mail payload for nodemailer. Optional attachments are omitted when empty so
 * existing OTP callers stay byte-for-byte the same shape.
 * @param {{ to: string, subject: string, text: string, html?: string, attachments?: object[] }} input
 */
export function buildTransactionalMail({ to, subject, text, html, attachments } = {}) {
  const { user } = smtpCredentials();
  const mail = {
    from: smtpFromAddress(),
    replyTo: user || undefined,
    to,
    subject,
    text,
    html: html || undefined,
    encoding: 'utf-8',
    headers: {
      'Auto-Submitted': 'auto-generated',
    },
  };
  if (Array.isArray(attachments) && attachments.length > 0) {
    mail.attachments = attachments;
  }
  return mail;
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string, attachments?: object[] }} input
 * @returns {Promise<{ accepted: string[], response?: string }>}
 */
export async function sendTransactionalMail({ to, subject, text, html, attachments }) {
  const mail = buildTransactionalMail({ to, subject, text, html, attachments });

  const attempts = listSmtpTransportAttempts();
  let lastError = null;
  for (const attempt of attempts) {
    try {
      const transporter = nodemailer.createTransport(attempt.options);
      const result = await sendOnce(transporter, mail);
      if (attempt.name !== 'gmail-service') {
        logger.info('[smtp-mail] sent via fallback transport', { transport: attempt.name });
      }
      return result;
    } catch (err) {
      lastError = err;
      logger.warn('[smtp-mail] transport failed', {
        transport: attempt.name,
        message: err?.message,
      });
    }
  }
  throw lastError || new Error('Email was not sent');
}
