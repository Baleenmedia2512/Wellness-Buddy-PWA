import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Users,
} from 'lucide-react';
import { getUserId } from '../../../shared/services/getUserId.js';
import { fetchProfile } from '../../user/services/profileService.js';
import { pickEventProfilePrefs } from '../../user/domain/eventProfilePrefs.js';
import { getCachedProfile } from '../../user/services/user.api.js';
import { fetchWallet } from '../../wallet/services/walletApi.js';
import { WalletButton } from '../../wallet/index.js';
import {
  createEventRegistration,
  EVENTS_UPDATED_EVENT,
  formatEventPlacesSummary,
  formatEventTimeRange,
  getEventDatesList,
  listOpenEvents,
  notifyEventsUpdated,
} from '../services/events.api.js';
import MemberSearchPicker from './MemberSearchPicker.jsx';
import MyBookingsPanel from './MyBookingsPanel.jsx';
import RegistrationQrCard from './RegistrationQrCard.jsx';
import RegistrationSelect from './RegistrationSelect.jsx';

const CARD_STYLES = [
  {
    card: 'border-teal-300 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700',
    badge: 'bg-white/20 text-white',
    button: 'bg-white text-teal-800 hover:bg-teal-50 focus-visible:ring-white',
  },
  {
    card: 'border-amber-300 bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500',
    badge: 'bg-white/20 text-white',
    button: 'bg-white text-orange-800 hover:bg-orange-50 focus-visible:ring-white',
  },
  {
    card: 'border-violet-300 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600',
    badge: 'bg-white/20 text-white',
    button: 'bg-white text-violet-800 hover:bg-violet-50 focus-visible:ring-white',
  },
];

const STATUS_STYLES = {
  scheduled: 'bg-white/20 text-white',
  postponed: 'bg-amber-100 text-amber-900',
  cancelled: 'bg-rose-100 text-rose-900',
};

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

/** Hanging SOLD / OUT sign — matches the red-white board look. */
function SoldOutSign({ className = '' }) {
  return (
    <div
      className={`pointer-events-none flex w-[4.5rem] flex-col items-center ${className}`}
      aria-hidden="true"
    >
      <span className="mb-0.5 h-1.5 w-1.5 rounded-full bg-red-800 shadow-sm" />
      <span className="h-2 w-px bg-red-800/80" />
      <div className="relative w-full overflow-hidden rounded-md border-2 border-red-700 shadow-md">
        <div className="bg-white px-1.5 py-1 text-center">
          <p className="text-[11px] font-black leading-none tracking-wide text-red-600">SOLD</p>
        </div>
        <div className="bg-red-600 px-1.5 py-1 text-center">
          <p className="text-[12px] font-black leading-none tracking-wide text-white">OUT</p>
        </div>
      </div>
    </div>
  );
}

const FOOD_TYPE_OPTIONS = [
  'VEG',
  'NON VEG',
  'NO PREFERENCE',
  'VEG & NON VEG',
];

const FOOD_TYPE_SELECT_OPTIONS = [
  { value: 'VEG', label: 'Veg' },
  { value: 'NON VEG', label: 'Non-Veg' },
  { value: 'NO PREFERENCE', label: 'No Preference' },
];

/** Profile-autofilled fields stay in state + API payload; not shown on the form UI. */

/** Default PD Attend City — always allowed alongside the event place. */
const ATTEND_CITY_ONLINE = 'online';

const registrationFieldBase =
  'mt-2 box-border w-full max-w-full min-w-0 min-h-11 rounded-lg border bg-white px-3 py-2.5 text-base leading-normal text-gray-900 outline-none focus:ring-2';

const registrationInputClass = (hasError) =>
  `${registrationFieldBase} ${
    hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
      : 'border-gray-300 focus:border-emerald-600 focus:ring-emerald-100'
  }`;

function isAttendOnline(value) {
  return String(value || '').trim().toLowerCase() === ATTEND_CITY_ONLINE;
}

function buildAttendCityOptions(eventOrPlace) {
  const options = [ATTEND_CITY_ONLINE];
  if (!eventOrPlace) return options;
  if (typeof eventOrPlace === 'string') {
    const trimmed = eventOrPlace.trim();
    if (trimmed && !isAttendOnline(trimmed)) options.push(trimmed);
    return options;
  }
  const seen = new Set();
  const places = Array.isArray(eventOrPlace.places) && eventOrPlace.places.length > 0
    ? eventOrPlace.places
    : (eventOrPlace.place || eventOrPlace.city ? [{ city: eventOrPlace.place || eventOrPlace.city }] : []);

  for (const p of places) {
    const city = typeof p === 'string' ? p.trim() : String(p?.city || p?.place || '').trim();
    if (city && !isAttendOnline(city) && !seen.has(city.toLowerCase())) {
      seen.add(city.toLowerCase());
      options.push(city);
    }
  }
  return options;
}

