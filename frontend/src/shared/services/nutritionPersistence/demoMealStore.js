// Demo accounts skip the DB write — meals are persisted to localStorage instead.
import { transformToBackgroundServiceFormat } from './transformAnalysisFormat';
import * as Session from '../sessionStorage';

const DEMO_EMAILS = ['testereasywork@gmail.com'];
const DEMO_MAX = 20;

export const isDemoUser = (userId, userEmail) =>
  userId === 'DEMO_USER' ||
  (userEmail && DEMO_EMAILS.includes(userEmail.toLowerCase().trim()));

export function saveDemoMeal({ imageBase64, analysisResult, captureTimestamp }) {
  const demoId = 'demo-' + Date.now();
  const now = captureTimestamp || new Date().toISOString();
  const transformed = transformToBackgroundServiceFormat(analysisResult);
  const meal = {
    id: demoId,
    MealId: demoId,
    ImagePath: imageBase64 ? imageBase64.slice(0, 200) : null, // truncated for storage
    AnalysisData: JSON.stringify(transformed),
    EntryDateTime: now,
    dateKey: now.slice(0, 10),
  };
  try {
    const stored = JSON.parse(Session.getDemoMealsRaw() || '[]');
    stored.push(meal);
    if (stored.length > DEMO_MAX) stored.splice(0, stored.length - DEMO_MAX);
    Session.setDemoMealsRaw(JSON.stringify(stored));
  } catch { /* ignore quota / parse errors */ }
  return { success: true, id: demoId, insertId: null };
}
