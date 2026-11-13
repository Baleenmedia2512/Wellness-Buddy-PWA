// Profile form state + validation.
// Owns name/height/phone/communityId/dietType/bmr/gender + body metrics (Fat % required).
import { useEffect, useRef, useState } from 'react';
import {
  VALID_GENDERS,
  hasValidBodyFatPercent,
  MIN_BODY_FAT_PCT,
  MAX_BODY_FAT_PCT,
} from '../domain/profileCompleteness';
import { normalizeCommunityId, validateCommunityId, COMMUNITY_ID_OTP_FLAG } from '../domain/communityId';
import { COMMUNITY_POSITION_OTP_FLAG } from '../domain/communityPosition';
import { HEIGHT_CHANGE_OTP_FLAG, isHeightLocked } from '../domain/heightChange';
import { isFlagEnabled } from '../../../config/featureFlags';
import { introPayload, validateProfileIntro } from '../domain/profileIntro';

const cleanPhone = (s) => s.trim().replace(/[\s\-()]/g, '');

const EMPTY_BODY_METRICS = {
  age: '',
  fatPercent: '',
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

function formSnapshot(values) {
  const metrics = values.bodyMetrics || {};
  return JSON.stringify({
    name: values.name ?? '',
    height: values.height ?? '',
    phone: values.phone ?? '',
    dietType: values.dietType ?? '',
    gender: values.gender ?? '',
    bmr: values.bmr ?? '',
    physicalActivityLevel: values.physicalActivityLevel ?? '',
    email: values.email ?? '',
    communityId: values.communityId ?? '',
    workingPhysicalCentreId: values.workingPhysicalCentreId ?? '',
    eventTranslation: values.eventTranslation ?? '',
    eventYourCity: values.eventYourCity ?? '',
    eventLevel: values.eventLevel ?? '',
    professionalTitle: values.professionalTitle ?? '',
    instagram: values.instagram ?? '',
    youtube: values.youtube ?? '',
    linkedin: values.linkedin ?? '',
    herbalifeJoinedOn: values.herbalifeJoinedOn ?? '',
    aboutMe: values.aboutMe ?? '',
    qualification: values.qualification ?? '',
    languages: values.languages ?? [],
    age: metrics.age ?? '',
    fatPercent: metrics.fatPercent ?? '',
    bodyAge: metrics.bodyAge ?? '',
    chestCm: metrics.chestCm ?? '',
    waistCm: metrics.waistCm ?? '',
    hipCm: metrics.hipCm ?? '',
    recoveredHealthIssues: values.recoveredHealthIssues ?? [],
  });
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
  const [workingPhysicalCentreId, setWorkingPhysicalCentreId] = useState(initial.workingPhysicalCentreId || '');
  const [eventTranslation, setEventTranslation] = useState(initial.eventTranslation || '');
  const [eventYourCity, setEventYourCity] = useState(initial.eventYourCity || '');
  const [eventLevel, setEventLevel] = useState(initial.eventLevel || '');
  const [professionalTitle, setProfessionalTitle] = useState(initial.professionalTitle || '');
  const [instagram, setInstagram] = useState(initial.instagram || '');
  const [youtube, setYoutube] = useState(initial.youtube || '');
  const [linkedin, setLinkedin] = useState(initial.linkedin || '');
  const [herbalifeJoinedOn, setHerbalifeJoinedOn] = useState(initial.herbalifeJoinedOn || '');
  const [aboutMe, setAboutMe] = useState(initial.aboutMe || '');
  const [qualification, setQualification] = useState(initial.qualification || '');
  const [languages, setLanguages] = useState(() => (
    Array.isArray(initial.languages) ? initial.languages : []
  ));
  const [bodyMetrics, setBodyMetrics] = useState(() => metricsFromProfile(initial));
  const [recoveredHealthIssues, setRecoveredHealthIssues] = useState(() => (
    Array.isArray(initial.recoveredHealthIssues) ? initial.recoveredHealthIssues : []
  ));
  const savedSnapshotRef = useRef('');

  const setIntroField = (key, value) => {
    if (key === 'professionalTitle') setProfessionalTitle(value);
    if (key === 'instagram') setInstagram(value);
    if (key === 'youtube') setYoutube(value);
    if (key === 'linkedin') setLinkedin(value);
    if (key === 'herbalifeJoinedOn') setHerbalifeJoinedOn(value);
    if (key === 'aboutMe') setAboutMe(value);
    if (key === 'qualification') setQualification(value);
    if (key === 'languages') setLanguages(Array.isArray(value) ? value : []);
  };

  const introValues = () => ({
    professionalTitle,
    instagram,
    youtube,
    linkedin,
    herbalifeJoinedOn,
    aboutMe,
    qualification,
    languages,
  });

  const setBodyMetricField = (key, value) => {
    if (key === 'bmi') return;
    setBodyMetrics((prev) => ({ ...prev, [key]: value }));
  };

  const reload = (p) => {
    const nextName = p.name ?? '';
    const nextHeight = p.height ?? '';
    const nextPhone = p.phone ?? '';
    const nextDietType = p.dietType ?? '';
    const resolvedGender = p.gender
      || (VALID_GENDERS.includes(String(p.bodyMetrics?.gender || '').trim())
        ? String(p.bodyMetrics.gender).trim()
        : '');
    const nextBmr = p.bmr ?? '';
    const nextActivity = p.physicalActivityLevel ?? '';
    const nextEmail = p.email ?? '';
    const nextCommunityId = p.communityId != null ? String(p.communityId) : '';
    const nextCentre = p.workingPhysicalCentreId != null ? String(p.workingPhysicalCentreId) : '';
    const nextTranslation = p.eventTranslation ? String(p.eventTranslation) : '';
    const nextCity = p.eventYourCity ? String(p.eventYourCity) : '';
    const nextLevel = p.eventLevel ? String(p.eventLevel) : '';
    const nextTitle = p.professionalTitle ? String(p.professionalTitle) : '';
    const nextInstagram = p.instagram ? String(p.instagram) : '';
    const nextYoutube = p.youtube ? String(p.youtube) : '';
    const nextLinkedin = p.linkedin ? String(p.linkedin) : '';
    const nextJoined = p.herbalifeJoinedOn ? String(p.herbalifeJoinedOn) : '';
    const nextAbout = p.aboutMe ? String(p.aboutMe) : '';
    const nextQualification = p.qualification ? String(p.qualification) : '';
    const nextLanguages = Array.isArray(p.languages) ? p.languages : [];
    const nextMetrics = metricsFromProfile(p);
    const nextIssues = Array.isArray(p.recoveredHealthIssues) ? p.recoveredHealthIssues : [];
    setName(nextName);
    setHeight(nextHeight);
    setPhone(nextPhone);
    setDietType(nextDietType);
    setGender(resolvedGender || '');
    setBmr(nextBmr);
    setPhysicalActivityLevel(nextActivity);
    setWeightGoalMode(p.weightGoalMode ?? 'loss');
    setEmail(nextEmail);
    setCommunityId(nextCommunityId);
    setWorkingPhysicalCentreId(nextCentre);
    setEventTranslation(nextTranslation);
    setEventYourCity(nextCity);
    setEventLevel(nextLevel);
    setProfessionalTitle(nextTitle);
    setInstagram(nextInstagram);
    setYoutube(nextYoutube);
    setLinkedin(nextLinkedin);
    setHerbalifeJoinedOn(nextJoined);
    setAboutMe(nextAbout);
    setQualification(nextQualification);
    setLanguages(nextLanguages);
    setBodyMetrics(nextMetrics);
    setRecoveredHealthIssues(nextIssues);
    savedSnapshotRef.current = formSnapshot({
      name: nextName,
      height: nextHeight,
      phone: nextPhone,
      dietType: nextDietType,
      gender: resolvedGender || '',
      bmr: nextBmr,
      physicalActivityLevel: nextActivity,
      email: nextEmail,
      communityId: nextCommunityId,
      workingPhysicalCentreId: nextCentre,
      eventTranslation: nextTranslation,
      eventYourCity: nextCity,
      eventLevel: nextLevel,
      professionalTitle: nextTitle,
      instagram: nextInstagram,
      youtube: nextYoutube,
      linkedin: nextLinkedin,
      herbalifeJoinedOn: nextJoined,
      aboutMe: nextAbout,
      qualification: nextQualification,
      languages: nextLanguages,
      bodyMetrics: nextMetrics,
      recoveredHealthIssues: nextIssues,
    });
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

  const validate = ({ requireDiet = true, maxHeight = 250, requireFat = true } = {}) => {
    if (!nameValid) return 'Name is required';
    if (!heightValid || heightNum > maxHeight) {
      return `Please enter a valid height (50 - ${maxHeight} cm).`;
    }
    if (!phoneValid) return 'Please enter a valid phone number (10-15 digits).';
    if (!genderValid) return 'Please select Male or Female.';
    if (requireDiet && !dietValid) return 'Please select a diet preference.';
    if (requireFat && !fatPercentValid) {
      return `Please enter Fat % (${MIN_BODY_FAT_PCT}–${MAX_BODY_FAT_PCT}%).`;
    }
    const skipCommunityIdOnSave = isFlagEnabled(COMMUNITY_ID_OTP_FLAG);
    if (!skipCommunityIdOnSave) {
      const communityIdCheck = validateCommunityId(communityId);
      if (!communityIdCheck.valid) return communityIdCheck.message;
    }
    const introMessage = validateProfileIntro(introValues());
    if (introMessage) return introMessage;
    return '';
  };

  const payload = (emailArg, extras = {}) => {
    const skipHeightOnSave = isFlagEnabled(HEIGHT_CHANGE_OTP_FLAG)
      && isHeightLocked(extras.lockedHeight);
    const body = {
      email: emailArg,
      name: name || undefined,
      bmr: bmr && bmr.trim() !== '' ? parseFloat(bmr) : undefined,
      physicalActivityLevel: physicalActivityLevel || undefined,
      dietType: dietType || undefined,
      gender: genderValid ? gender : undefined,
      phoneNumber: phone.trim() || undefined,
      weightGoalMode: weightGoalMode || 'loss',
      age: parseOptionalNumber(bodyMetrics.age, { integer: true }),
      bodyAge: parseOptionalNumber(bodyMetrics.bodyAge),
      chestCm: parseOptionalNumber(bodyMetrics.chestCm),
      waistCm: parseOptionalNumber(bodyMetrics.waistCm),
      hipCm: parseOptionalNumber(bodyMetrics.hipCm),
      recoveredHealthIssues: Array.isArray(recoveredHealthIssues) ? recoveredHealthIssues : [],
      ...extras,
    };
    delete body.lockedHeight;

    if (!skipHeightOnSave) {
      body.height = height ? parseFloat(height) : undefined;
    }

    if (!isFlagEnabled(COMMUNITY_ID_OTP_FLAG)) {
      body.communityId = normalizeCommunityId(communityId);
    }

    // Always send so Save can persist a selection and clear with None.
    // Old backends that ignore unknown fields stay safe; new backends only update when key is present.
    body.workingPhysicalCentreId = workingPhysicalCentreId && String(workingPhysicalCentreId).trim() !== ''
      ? String(workingPhysicalCentreId).trim()
      : null;

    // Always send so Save persists / clears. Old backends ignore unknown keys.
    body.eventTranslation = eventTranslation && String(eventTranslation).trim() !== ''
      ? String(eventTranslation).trim()
      : null;
    body.eventYourCity = eventYourCity && String(eventYourCity).trim() !== ''
      ? String(eventYourCity).trim()
      : null;
    if (!isFlagEnabled(COMMUNITY_POSITION_OTP_FLAG)) {
      body.eventLevel = eventLevel && String(eventLevel).trim() !== ''
        ? String(eventLevel).trim()
        : null;
    }
    Object.assign(body, introPayload(introValues()));

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
    workingPhysicalCentreId, setWorkingPhysicalCentreId,
    eventTranslation, setEventTranslation,
    eventYourCity, setEventYourCity,
    eventLevel, setEventLevel,
    professionalTitle,
    instagram,
    youtube,
    linkedin,
    herbalifeJoinedOn,
    aboutMe,
    qualification,
    languages,
    setIntroField,
    bodyMetrics,
    setBodyMetricField,
    recoveredHealthIssues,
    setRecoveredHealthIssues,
    heightNum, heightValid, phoneValid, nameValid, dietValid, genderValid, fatPercentValid,
    isDirty: savedSnapshotRef.current !== '' && formSnapshot({
      name,
      height,
      phone,
      dietType,
      gender,
      bmr,
      physicalActivityLevel,
      email,
      communityId,
      workingPhysicalCentreId,
      eventTranslation,
      eventYourCity,
      eventLevel,
      professionalTitle,
      instagram,
      youtube,
      linkedin,
      herbalifeJoinedOn,
      aboutMe,
      qualification,
      languages,
      bodyMetrics,
      recoveredHealthIssues,
    }) !== savedSnapshotRef.current,
    validate, payload, reload,
  };
}

export { EMPTY_BODY_METRICS };