function toAttendCitySelectOptions(values) {
  return values.map((value) => ({
    value,
    label: isAttendOnline(value) ? 'Online' : value,
  }));
}

/** Profile fields the registration form never asks — they must already be saved. */
function profileGapMessages(source) {
  const text = (value) => String(value ?? '').trim();
  const checks = [
    [source?.eventTranslation, 'Set Translation in Profile'],
    [source?.clubNo, 'Set Working Physical Centre in Profile'],
    [source?.zoomEmail, 'Set Email in Profile'],
    [source?.name, 'Set Name in Profile'],
    [source?.idNo, 'Set Community ID in Profile'],
    [source?.eventLevel, 'Set Community Position in Profile'],
    [source?.phoneNumber, 'Set Phone Number in Profile'],
    [source?.eventYourCity, 'Set Your City in Profile'],
  ];
  return checks
    .filter(([value]) => !text(value))
    .map(([, message]) => message);
}

function ticketCharge(event) {
  const price = Number(event?.ticketPrice);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.round(price * 100) / 100;
}

function formatTicketPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not specified';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function pickProfileText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

/** Map profile Diet Preference → registration Food Type options. */
function mapDietPreferenceToFoodType(dietPreference) {
  const diet = String(dietPreference || '').trim().toLowerCase();
  if (!diet) return '';
  if (diet === 'vegetarian' || diet === 'vegan' || diet === 'veg') return 'VEG';
  if (
    diet === 'non-vegetarian'
    || diet === 'non vegetarian'
    || diet === 'non-veg'
    || diet === 'non veg'
    || diet === 'pescatarian'
  ) {
    return 'NON VEG';
  }
  if (
    diet === 'no preference'
    || diet === 'none'
    || diet === 'any'
    || diet === 'no_preference'
  ) {
    return 'NO PREFERENCE';
  }
  if (FOOD_TYPE_OPTIONS.includes(String(dietPreference || '').trim().toUpperCase())) {
    return String(dietPreference).trim().toUpperCase();
  }
  return '';
}

function buildRegistrationDefaults(profileData, user, userId) {
  const data = profileData && typeof profileData === 'object' ? profileData : {};
  const dietPreference = pickProfileText(
    data.dietType,
    data.DietType,
    data.dietPreference,
    data.DietPreference,
    data?.counselling?.dietType,
    user?.dietType,
    user?.DietType,
  );
  return {
    name: pickProfileText(
      data.userName,
      data.UserName,
      user?.userName,
      user?.UserName,
      user?.name,
      user?.displayName,
    ),
    zoomEmail: pickProfileText(
      data.email,
      data.Email,
      user?.email,
      user?.Email,
    ),
    phoneNumber: pickProfileText(
      data.phoneNumber,
      data.PhoneNumber,
      user?.phoneNumber,
      user?.PhoneNumber,
      user?.phone,
    ),
    // Community ID field on the form — from Profile Community ID.
    idNo: pickProfileText(
      data.communityId,
      data.CommunityId,
      user?.communityId,
      user?.CommunityId,
    ),
    // Club No — from Profile Working Physical Centre (name, then id).
    clubNo: pickProfileText(
      data?.workingPhysicalCentre?.name,
      data?.workingPhysicalCentre?.Name,
      data?.WorkingPhysicalCentre?.name,
      data?.WorkingPhysicalCentre?.Name,
      data?.workingPhysicalCentre?.id != null
        ? String(data.workingPhysicalCentre.id)
        : '',
      data?.WorkingPhysicalCentre?.id != null
        ? String(data.WorkingPhysicalCentre.id)
        : '',
    ),
    foodType: mapDietPreferenceToFoodType(dietPreference),
    ...pickEventProfilePrefs(data),
  };
}

