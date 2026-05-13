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

  const reload = (p) => {
    setName(p.name ?? '');
    setHeight(p.height ?? '');
    setPhone(p.phone ?? '');
    setDietType(p.dietType ?? '');
    setBmr(p.bmr ?? '');
  };

  // Optionally re-prime when initial reference changes.
  useEffect(() => {
    if (initial.__prime) reload(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return '';
  };

  const payload = (email, extras = {}) => ({
    email,
    name: name || undefined,
    height: height ? parseFloat(height) : undefined,
    bmr: bmr && bmr.trim() !== '' ? parseFloat(bmr) : undefined,
    dietType: dietType || undefined,
    phoneNumber: phone.trim() || undefined,
    ...extras,
  });

  return {
    name, setName, height, setHeight, phone, setPhone,
    dietType, setDietType, bmr, setBmr,
    heightNum, heightValid, phoneValid, nameValid, dietValid,
    validate, payload, reload,
  };
}
