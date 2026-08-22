// Profile form state + validation.
// Owns name/height/phone/communityId/dietType/bmr/gender + body metrics (Fat % required).
import { useEffect, useState } from 'react';
import {
  VALID_GENDERS,
  hasValidBodyFatPercent,
  MIN_BODY_FAT_PCT,
  MAX_BODY_FAT_PCT,
} from '../domain/profileCompleteness';
import { normalizeCommunityId, validateCommunityId } from '../domain/communityId';

const cleanPhone = (s) => s.trim().replace(/[\s\-()]/g, '');

const EMPTY_BODY_METRICS = {
  age: '',
  fatPercent: '',
  visceralFat: '',
  bmi: '',
  bodyAge: '',
  chestCm: '',
  waistCm: '',
  hipCm: '',
};

function metricsFromProfile(p) {
  const m = p?.bodyMetrics || {};
  const fatFallback = p?.bodyFat ?? p?.latestWeightBodyFat;
  const fat = m.fatPercent != null && m.fatPercent !== ''
    ? m.fatPercent
    : fatFallback;
  return {
    age: m.age != null && m.age !== '' ? String(m.age) : '',
    fatPercent: fat != null && fat !== '' ? String(fat) : '',
    visceralFat: m.visceralFat != null && m.visceralFat !== '' ? String(m.visceralFat) : '',
    bmi: m.bmi != null && m.bmi !== '' ? String(m.bmi) : '',
    bodyAge: m.bodyAge != null && m.bodyAge !== '' ? String(m.bodyAge) : '',
    chestCm: m.chestCm != null && m.chestCm !== '' ? String(m.chestCm) : '',
    waistCm: m.waistCm != null && m.waistCm !== '' ? String(m.waistCm) : '',
    hipCm: m.hipCm != null && m.hipCm !== '' ? String(m.hipCm) : '',
  };
}

function parseOptionalNumber(raw, { integer = false } = {}) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const n = integer ? parseInt(String(raw), 10) : parseFloat(String(raw));
  return Number.isFinite(n) ? n : undefined;
}

export default function useProfileForm(initial = {}) {
  const [name, setName] = useState(initial.name || '');
  const [height, setHeight] = useState(initial.height || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [dietType, setDietType] = useState(initial.dietType || '');
  const [gender, setGender] = useState(initial.gender || '');
  const [bmr, setBmr] = useState(initial.bmr || '');
  const [physicalActivityLevel, setPhysicalActivityLevel] = useState(initial.physicalActivityLevel || '');
  const [weightGoalMode, setWeightGoalMode] = useState(initial.weightGoalMode || 'loss');
  const [email, setEmail] = useState(initial.email || '');
  const [communityId, setCommunityId] = useState(initial.communityId || '');
  const [bodyMetrics, setBodyMetrics] = useState(() => metricsFromProfile(initial));

  const setBodyMetricField = (key, value) => {
    if (key === 'bmi') return;
    setBodyMetrics((prev) => ({ ...prev, [key]: value }));
  };

  const reload = (p) => {
    setName(p.name ?? '');
    setHeight(p.height ?? '');
    setPhone(p.phone ?? '');
    setDietType(p.dietType ?? '');
    const resolvedGender = p.gender
      || (VALID_GENDERS.includes(String(p.bodyMetrics?.gender || '').trim())
        ? String(p.bodyMetrics.gender).trim()
        : '');
    setGender(resolvedGender || '');
    setBmr(p.bmr ?? '');
    setPhysicalActivityLevel(p.physicalActivityLevel ?? '');
    setWeightGoalMode(p.weightGoalMode ?? 'loss');
    setEmail(p.email ?? '');
    setCommunityId(p.communityId != null ? String(p.communityId) : '');
    setBodyMetrics(metricsFromProfile(p));
  };

  useEffect(() => {
    if (initial.__prime) reload(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [initial.__prime]);

  const heightNum = parseFloat(height);
  const heightValid =
    height !== '' && !Number.isNaN(heightNum) && heightNum >= 50 && heightNum <= 250;
  const phoneValid =
    phone.trim() !== '' && /^\+?[0-9]{10,15}$/.test(cleanPhone(phone));
  const nameValid = name.trim() !== '';
  const dietValid = !!dietType;
  const genderValid = VALID_GENDERS.includes(String(gender || '').trim());
  const fatPercentValid = hasValidBodyFatPercent(bodyMetrics.fatPercent);

  const validate = ({ requireDiet = true, maxHeight = 250 } = {}) => {
    if (!nameValid) return 'Name is required';
    if (!heightValid || heightNum > maxHeight) {
      return `Please enter a valid height (50 - ${maxHeight} cm).`;
    }
    if (!phoneValid) return 'Please enter a valid phone number (10-15 digits).';
    if (!genderValid) return 'Please select Male or Female.';
    if (requireDiet && !dietValid) return 'Please select a diet preference.';
    if (!fatPercentValid) {
      return `Please enter Fat % (${MIN_BODY_FAT_PCT}–${MAX_BODY_FAT_PCT}%).`;
    }
    const communityIdCheck = validateCommunityId(communityId);
    if (!communityIdCheck.valid) return communityIdCheck.message;
    return '';
  };

  const payload = (emailArg, extras = {}) => {
    const body = {
      email: emailArg,
      name: name || undefined,
      height: height ? parseFloat(height) : undefined,
      bmr: bmr && bmr.trim() !== '' ? parseFloat(bmr) : undefined,
      physicalActivityLevel: physicalActivityLevel || undefined,
      dietType: dietType || undefined,
      gender: genderValid ? gender : undefined,
      phoneNumber: phone.trim() || undefined,
      weightGoalMode: weightGoalMode || 'loss',
      communityId: normalizeCommunityId(communityId),
      age: parseOptionalNumber(bodyMetrics.age, { integer: true }),
      visceralFat: parseOptionalNumber(bodyMetrics.visceralFat),
      bodyAge: parseOptionalNumber(bodyMetrics.bodyAge),
      chestCm: parseOptionalNumber(bodyMetrics.chestCm),
      waistCm: parseOptionalNumber(bodyMetrics.waistCm),
      hipCm: parseOptionalNumber(bodyMetrics.hipCm),
      ...extras,
    };

    if (fatPercentValid) {
      body.bodyFat = parseFloat(bodyMetrics.fatPercent);
    }

    return body;
  };

  return {
    name, setName, height, setHeight, phone, setPhone,
    dietType, setDietType, gender, setGender, bmr, setBmr,
    physicalActivityLevel, setPhysicalActivityLevel,
    weightGoalMode, setWeightGoalMode,
    email, setEmail,
    communityId, setCommunityId,
    bodyMetrics,
    setBodyMetricField,
    heightNum, heightValid, phoneValid, nameValid, dietValid, genderValid, fatPercentValid,
    validate, payload, reload,
  };
}

export { EMPTY_BODY_METRICS };
