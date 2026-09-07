/**
 * Gmail SMTP helper for transactional mail (OTP / notices).
 * From address always matches SMTP_USER so Gmail does not treat the
 * message as spoofed (a common spam-folder cause).
 */
import nodemailer from 'nodemailer';

export function smtpFromAddress() {
  const user = String(process.env.SMTP_USER || '').trim();
  return user
    ? `"Wellness Valley" <${user}>`
    : '"Wellness Valley" <easy2work.india@gmail.com>';
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} input
 * @returns {Promise<{ accepted: string[], response?: string }>}
 */
export async function sendTransactionalMail({ to, subject, text, html }) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
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
  });

  if (!info.accepted || info.accepted.length === 0) {
    throw new Error(`Email was not accepted by the mail server (${info.response || 'no response'})`);
  }
  return { accepted: info.accepted, response: info.response };
}
