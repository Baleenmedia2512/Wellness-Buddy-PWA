import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateActivityReport } from '../../../features/activity/activity-report.validators.js';
import { getActivitySummary, getActivityDetails, getActivityMemberSummary } from '../../../features/activity/activity-report.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  return runService(res, () => {
    const params = validateActivityReport(req.query);
    
    if (params.activityType === 'summary') {
      return getActivitySummary(params);
    }

    if (params.activityType === 'member-summary') {
      return getActivityMemberSummary(params);
    }
    
    return getActivityDetails(params);
  });
}