function EventsPage({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [viewerUserId, setViewerUserId] = useState(null);
  const [profileDefaults, setProfileDefaults] = useState(() => buildRegistrationDefaults(null, user, null));
  const [mainTab, setMainTab] = useState('events');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [registrationStep, setRegistrationStep] = useState('form');
  const [name, setName] = useState('');
  const [clubNo, setClubNo] = useState('');
  const [zoomEmail, setZoomEmail] = useState('');
  const [idNo, setIdNo] = useState('');
  const [level, setLevel] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [participantCount] = useState('1');
  const [ticketNo, setTicketNo] = useState('');
  const [yourCity, setYourCity] = useState('');
  const [translation, setTranslation] = useState('');
  const [attendCity, setAttendCity] = useState('');
  const [foodType, setFoodType] = useState('');
  const [uplinePresidentTeam, setUplinePresidentTeam] = useState(null);
  const [uplineMillTeam, setUplineMillTeam] = useState(null);
  const [teamIncharge, setTeamIncharge] = useState(null);
  const [daicyTeamIncharge, setDaicyTeamIncharge] = useState(null);
  const [submittedName, setSubmittedName] = useState('');
  const [savedRegistration, setSavedRegistration] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [profileGapMessage, setProfileGapMessage] = useState('');
  const [walletBlock, setWalletBlock] = useState(null);
  const [registerCheckId, setRegisterCheckId] = useState(null);
  const [walletOpenSignal, setWalletOpenSignal] = useState(0);

  useEffect(() => {
    let active = true;

    const loadEvents = async ({ soft = false } = {}) => {
      // Soft refresh keeps the current list visible (no full-page "Loading events…").
      if (!soft) {
        setLoading(true);
      }
      setLoadError('');

      try {
        const userId = await getUserId(user);
        if (!userId) {
          throw new Error('Could not identify your account to load events.');
        }

        // Show events as soon as open-list returns — do not wait on profile.
        const result = await listOpenEvents(userId);
        if (!active) return;
        setViewerUserId(userId);
        setEvents(Array.isArray(result.events) ? result.events : []);
        setLoading(false);

        // Instant defaults from shared profile cache (Home/Header often already loaded it).
        const cached = getCachedProfile({ userId, email: user?.email });
        if (cached?.data) {
          setProfileDefaults(buildRegistrationDefaults(cached.data, user, userId));
        }

        // Profile defaults load in the background for the registration form only.
        fetchProfile({ userId })
          .then((profileResult) => {
            if (!active) return;
            setProfileDefaults(buildRegistrationDefaults(profileResult?.data, user, userId));
          })
          .catch(() => {
            /* keep existing defaults */
          });
      } catch (error) {
        if (active) {
          setLoadError(error?.message || 'Could not load events. Please try again.');
          setLoading(false);
        }
      }
    };

    loadEvents({ soft: false });
    const onEventsUpdated = () => loadEvents({ soft: true });
    window.addEventListener(EVENTS_UPDATED_EVENT, onEventsUpdated);
    return () => {
      active = false;
      window.removeEventListener(EVENTS_UPDATED_EVENT, onEventsUpdated);
    };
  }, [user]);

  const applyPersonalDefaults = (defaults = profileDefaults) => {
    setName(defaults?.name || '');
    setClubNo(defaults?.clubNo || '');
    setZoomEmail(defaults?.zoomEmail || '');
    setIdNo(defaults?.idNo || '');
    setPhoneNumber(defaults?.phoneNumber || '');
    setFoodType(defaults?.foodType || '');
    setTranslation(defaults?.eventTranslation || '');
    setYourCity(defaults?.eventYourCity || '');
    setLevel(defaults?.eventLevel || '');
  };

  // Profile often arrives after Register is already open — fill empty autofill fields only.
  useEffect(() => {
    if (!selectedEvent || registrationStep !== 'form') return;
    if (profileDefaults?.name) setName((prev) => prev || profileDefaults.name);
    if (profileDefaults?.zoomEmail) setZoomEmail((prev) => prev || profileDefaults.zoomEmail);
    if (profileDefaults?.phoneNumber) setPhoneNumber((prev) => prev || profileDefaults.phoneNumber);
    if (profileDefaults?.foodType) setFoodType((prev) => prev || profileDefaults.foodType);
    if (profileDefaults?.clubNo) setClubNo((prev) => prev || profileDefaults.clubNo);
    if (profileDefaults?.idNo) setIdNo((prev) => prev || profileDefaults.idNo);
    if (profileDefaults?.eventTranslation) {
      setTranslation((prev) => prev || profileDefaults.eventTranslation);
    }
    if (profileDefaults?.eventYourCity) {
      setYourCity((prev) => prev || profileDefaults.eventYourCity);
    }
    if (profileDefaults?.eventLevel) {
      setLevel((prev) => prev || profileDefaults.eventLevel);
    }
  }, [profileDefaults, selectedEvent, registrationStep]);

  const resetRegistrationForm = (options = {}) => {
    const { keepPersonalDefaults = false, defaults = null } = options;
    if (defaults) {
      applyPersonalDefaults(defaults);
    } else if (keepPersonalDefaults) {
      applyPersonalDefaults();
    } else {
      setName('');
      setClubNo('');
      setZoomEmail('');
      setIdNo('');
      setPhoneNumber('');
      setFoodType('');
      setLevel('');
      setYourCity('');
      setTranslation('');
    }
    setTicketNo('');
    setAttendCity(ATTEND_CITY_ONLINE);
    setUplinePresidentTeam(null);
    setUplineMillTeam(null);
    setTeamIncharge(null);
    setDaicyTeamIncharge(null);
    setSubmittedName('');
    setSavedRegistration(null);
    setRegistrationStep('form');
    setWalletBalance(null);
    setSubmitError('');
    setSavingRegistration(false);
    setFormErrors({});
    setProfileGapMessage('');
    setWalletBlock(null);
  };

  const clearFieldError = (field) => {
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const chargeAmount = (() => {
    const price = ticketCharge(selectedEvent);
    const count = Number(participantCount) || 1;
    return Math.round(price * count * 100) / 100;
  })();

  const closeRegisterDialog = () => {
    setProfileGapMessage('');
    setWalletBlock(null);
  };

  const openWalletToRecharge = () => {
    closeRegisterDialog();
    setWalletOpenSignal((current) => current + 1);
  };

  const beginRegistration = async (event) => {
    if (event?.soldOut || registerCheckId != null) return;
    if (!viewerUserId) {
      setWalletBlock(null);
      setProfileGapMessage('Could not identify your account. Try again.');
      return;
    }

    setRegisterCheckId(event.id);
    setProfileGapMessage('');
    setWalletBlock(null);
    try {
      const defaults = await loadFreshProfile();
      if (!defaults) {
        setProfileGapMessage('Could not load your profile. Try again.');
        return;
      }

      const gaps = profileGapMessages(defaults);
      let nextWalletBlock = null;
      const needed = ticketCharge(event);
      if (needed > 0) {
        try {
          const wallet = await fetchWallet(viewerUserId);
          const balance = Number(wallet?.balance);
          if (!Number.isFinite(balance) || balance + 1e-9 < needed) {
            nextWalletBlock = {
              needed,
              balance: Number.isFinite(balance) ? balance : 0,
              unavailable: false,
            };
          }
        } catch {
          nextWalletBlock = { needed, balance: 0, unavailable: true };
        }
      }

      if (gaps.length > 0 || nextWalletBlock) {
        setProfileGapMessage(gaps.join(' · '));
        setWalletBlock(nextWalletBlock);
        return;
      }

      setSelectedEvent(event);
      resetRegistrationForm({ defaults });
    } finally {
      setRegisterCheckId(null);
    }
  };

  const closeRegistration = () => {
    setSelectedEvent(null);
    resetRegistrationForm();
  };

  const buildValidatedPayload = (fresh = null) => {
    const profileText = (current, fromFresh) => (
      fresh ? String(fromFresh || '').trim() : String(current || '').trim()
    );
    const trimmedName = profileText(name, fresh?.name);
    const trimmedClubNo = profileText(clubNo, fresh?.clubNo);
    const trimmedZoomEmail = profileText(zoomEmail, fresh?.zoomEmail);
    const trimmedIdNo = profileText(idNo, fresh?.idNo);
    const trimmedLevel = profileText(level, fresh?.eventLevel);
    const trimmedPhone = profileText(phoneNumber, fresh?.phoneNumber);
    const translationValue = profileText(translation, fresh?.eventTranslation);
    const yourCityValue = profileText(yourCity, fresh?.eventYourCity);
    const trimmedTicketNo = ticketNo.trim();
    const place = String(selectedEvent?.place || '').trim();
    const nextErrors = {};

    // Autofill fields are hidden in UI — missing values mean Profile needs updating.
    if (!translationValue) nextErrors.translation = 'Set Translation in Profile';
    if (!attendCity) nextErrors.attendCity = 'This is a required question';
    // Online attendance has no venue meal — Food Type is hidden and not required.
    if (!isAttendOnline(attendCity) && !foodType) {
      nextErrors.foodType = 'This is a required question';
    }
    if (!uplinePresidentTeam?.name) nextErrors.uplinePresidentTeam = 'This is a required question';
    if (!uplineMillTeam?.name) nextErrors.uplineMillTeam = 'This is a required question';
    if (!teamIncharge?.name) nextErrors.teamIncharge = 'This is a required question';
    if (teamIncharge?.name && !daicyTeamIncharge?.name) {
      nextErrors.daicyTeamIncharge = 'This is a required question';
    }
    if (!trimmedClubNo) nextErrors.clubNo = 'Set Working Physical Centre in Profile';
    if (!trimmedZoomEmail) nextErrors.zoomEmail = 'Set Email in Profile';
    if (!trimmedName) nextErrors.name = 'Set Name in Profile';
    if (!trimmedIdNo) nextErrors.idNo = 'Set Community ID in Profile';
    if (!trimmedLevel) nextErrors.level = 'Set Community Position in Profile';
    if (!trimmedPhone) nextErrors.phoneNumber = 'Set Phone Number in Profile';
    if (!participantCount) nextErrors.participantCount = 'This is a required question';
    if (!trimmedTicketNo) nextErrors.ticketNo = 'This is a required question';
    if (!yourCityValue) nextErrors.yourCity = 'Set Your City in Profile';
    if (attendCity && place && attendCity !== place && !isAttendOnline(attendCity)) {
      nextErrors.attendCity = 'Choose the event city or Online';
    }
    if (!viewerUserId || !selectedEvent?.id) {
      nextErrors.name = nextErrors.name || 'Could not identify your account or event.';
    }

    const profileGapKeys = [
      'translation',
      'clubNo',
      'zoomEmail',
      'name',
      'idNo',
      'level',
      'phoneNumber',
      'yourCity',
    ];
    const profileGaps = profileGapKeys
      .map((key) => nextErrors[key])
      .filter((message) => message && message.startsWith('Set '));
    profileGapKeys.forEach((key) => {
      if (String(nextErrors[key] || '').startsWith('Set ')) delete nextErrors[key];
    });
    setProfileGapMessage(profileGaps.length > 0 ? profileGaps.join(' · ') : '');

    if (profileGaps.length > 0 || Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return null;
    }

    setFormErrors({});
    return {
      userId: viewerUserId,
      eventId: selectedEvent.id,
      translation: translationValue,
      attendCity,
      foodType: isAttendOnline(attendCity) ? '' : foodType,
      uplinePresidentTeam,
      uplineMillTeam,
      clubNo: trimmedClubNo,
      zoomEmail: trimmedZoomEmail,
      name: trimmedName,
      idNo: trimmedIdNo,
      level: trimmedLevel,
      phoneNumber: trimmedPhone,
      participantCount: Number(participantCount),
      ticketNo: trimmedTicketNo,
      yourCity: yourCityValue,
      teamIncharge,
      daicyTeamIncharge,
      confirmPayment: true,
    };
  };

  const loadFreshProfile = async () => {
    if (!viewerUserId) return null;
    try {
      const profileResult = await fetchProfile({ userId: viewerUserId, cacheBust: true });
      const defaults = buildRegistrationDefaults(profileResult?.data, user, viewerUserId);
      setProfileDefaults(defaults);
      setName(defaults?.name || '');
      setClubNo(defaults?.clubNo || '');
      setZoomEmail(defaults?.zoomEmail || '');
      setIdNo(defaults?.idNo || '');
      setPhoneNumber(defaults?.phoneNumber || '');
      setTranslation(defaults?.eventTranslation || '');
      setYourCity(defaults?.eventYourCity || '');
      setLevel(defaults?.eventLevel || '');
      return defaults;
    } catch {
      return null;
    }
  };

  const goToPaymentStep = async (formEvent) => {
    formEvent.preventDefault();
    if (savingRegistration) return;
    const fresh = await loadFreshProfile();
    const payload = buildValidatedPayload(fresh);
    if (!payload) return;

    setSubmitError('');
    setRegistrationStep('pay');
    setWalletLoading(true);
    try {
      const wallet = await fetchWallet(viewerUserId);
      setWalletBalance(Number(wallet?.balance));
    } catch (error) {
      setWalletBalance(null);
      setSubmitError(error?.message || 'Could not load wallet balance.');
    } finally {
      setWalletLoading(false);
    }
  };

  const confirmPaymentAndSubmit = async () => {
    if (savingRegistration) return;
    const payload = buildValidatedPayload();
    if (!payload) {
      setRegistrationStep('form');
      return;
    }

    setSubmitError('');
    setSavingRegistration(true);
    try {
      const data = await createEventRegistration(payload);
      setSubmittedName(payload.name);
      setSavedRegistration(data.registration || null);
      if (data.balanceAfter != null) setWalletBalance(Number(data.balanceAfter));
      setRegistrationStep('success');
      notifyEventsUpdated();
    } catch (error) {
      setSubmitError(error?.message || 'Could not complete payment. Please try again.');
    } finally {
      setSavingRegistration(false);
    }
  };

  const attendCityOptions = buildAttendCityOptions(selectedEvent);

  return (
    <main className="min-h-full overflow-x-hidden bg-gray-50 px-3 py-5 sm:px-5">
      <div className="mx-auto w-full max-w-2xl min-w-0">
        {selectedEvent ? (
          <section aria-labelledby="event-registration-title" className="min-w-0">
            <button
              type="button"
              onClick={closeRegistration}
              className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to events
            </button>

            <div className="min-w-0 overflow-x-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-4 shadow-sm sm:p-6">
              <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                {STATUS_LABELS[selectedEvent.status] || selectedEvent.status}
              </span>
              <h1 id="event-registration-title" className="mt-3 text-xl font-bold text-white">
                Event registration: {selectedEvent.eventName}
              </h1>
              <p className="mt-2 text-xs font-medium text-rose-100">* Indicates required question</p>

              {registrationStep === 'success' && submittedName ? (
                <div role="status" className="mt-5 space-y-3 rounded-xl border border-white/80 bg-white/90 p-4 text-sm text-gray-800">
                  <p className="flex items-center gap-2 font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    Successfully Submitted
                  </p>
                  <p>Thank you, {submittedName}. Your entry pass is ready.</p>
                  <RegistrationQrCard
                    qrPayload={savedRegistration?.qrPayload}
                    entryCode={savedRegistration?.entryCode}
                    eventName={selectedEvent.eventName}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      closeRegistration();
                      setMainTab('bookings');
                    }}
                    className="w-full rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-900"
                  >
                    View in My Bookings
                  </button>
                </div>
              ) : registrationStep === 'pay' ? (
                <div className="mt-5 space-y-3 rounded-xl border border-white/80 bg-white p-4 text-sm text-gray-800">
                  <h2 className="text-base font-bold text-gray-900">Confirm wallet payment</h2>
                  <p>Ticket amount: <span className="font-semibold">{formatTicketPrice(chargeAmount)}</span></p>
                  <p>
                    Wallet balance:{' '}
                    <span className="font-semibold">
                      {walletLoading
                        ? 'Loading…'
                        : walletBalance == null
                          ? 'Unavailable'
                          : formatTicketPrice(walletBalance)}
                    </span>
                  </p>
                  {!walletLoading && walletBalance != null && walletBalance + 1e-9 < chargeAmount ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900" role="alert">
                      Insufficient balance. Add cash in Wallet, then try again.
                    </p>
                  ) : null}
                  {submitError ? (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800" role="alert">
                      {submitError}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitError('');
                        setRegistrationStep('form');
                      }}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={savingRegistration || walletLoading}
                      onClick={confirmPaymentAndSubmit}
                      className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {savingRegistration ? 'Paying…' : 'Pay & submit'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={goToPaymentStep} className="mt-5 min-w-0 space-y-3" noValidate>
                  <div
                    className={`rounded-xl border bg-white p-4 ${
                      formErrors.attendCity ? 'border-rose-400' : 'border-white/80'
                    }`}
                  >
                    <label htmlFor="event-registration-attend-city-trigger" className="block text-sm font-semibold text-gray-900">
                      Attending City <span className="text-rose-600">*</span>
                    </label>
                    <RegistrationSelect
                      id="event-registration-attend-city"
                      name="attendCity"
                      required
                      value={attendCity}
                      options={toAttendCitySelectOptions(attendCityOptions)}
                      hasError={Boolean(formErrors.attendCity)}
                      onChange={(next) => {
                        setAttendCity(next);
                        setFormErrors((prev) => ({
                          ...prev,
                          attendCity: undefined,
                          ...(isAttendOnline(next) ? { foodType: undefined } : {}),
                        }));
                      }}
                    />
                    {formErrors.attendCity ? (
                      <p className="mt-2 text-sm text-rose-600" role="alert">
                        {formErrors.attendCity}
                      </p>
                    ) : null}
                  </div>

                  {!isAttendOnline(attendCity) ? (
                    <div
                      className={`rounded-xl border bg-white p-4 ${
                        formErrors.foodType ? 'border-rose-400' : 'border-white/80'
                      }`}
                    >
                      <label htmlFor="event-registration-food-type-trigger" className="block text-sm font-semibold text-gray-900">
                        Food Type <span className="text-rose-600">*</span>
                      </label>
                      <RegistrationSelect
                        id="event-registration-food-type"
                        name="foodType"
                        required
                        placeholder="Choose food type"
                        value={foodType}
                        options={FOOD_TYPE_SELECT_OPTIONS}
                        hasError={Boolean(formErrors.foodType)}
                        onChange={(next) => {
                          setFoodType(next);
                          setFormErrors((prev) => ({ ...prev, foodType: undefined }));
                        }}
                      />
                      {formErrors.foodType ? (
                        <p className="mt-2 text-sm text-rose-600" role="alert">
                          {formErrors.foodType}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-white/80 bg-white p-4">
                    <p className="text-sm font-extrabold uppercase tracking-wide text-gray-900">
                      Upline Detail
                    </p>
                    <div className="mt-3 space-y-4">
                      <MemberSearchPicker
                        userId={viewerUserId}
                        label="Upline President Team"
                        inputId="event-registration-upline-president"
                        value={uplinePresidentTeam}
                        required
                        error={formErrors.uplinePresidentTeam || ''}
                        hint="Type a name to find the president team member."
                        onChange={(person) => {
                          setUplinePresidentTeam(person);
                          setFormErrors((prev) => ({ ...prev, uplinePresidentTeam: undefined }));
                        }}
                      />
                      <MemberSearchPicker
                        userId={viewerUserId}
                        label="Upline Mill Team"
                        inputId="event-registration-upline-mill"
                        value={uplineMillTeam}
                        required
                        error={formErrors.uplineMillTeam || ''}
                        hint="Type a name to find the mill team member."
                        onChange={(person) => {
                          setUplineMillTeam(person);
                          setFormErrors((prev) => ({ ...prev, uplineMillTeam: undefined }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/80 bg-white p-4">
                    <label htmlFor="event-registration-ticket-no" className="block text-sm font-semibold text-gray-900">
                      Your Ticket Number <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="event-registration-ticket-no"
                      name="ticketNo"
                      type="text"
                      maxLength={80}
                      required
                      value={ticketNo}
                      onChange={(event) => {
                        setTicketNo(event.target.value);
                        clearFieldError('ticketNo');
                      }}
                      className={registrationInputClass(Boolean(formErrors.ticketNo))}
                      placeholder="Enter ticket number"
                    />
                    {formErrors.ticketNo ? (
                      <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.ticketNo}</p>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-white/80 bg-white p-4">
                    <p className="text-sm font-extrabold uppercase tracking-wide text-gray-900">
                      Team Incharge Detail
                    </p>
                    <div className="mt-3">
                      <MemberSearchPicker
                        userId={viewerUserId}
                        label="Team Incharge"
                        inputId="event-registration-team-incharge"
                        value={teamIncharge}
                        required
                        error={formErrors.teamIncharge || ''}
                        hint="Type a name to find the team incharge."
                        onChange={(person) => {
                          setTeamIncharge(person);
                          setDaicyTeamIncharge(null);
                          setFormErrors((prev) => ({
                            ...prev,
                            teamIncharge: undefined,
                            daicyTeamIncharge: undefined,
                          }));
                        }}
                      />
                    </div>
                  </div>

                  {teamIncharge?.name ? (
                    <div className="rounded-xl border border-white/80 bg-white p-4">
                      <p
                        id="event-registration-daicy-heading"
                        className="text-sm font-extrabold uppercase tracking-wide text-gray-900"
                      >
                        {teamIncharge.name} Team Sub Incharge
                      </p>
                      <div className="mt-3">
                        <MemberSearchPicker
                          userId={viewerUserId}
                          label=""
                          labelledBy="event-registration-daicy-heading"
                          inputId="event-registration-daicy-team-incharge"
                          value={daicyTeamIncharge}
                          required
                          showUpline
                          error={formErrors.daicyTeamIncharge || ''}
                          hint="Type a name. Results show name + upline above them."
                          onChange={(person) => {
                            setDaicyTeamIncharge(person);
                            setFormErrors((prev) => ({ ...prev, daicyTeamIncharge: undefined }));
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {submitError ? (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                      {submitError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={savingRegistration}
                    className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                  </button>
                </form>
              )}
            </div>
          </section>
        ) : (
          <>
            <header className="mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                  <CalendarDays className="h-5 w-5 text-emerald-800" aria-hidden="true" />
                </span>
                <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                  Upcoming Events
                </h1>
                {/* Same wallet as Profile — compact, right side only. */}
                <div className="shrink-0">
                  <WalletButton
                    userId={viewerUserId}
                    variant="events"
                    openSignal={walletOpenSignal}
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-gray-200 bg-white p-1 text-xs font-semibold">
                {[
                  { id: 'events', label: 'Events' },
                  { id: 'bookings', label: 'My Bookings' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMainTab(tab.id)}
                    className={`rounded-lg px-2 py-2 ${
                      mainTab === tab.id ? 'bg-emerald-800 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </header>

            {mainTab === 'bookings' ? (
              <MyBookingsPanel user={user} />
            ) : loading ? (
              <p role="status" className="py-6 text-center text-sm text-gray-600">Loading events…</p>
            ) : loadError ? (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {loadError}
              </p>
            ) : events.length === 0 ? (
              <p className="rounded-xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-600">
                No events have been created yet.
              </p>
            ) : (
              <section aria-label="Wellness events" className="mx-auto max-w-lg space-y-2.5">
                {events.map((event, index) => {
                  const style = CARD_STYLES[index % CARD_STYLES.length];
                  const status = String(event.status || 'scheduled').toLowerCase();
                  const soldOut = Boolean(event.soldOut);
                  const seatsLeft = event.seatsLeft;
                  const designatedNames = (event.designatedPersons || [])
                    .map((person) => person?.name)
                    .filter(Boolean);
                  const registerDisabled = status === 'cancelled' || soldOut;

                  return (
                    <article
                      key={event.id}
                      className={`relative isolate overflow-hidden rounded-xl border p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${style.card}`}
                    >
                      {soldOut ? (
                        <SoldOutSign className="absolute right-2 top-1 z-20 rotate-[-8deg]" />
                      ) : null}
                      <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 -z-10 h-24 w-24 rounded-full bg-white/10 blur-sm" />
                      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 right-12 -z-10 h-20 w-20 rounded-full bg-cyan-200/20 blur-sm" />
                      <div className={`flex items-start gap-2.5 ${soldOut ? 'pr-16' : ''}`}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white shadow-inner">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${style.badge}`}>
                              Wellness event
                            </span>
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.scheduled}`}>
                              {STATUS_LABELS[status] || status}
                            </span>
                          </div>
                          <h2 className="mt-1 truncate text-sm font-bold text-white sm:text-base">
                            {event.eventName}
                          </h2>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] leading-4 text-white/95 sm:text-xs">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {formatEventPlacesSummary(event) || event.place}
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-white/85">
                            {getEventDatesList(event).length > 1 ? (
                              <span>
                                {getEventDatesList(event).length} dates: {getEventDatesList(event).map((d) => d.date).join(', ')}
                              </span>
                            ) : (
                              <span>
                                {event.eventDate}
                                {formatEventTimeRange(event.startTime, event.endTime)
                                  ? ` · ${formatEventTimeRange(event.startTime, event.endTime)}`
                                  : ''}
                              </span>
                            )}
                            {' · Host: '}
                            {event.hostName} · {formatTicketPrice(event.ticketPrice)} ·{' '}
                            {event.seatCount} seats
                          </p>
                          {designatedNames.length > 0 && (
                            <p className="mt-1 flex items-start gap-1 text-[10px] leading-4 text-white/85">
                              <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">For: {designatedNames.join(', ')}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/20 pt-2">
                        {!soldOut && seatsLeft != null ? (
                          <span className="inline-flex items-center rounded-lg border-2 border-white bg-emerald-50 px-2.5 py-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 shadow-sm">
                            {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left
                          </span>
                        ) : (
                          <span />
                        )}
                        {soldOut ? (
                          <span className="sr-only">Sold out — registration closed</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginRegistration(event)}
                            disabled={registerDisabled || registerCheckId != null}
                            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-bold shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${style.button}`}
                          >
                            Register
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
      {profileGapMessage || walletBlock ? (
        <div
          className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/50 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-profile-gap-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 id="event-profile-gap-title" className="text-lg font-bold text-gray-900">
              {profileGapMessage ? 'Please fill to register' : 'Recharge to register'}
            </h2>
            {profileGapMessage ? (
              <>
                <p className="mt-2 text-sm text-gray-700">{profileGapMessage}</p>
                {profileGapMessage.includes('Set ') ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Save these in Profile, then come back and register.
                  </p>
                ) : null}
              </>
            ) : null}
            {walletBlock ? (
              <p className="mt-2 text-sm text-gray-700">
                {walletBlock.unavailable
                  ? 'Could not check your wallet. Try again, then register.'
                  : `This ticket is ${formatTicketPrice(walletBlock.needed)}. Your wallet has ${formatTicketPrice(walletBlock.balance)}. Recharge, then tap Register.`}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              {walletBlock && !walletBlock.unavailable ? (
                <button
                  type="button"
                  onClick={openWalletToRecharge}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
                >
                  Recharge
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeRegisterDialog}
                className={`w-full rounded-xl py-3 text-sm font-bold ${
                  walletBlock && !walletBlock.unavailable
                    ? 'border border-gray-300 text-gray-800'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default EventsPage;
