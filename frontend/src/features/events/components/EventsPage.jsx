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
import { createEventRegistration, EVENTS_UPDATED_EVENT, listEvents } from '../services/events.api.js';
import MemberSearchPicker from './MemberSearchPicker.jsx';
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

const TRANSLATION_OPTIONS = [
  'TAMIL',
  'ENGLISH',
  'MALAYALAM',
  'HINDI',
  'TELUGU',
  'KANNADA',
];

const FOOD_TYPE_OPTIONS = [
  'VEG',
  'NON VEG',
  'VEG & NON VEG',
];

const LEVEL_OPTIONS = [
  'PC',
  'ASSOCIATE',
  'SV',
  'WT',
  'AWT',
  'GET TEAM',
  '2500 GET TEAM',
  'MILL TEAM',
  'PT',
];

const YOUR_CITY_OPTIONS = [
  'OTHER COUNTRY',
  'OTHER CITY',
  'CHENNAI',
  'COIMBATORE',
  'ERODE',
  'HOSUR',
  'KERALA',
  'KUMBAKONAM',
  'MADURAI',
  'NELLAI',
  'PERAMBALUR',
  'PATTUKOTTAI',
  'PONDY',
  'RAJAPALAYAM',
  'SALEM',
  'TRICHY',
  'VELLORE',
  'VILLUPURAM',
  'MUMBAI',
  'BANGALORE',
];

const registrationFieldBase =
  'mt-2 box-border w-full max-w-full min-w-0 min-h-11 rounded-lg border bg-white px-3 py-2.5 text-base leading-normal text-gray-900 outline-none focus:ring-2';

const registrationInputClass = (hasError) =>
  `${registrationFieldBase} ${
    hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
      : 'border-gray-300 focus:border-emerald-600 focus:ring-emerald-100'
  }`;

function toSelectOptions(values) {
  return values.map((value) => ({ value, label: value }));
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
    idNo: pickProfileText(
      data.userId,
      data.UserId,
      userId,
      user?.id,
      user?.UserId,
      user?.userId,
    ),
    clubNo: pickProfileText(
      data.communityId,
      data.CommunityId,
      data.teamId,
      data.TeamId,
      user?.communityId,
      user?.CommunityId,
    ),
    foodType: mapDietPreferenceToFoodType(dietPreference),
  };
}

