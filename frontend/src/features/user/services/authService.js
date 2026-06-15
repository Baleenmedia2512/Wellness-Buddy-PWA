// Auth REST helpers — OTP send/verify, account deletion.
import * as Session from '../../../shared/services/sessionStorage';
import { debugLog } from '../../../shared/utils/logger.js';

const API = process.env.REACT_APP_API_BASE_URL;

const post = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const hasOtpField = Object.prototype.hasOwnProperty.call(data || {}, 'otp');
  const logPayload = {
    apiBase: API,
    path,
    httpStatus: res.status,
    success: data?.success,
    hasOtpInResponse: hasOtpField,
    message: data?.message || '',
    providerError: data?.providerError || '',
    senderIdHint: data?.senderIdHint || '',
    templateIdHint: data?.templateIdHint || '',
    apiKeyHint: data?.apiKeyHint || '',
    missingConfig: data?.missingConfig || [],
    contactType: body?.contactType,
  };
  debugLog('[OTP/SMS] send-otp response', logPayload);
  if (!data?.success || hasOtpField) {
    // eslint-disable-next-line no-console -- intentional debug for SMS troubleshooting
    console.warn('[OTP/SMS] send-otp issue — check backend/MDT', logPayload);
  }
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fdd5ae'},body:JSON.stringify({sessionId:'fdd5ae',hypothesisId:'H2',location:'authService.js:post',message:'send-otp response',data:{apiBase:API,path,httpStatus:res.status,success:data?.success,hasOtpField,contactType:body?.contactType,providerError:data?.providerError||'',senderIdHint:data?.senderIdHint||'',templateIdHint:data?.templateIdHint||'',apiKeyHint:data?.apiKeyHint||'',missingConfig:data?.missingConfig||[]},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { ...data, _httpStatus: res.status };
};

export const sendOtp = (recipient, contactType = 'email') =>
  post('/api/auth/send-otp', { recipient, contactType });

export const verifyOtp = (recipient, otp, purpose, contactType = 'email') => {
  const body = { recipient, otp, contactType };
  if (purpose) body.purpose = purpose;
  return post('/api/auth/verify-otp', body);
};

export const deleteAccountRequest = async (email) => {
  const res = await fetch(`${API}/api/user/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
};

// Wipe all client-side state after a successful account deletion.
// Sets userSignedOut+accountDeleted flags BEFORE Firebase signOut so that
// onAuthStateChanged cannot silently re-authenticate during the gap.
export const purgeLocalAfterDelete = () => {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    Session.markUserSignedOut();
    Session.markAccountDeleted();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    }
  } catch (err) {
    console.warn('[authService] purgeLocalAfterDelete error:', err);
  }
};
