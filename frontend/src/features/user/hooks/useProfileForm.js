// Profile form state + validation.
// Owns name/height/phone/dietType/bmr/gender/bodyFat; derives validity flags and a `payload`
// helper. Caller passes initial values from the loaded profile.
import { useEffect, useState } from 'react';
import {
  VALID_GENDERS,
  hasValidBodyFatPercent,
  MIN_BODY_FAT_PCT,
  MAX_BODY_FAT_PCT,
} from '../domain/profileCompleteness';

const cleanPhone = (s) => s.trim().replace(/[\s\-()]/g, '');

export default function useProfileForm(initial = {}) {
  const [name, setName] = useState(initial.name || '');
  const [height, setHeight] = useState(initial.height || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [dietType, setDietType] = useState(initial.dietType || '');
  const [gender, setGender] = useState(initial.gender || '');
  const [bmr, setBmr] = useState(initial.bmr || '');
  const [physicalActivityLevel, setPhysicalActivityLevel] = useState(initial.physicalActivityLevel || '');
  const [weightGoalMode, setWeightGoalMode] = useState(initial.weightGoalMode || 'loss');
  const [bodyFat, setBodyFat] = useState(initial.bodyFat || '');
  const [needsBodyFat, setNeedsBodyFat] = useState(Boolean(initial.needsBodyFat));
  const [email, setEmail] = useState(initial.email || '');
  const [bodyMetrics, setBodyMetrics] = useState(null);

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
    setBodyFat(p.bodyFat != null && p.bodyFat !== '' ? String(p.bodyFat) : '');
    setNeedsBodyFat(Boolean(p.needsBodyFat));
    setEmail(p.email ?? '');
    setBodyMetrics(p.bodyMetrics ?? null);
  };

  // Optionally re-prime when initial reference changes.
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
  const bodyFatValid = !needsBodyFat || hasValidBodyFatPercent(bodyFat);

  const validate = ({ requireDiet = true, maxHeight = 250 } = {}) => {
    if (!nameValid) return 'Name is required';
    if (!heightValid || heightNum > maxHeight) {
      return `Please enter a valid height (50 - ${maxHeight} cm).`;
    }
    if (!phoneValid) return 'Please enter a valid phone number (10-15 digits).';
    if (!genderValid) return 'Please select Male or Female.';
    if (requireDiet && !dietValid) return 'Please select a diet preference.';
    if (needsBodyFat && !hasValidBodyFatPercent(bodyFat)) {
      return `Please enter body fat (${MIN_BODY_FAT_PCT}–${MAX_BODY_FAT_PCT}%).`;
    }
    return '';
  };

  const payload = (email, extras = {}) => {
    const body = {
      email,
      name: name || undefined,
      height: height ? parseFloat(height) : undefined,
      bmr: bmr && bmr.trim() !== '' ? parseFloat(bmr) : undefined,
      physicalActivityLevel: physicalActivityLevel || undefined,
      dietType: dietType || undefined,
      gender: genderValid ? gender : undefined,
      phoneNumber: phone.trim() || undefined,
      weightGoalMode: weightGoalMode || 'loss',
      ...extras,
    };

    if (needsBodyFat && hasValidBodyFatPercent(bodyFat)) {
      body.bodyFat = parseFloat(bodyFat);
    }

    return body;
  };

  return {
    name, setName, height, setHeight, phone, setPhone,
    dietType, setDietType, gender, setGender, bmr, setBmr,
    physicalActivityLevel, setPhysicalActivityLevel,
    weightGoalMode, setWeightGoalMode,
    bodyFat, setBodyFat,
    needsBodyFat,
    email, setEmail,
    bodyMetrics,
    heightNum, heightValid, phoneValid, nameValid, dietValid, genderValid, bodyFatValid,
    validate, payload, reload,
  };
}
