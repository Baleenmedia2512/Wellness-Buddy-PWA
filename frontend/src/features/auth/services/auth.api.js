import { getApiBaseUrl } from '../../../config/api.config.js';
import { getDeviceTimezoneIana } from '../../../shared/utils/deviceTimezone.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';
import { handlePossibleAppUpdateRequired } from '../../../shared/services/appVersionEnforce.client.js';

const base = () => getApiBaseUrl();

export async function sendOtp({ recipient, contactType }) {
  const res = await apiFetch(`${base()}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, contactType }),
  });
  const data = await res.json().catch(() => ({}));
  handlePossibleAppUpdateRequired(res, data);
  return data;
}

export async function verifyOtp({ recipient, otp, contactType, purpose }) {
  const res = await apiFetch(`${base()}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient,
      otp,
      contactType,
      purpose,
      timezoneIana: getDeviceTimezoneIana() ?? '',
    }),
  });
  const data = await res.json().catch(() => ({}));
  handlePossibleAppUpdateRequired(res, data);
  return data;
}
