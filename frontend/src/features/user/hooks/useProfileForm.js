// Profile form state + validation.
// Owns name/height/phone/dietType/bmr; derives validity flags and a `payload`
// helper. Caller passes initial values from the loaded profile.
import { useEffect, useState } from 'react';

const cleanPhone = (s) => s.trim().replace(/[\s\-()]/g, '');

export default function useProfileForm(initial = {}) {
  const [name, setName] = useState(initial.name || '');
  const [height, setHeight] = useState(initial.height || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [dietType, setDietType] = useState(initial.dietType || '');
  const [bmr, setBmr] = useState(initial.bmr || '');
  const [physicalActivityLevel, setPhysicalActivityLevel] = useState(initial.physicalActivityLevel || '');
  const [weightGoalMode, setWeightGoalMode] = useState(initial.weightGoalMode || 'loss');
  const [communityId, setCommunityId] = useState(initial.communityId || '');
  const [email, setEmail] = useState(initial.email || '');
  const [bodyMetrics, setBodyMetrics] = useState(null);

  const reload = (p) => {
    setName(p.name ?? '');
    setHeight(p.height ?? '');
    setPhone(p.phone ?? '');
    setDietType(p.dietType ?? '');
    setBmr(p.bmr ?? '');
    setPhysicalActivityLevel(p.physicalActivityLevel ?? '');
    setWeightGoalMode(p.weightGoalMode ?? 'loss');
    setCommunityId(p.communityId ?? '');
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

  const validate = ({ requireDiet = true, maxHeight = 250 } = {}) => {
    if (!nameValid) return 'Name is required';
    if (!heightValid || heightNum > maxHeight) {
      return `Please enter a valid height (50 - ${maxHeight} cm).`;
    }
    if (!phoneValid) return 'Please enter a valid phone number (10-15 digits).';
    if (requireDiet && !dietValid) return 'Please select a diet preference.';
    const trimmedCommunityId = communityId.trim();
    if (trimmedCommunityId) {
      if (trimmedCommunityId.length > 100) return 'Community ID must be at most 100 characters.';
      if (!/^[a-zA-Z0-9]+$/.test(trimmedCommunityId)) {
        return 'Community ID may only contain letters and numbers.';
      }
    }
    return '';
  };

  const payload = (email, extras = {}) => ({
    email,
    name: name || undefined,
    height: height ? parseFloat(height) : undefined,
    bmr: bmr && bmr.trim() !== '' ? parseFloat(bmr) : undefined,
    physicalActivityLevel: physicalActivityLevel || undefined,
    dietType: dietType || undefined,
    phoneNumber: phone.trim() || undefined,
    weightGoalMode: weightGoalMode || 'loss',
    communityId: communityId.trim() === '' ? null : communityId.trim(),
    ...extras,
  });

  return {
    name, setName, height, setHeight, phone, setPhone,
    dietType, setDietType, bmr, setBmr,
    physicalActivityLevel, setPhysicalActivityLevel,
    weightGoalMode, setWeightGoalMode,
    communityId, setCommunityId,
    email, setEmail,
    bodyMetrics,
    heightNum, heightValid, phoneValid, nameValid, dietValid,
    validate, payload, reload,
  };
}
