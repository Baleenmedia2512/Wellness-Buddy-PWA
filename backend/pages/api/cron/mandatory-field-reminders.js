/**
 * Server reminder pass for mandatory profile campaigns.
 * Day 2, 4, 6, and 8. Does not run from a member opening the app.
 * Requires CRON_SECRET, same as the other cron routes.
 * GET and POST only. A second overlapping run cannot resend a claimed slot.
 */
import { rejectIfMandatoryProfileBlocks } from '../../../features/mandatory-fields/api/enforce.handler.js';
import { runDueMandatoryReminders } from '../../../features/mandatory-fields/campaignReminders.service.js';
import { authorizeMandatoryCron } from '../../../features/mandatory-fields/domain/access.rules.js';
import { sendTransactionalMail } from '../../../shared/lib/smtp-mail.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (await rejectIfMandatoryProfileBlocks(req, res)) return;
  const auth = authorizeMandatoryCron({
    method: req.method,
    authorization: req.headers.authorization,
    secret: process.env.CRON_SECRET,
  });
  if (!auth.ok) {
    if (auth.status === 500) {
      logger.error('[mandatory-fields] CRON_SECRET not configured');
    }
    if (auth.status === 401) {
      logger.warn('[mandatory-fields] unauthorized reminder cron');
    }
    const message = auth.status === 405
      ? 'Method not allowed'
      : auth.status === 401
        ? 'Unauthorized'
        : 'Cron secret not configured';
    if (auth.status === 405) res.setHeader('Allow', 'GET, POST');
    return res.status(auth.status).json({ success: false, code: auth.code, message });
  }
  try {
    const result = await runDueMandatoryReminders({
      now: new Date(),
      send: sendTransactionalMail,
    });
    if (result.skipped === 'campaign-columns-missing') {
      logger.error('[mandatory-fields] reminder pass blocked, campaign columns missing');
      return res.status(503).json({
        success: false,
        code: 'MANDATORY_SCHEMA_INCOMPLETE',
        sent: 0,
        failed: 0,
        skippedNoEmail: 0,
        skipped: result.skipped,
      });
    }
    logger.info('[mandatory-fields] reminder pass finished', {
      sent: result.sent,
      failed: result.failed,
      skippedNoEmail: result.skippedNoEmail,
      skipped: result.skipped || null,
    });
    return res.status(200).json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      skippedNoEmail: result.skippedNoEmail,
      skipped: result.skipped || null,
    });
  } catch (err) {
    logger.error('[mandatory-fields] reminder pass failed', {
      message: err?.message || String(err),
    });
    return res.status(500).json({
      success: false,
      code: 'REMINDER_FAILED',
      message: 'Reminder pass failed',
    });
  }
}