function EventsPage({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [viewerUserId, setViewerUserId] = useState(null);
  const [profileDefaults, setProfileDefaults] = useState(() => buildRegistrationDefaults(null, user, null));
  const [selectedEvent, setSelectedEvent] = useState(null);
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
  const [submitError, setSubmitError] = useState('');
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    let active = true;

    const loadEvents = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const userId = await getUserId(user);
        if (!userId) {
          throw new Error('Could not identify your account to load events.');
        }

        const [result, profileResult] = await Promise.all([
          listEvents(userId),
          fetchProfile({ userId }).catch(() => null),
        ]);
        if (active) {
          setViewerUserId(userId);
          setEvents(Array.isArray(result.events) ? result.events : []);
          setProfileDefaults(buildRegistrationDefaults(profileResult?.data, user, userId));
        }
      } catch (error) {
        if (active) {
          setLoadError(error?.message || 'Could not load events. Please try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadEvents();
    window.addEventListener(EVENTS_UPDATED_EVENT, loadEvents);
    return () => {
      active = false;
      window.removeEventListener(EVENTS_UPDATED_EVENT, loadEvents);
    };
  }, [user]);

  const applyPersonalDefaults = (defaults = profileDefaults) => {
    setName(defaults?.name || '');
    setClubNo(defaults?.clubNo || '');
    setZoomEmail(defaults?.zoomEmail || '');
    setIdNo(defaults?.idNo || '');
    setPhoneNumber(defaults?.phoneNumber || '');
    setFoodType(defaults?.foodType || '');
  };

  const resetRegistrationForm = (options = {}) => {
    const { keepPersonalDefaults = false } = options;
    if (keepPersonalDefaults) {
      applyPersonalDefaults();
    } else {
      setName('');
      setClubNo('');
      setZoomEmail('');
      setIdNo('');
      setPhoneNumber('');
      setFoodType('');
    }
    setLevel('');
    setTicketNo('');
    setYourCity('');
    setTranslation('');
    setAttendCity('');
    setUplinePresidentTeam(null);
    setUplineMillTeam(null);
    setTeamIncharge(null);
    setDaicyTeamIncharge(null);
    setSubmittedName('');
    setSubmitError('');
    setSavingRegistration(false);
    setFormErrors({});
  };

  const clearFieldError = (field) => {
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const openRegistration = (event) => {
    setSelectedEvent(event);
    resetRegistrationForm({ keepPersonalDefaults: true });
  };

  const closeRegistration = () => {
    setSelectedEvent(null);
    resetRegistrationForm();
  };

  const submitRegistration = async (formEvent) => {
    formEvent.preventDefault();
    if (savingRegistration) return;

    const trimmedName = name.trim();
    const trimmedClubNo = clubNo.trim();
    const trimmedZoomEmail = zoomEmail.trim();
    const trimmedIdNo = idNo.trim();
    const trimmedLevel = level.trim();
    const trimmedPhone = phoneNumber.trim();
    const trimmedTicketNo = ticketNo.trim();
    const place = String(selectedEvent?.place || '').trim();
    const nextErrors = {};

    if (!translation) nextErrors.translation = 'This is a required question';
    if (!attendCity) nextErrors.attendCity = 'This is a required question';
    if (!foodType) nextErrors.foodType = 'This is a required question';
    if (!uplinePresidentTeam?.name) nextErrors.uplinePresidentTeam = 'This is a required question';
    if (!uplineMillTeam?.name) nextErrors.uplineMillTeam = 'This is a required question';
    if (!teamIncharge?.name) nextErrors.teamIncharge = 'This is a required question';
    if (teamIncharge?.name && !daicyTeamIncharge?.name) {
      nextErrors.daicyTeamIncharge = 'This is a required question';
    }
    if (!trimmedClubNo) nextErrors.clubNo = 'This is a required question';
    if (!trimmedZoomEmail) nextErrors.zoomEmail = 'This is a required question';
    if (!trimmedName) nextErrors.name = 'This is a required question';
    if (!trimmedIdNo) nextErrors.idNo = 'This is a required question';
    if (!trimmedLevel) nextErrors.level = 'This is a required question';
    if (!trimmedPhone) nextErrors.phoneNumber = 'This is a required question';
    if (!participantCount) nextErrors.participantCount = 'This is a required question';
    if (!trimmedTicketNo) nextErrors.ticketNo = 'This is a required question';
    if (!yourCity) nextErrors.yourCity = 'This is a required question';
    if (attendCity && place && attendCity !== place) {
      nextErrors.attendCity = 'Choose the event city';
    }
    if (!viewerUserId || !selectedEvent?.id) {
      nextErrors.name = 'Could not identify your account or event.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    setFormErrors({});
    setSubmitError('');
    setSavingRegistration(true);
    try {
      await createEventRegistration({
        userId: viewerUserId,
        eventId: selectedEvent.id,
        translation,
        attendCity,
        foodType,
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
        yourCity,
        teamIncharge,
        daicyTeamIncharge,
      });
      setSubmittedName(trimmedName);
    } catch (error) {
      setSubmitError(error?.message || 'Could not save registration. Please try again.');
    } finally {
      setSavingRegistration(false);
    }
  };

  const attendCityOptions = selectedEvent?.place
    ? [String(selectedEvent.place).trim()].filter(Boolean)
    : [];

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
                Register interest in {selectedEvent.eventName}
              </h1>
              <p className="mt-1 text-sm leading-6 text-white/95">
                Complete translation, attend city, food type, upline detail, and personal detail. Your registration is saved when you submit.
              </p>
              <p className="mt-2 text-xs font-medium text-rose-100">* Indicates required question</p>

              {submittedName ? (
                <div role="status" className="mt-5 rounded-xl border border-white/80 bg-white/90 p-4 text-sm text-gray-800">
                  <p className="flex items-center gap-2 font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    Thank you, {submittedName}!
                  </p>
                  <p className="mt-1">Your registration has been saved.</p>
                  {translation ? (
                    <p className="mt-1 text-sm text-gray-700">Translation: {translation}</p>
                  ) : null}
                  {attendCity ? (
                    <p className="mt-1 text-sm text-gray-700">PD Attend City: {attendCity}</p>
                  ) : null}
                  {foodType ? (
                    <p className="mt-1 text-sm text-gray-700">Food Type: {foodType}</p>
                  ) : null}
                  {uplinePresidentTeam?.name ? (
                    <p className="mt-1 text-sm text-gray-700">
                      Upline President Team: {uplinePresidentTeam.name}
                    </p>
                  ) : null}
                  {uplineMillTeam?.name ? (
                    <p className="mt-1 text-sm text-gray-700">
                      Upline Mill Team: {uplineMillTeam.name}
                    </p>
                  ) : null}
                  {clubNo.trim() ? (
                    <p className="mt-1 text-sm text-gray-700">Club No: {clubNo.trim()}</p>
                  ) : null}
                  {zoomEmail.trim() ? (
                    <p className="mt-1 text-sm text-gray-700">Zoom Email: {zoomEmail.trim()}</p>
                  ) : null}
                  {idNo.trim() ? (
                    <p className="mt-1 text-sm text-gray-700">ID No: {idNo.trim()}</p>
                  ) : null}
                  {level.trim() ? (
                    <p className="mt-1 text-sm text-gray-700">Level: {level.trim()}</p>
                  ) : null}
                  {phoneNumber.trim() ? (
                    <p className="mt-1 text-sm text-gray-700">Phone: {phoneNumber.trim()}</p>
                  ) : null}
                  {participantCount ? (
                    <p className="mt-1 text-sm text-gray-700">No of Participant: {participantCount}</p>
                  ) : null}
                  {ticketNo.trim() ? (
                    <p className="mt-1 text-sm text-gray-700">PD Ticket No: {ticketNo.trim()}</p>
                  ) : null}
                  {yourCity ? (
                    <p className="mt-1 text-sm text-gray-700">Your City: {yourCity}</p>
                  ) : null}
                  {teamIncharge?.name ? (
                    <p className="mt-1 text-sm text-gray-700">Team Incharge: {teamIncharge.name}</p>
                  ) : null}
                  {daicyTeamIncharge?.name ? (
                    <p className="mt-1 text-sm text-gray-700">
                      Daicy Team Incharge: {daicyTeamIncharge.name}
                      {daicyTeamIncharge.uplineLabel ? ` + ${daicyTeamIncharge.uplineLabel}` : ''}
                    </p>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={submitRegistration} className="mt-5 min-w-0 space-y-3" noValidate>
                  <div
                    className={`rounded-xl border bg-white p-4 ${
                      formErrors.translation ? 'border-rose-400' : 'border-white/80'
                    }`}
                  >
                    <label htmlFor="event-registration-translation-trigger" className="block text-sm font-semibold text-gray-900">
                      Translation <span className="text-rose-600">*</span>
                    </label>
                    <RegistrationSelect
                      id="event-registration-translation"
                      name="translation"
                      required
                      value={translation}
                      options={toSelectOptions(TRANSLATION_OPTIONS)}
                      hasError={Boolean(formErrors.translation)}
                      onChange={(next) => {
                        setTranslation(next);
                        setFormErrors((prev) => ({ ...prev, translation: undefined }));
                      }}
                    />
                    {formErrors.translation ? (
                      <p className="mt-2 text-sm text-rose-600" role="alert">
                        {formErrors.translation}
                      </p>
                    ) : null}
                  </div>

                  <div
                    className={`rounded-xl border bg-white p-4 ${
                      formErrors.attendCity ? 'border-rose-400' : 'border-white/80'
                    }`}
                  >
                    <label htmlFor="event-registration-attend-city-trigger" className="block text-sm font-semibold text-gray-900">
                      PD Attend City <span className="text-rose-600">*</span>
                    </label>
                    <RegistrationSelect
                      id="event-registration-attend-city"
                      name="attendCity"
                      required
                      value={attendCity}
                      options={toSelectOptions(attendCityOptions)}
                      hasError={Boolean(formErrors.attendCity)}
                      onChange={(next) => {
                        setAttendCity(next);
                        setFormErrors((prev) => ({ ...prev, attendCity: undefined }));
                      }}
                    />
                    {formErrors.attendCity ? (
                      <p className="mt-2 text-sm text-rose-600" role="alert">
                        {formErrors.attendCity}
                      </p>
                    ) : null}
                  </div>

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
                      value={foodType}
                      options={toSelectOptions(FOOD_TYPE_OPTIONS)}
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
                    <p className="text-sm font-extrabold uppercase tracking-wide text-gray-900">
                      Personal Detail
                    </p>
                    <div className="mt-3 space-y-4">
                      <div>
                        <label htmlFor="event-registration-club-no" className="block text-sm font-semibold text-gray-900">
                          Club No <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="event-registration-club-no"
                          name="clubNo"
                          type="text"
                          maxLength={80}
                          required
                          value={clubNo}
                          onChange={(event) => {
                            setClubNo(event.target.value);
                            clearFieldError('clubNo');
                          }}
                          className={registrationInputClass(Boolean(formErrors.clubNo))}
                          placeholder="Enter club no"
                        />
                        {formErrors.clubNo ? (
                          <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.clubNo}</p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="event-registration-zoom-email" className="block text-sm font-semibold text-gray-900">
                          Your Zoom Email ID <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="event-registration-zoom-email"
                          name="zoomEmail"
                          type="email"
                          autoComplete="email"
                          maxLength={120}
                          required
                          value={zoomEmail}
                          onChange={(event) => {
                            setZoomEmail(event.target.value);
                            clearFieldError('zoomEmail');
                          }}
                          className={registrationInputClass(Boolean(formErrors.zoomEmail))}
                          placeholder="Enter zoom email"
                        />
                        {formErrors.zoomEmail ? (
                          <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.zoomEmail}</p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="event-registration-name" className="block text-sm font-semibold text-gray-900">
                          Name <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="event-registration-name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          maxLength={80}
                          required
                          value={name}
                          onChange={(event) => {
                            setName(event.target.value);
                            clearFieldError('name');
                          }}
                          className={registrationInputClass(Boolean(formErrors.name))}
                          placeholder="Enter your name"
                        />
                        {formErrors.name ? (
                          <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.name}</p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="event-registration-id-no" className="block text-sm font-semibold text-gray-900">
                          ID No <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="event-registration-id-no"
                          name="idNo"
                          type="text"
                          maxLength={80}
                          required
                          value={idNo}
                          onChange={(event) => {
                            setIdNo(event.target.value);
                            clearFieldError('idNo');
                          }}
                          className={registrationInputClass(Boolean(formErrors.idNo))}
                          placeholder="Enter ID no"
                        />
                        {formErrors.idNo ? (
                          <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.idNo}</p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="event-registration-level-trigger" className="block text-sm font-semibold text-gray-900">
                          Level <span className="text-rose-600">*</span>
                        </label>
                        <RegistrationSelect
                          id="event-registration-level"
                          name="level"
                          required
                          value={level}
                          options={toSelectOptions(LEVEL_OPTIONS)}
                          hasError={Boolean(formErrors.level)}
                          onChange={(next) => {
                            setLevel(next);
                            clearFieldError('level');
                          }}
                        />
                        {formErrors.level ? (
                          <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.level}</p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="event-registration-phone" className="block text-sm font-semibold text-gray-900">
                          Phone Number <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="event-registration-phone"
                          name="phoneNumber"
                          type="tel"
                          autoComplete="tel"
                          maxLength={20}
                          required
                          value={phoneNumber}
                          onChange={(event) => {
                            setPhoneNumber(event.target.value);
                            clearFieldError('phoneNumber');
                          }}
                          className={registrationInputClass(Boolean(formErrors.phoneNumber))}
                          placeholder="Enter phone number"
                        />
                        {formErrors.phoneNumber ? (
                          <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.phoneNumber}</p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="event-registration-participant-count" className="block text-sm font-semibold text-gray-900">
                          No of Participant <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id="event-registration-participant-count"
                          name="participantCount"
                          type="text"
                          readOnly
                          required
                          value={participantCount}
                          className={`${registrationInputClass(false)} bg-gray-50 text-gray-800`}
                        />
                      </div>

                      <div>
                        <label htmlFor="event-registration-ticket-no" className="block text-sm font-semibold text-gray-900">
                          PD Your Ticket No <span className="text-rose-600">*</span>
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
                          placeholder="Enter ticket no"
                        />
                        {formErrors.ticketNo ? (
                          <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.ticketNo}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/80 bg-white p-4">
                    <p className="text-sm font-extrabold uppercase tracking-wide text-gray-900">
                      City
                    </p>
                    <div className="mt-3">
                      <label htmlFor="event-registration-your-city-trigger" className="block text-sm font-semibold text-gray-900">
                        Your City <span className="text-rose-600">*</span>
                      </label>
                      <RegistrationSelect
                        id="event-registration-your-city"
                        name="yourCity"
                        required
                        value={yourCity}
                        options={toSelectOptions(YOUR_CITY_OPTIONS)}
                        hasError={Boolean(formErrors.yourCity)}
                        onChange={(next) => {
                          setYourCity(next);
                          clearFieldError('yourCity');
                        }}
                      />
                      {formErrors.yourCity ? (
                        <p className="mt-2 text-sm text-rose-600" role="alert">{formErrors.yourCity}</p>
                      ) : null}
                    </div>
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
                    {savingRegistration ? 'Saving…' : 'Submit registration'}
                  </button>
                </form>
              )}
            </div>
          </section>
        ) : (
          <>
            <header className="mb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                  <CalendarDays className="h-6 w-6 text-emerald-800" aria-hidden="true" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Wellness Events</h1>
                  <p className="text-sm text-gray-600">Events added from the Create Event page.</p>
                </div>
              </div>
            </header>

            {loading ? (
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
                  const designatedNames = (event.designatedPersons || [])
                    .map((person) => person?.name)
                    .filter(Boolean);

                  return (
                    <article
                      key={event.id}
                      className={`relative isolate overflow-hidden rounded-xl border p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${style.card}`}
                    >
                      <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 -z-10 h-24 w-24 rounded-full bg-white/10 blur-sm" />
                      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 right-12 -z-10 h-20 w-20 rounded-full bg-cyan-200/20 blur-sm" />
                      <div className="flex items-start gap-2.5">
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
                            {event.place}
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-white/85">
                            {event.eventDate} · Host: {event.hostName} · {formatTicketPrice(event.ticketPrice)} · {event.seatCount} seats
                          </p>
                          {designatedNames.length > 0 && (
                            <p className="mt-1 flex items-start gap-1 text-[10px] leading-4 text-white/85">
                              <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">For: {designatedNames.join(', ')}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end border-t border-white/20 pt-2">
                        <button
                          type="button"
                          onClick={() => openRegistration(event)}
                          disabled={status === 'cancelled'}
                          className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-bold shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${style.button}`}
                        >
                          Register
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default EventsPage;
