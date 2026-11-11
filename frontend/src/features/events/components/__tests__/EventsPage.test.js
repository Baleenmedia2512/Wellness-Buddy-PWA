import React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { getUserId } from '../../../../shared/services/getUserId.js';
import { fetchProfile } from '../../../user/services/profileService.js';
import { fetchWallet } from '../../../wallet/services/walletApi.js';
import {
  createEventRegistration,
  EVENTS_UPDATED_EVENT,
  listOpenEvents,
  searchEventPeople,
} from '../../services/events.api.js';
import EventsPage from '../EventsPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../../../../shared/services/getUserId.js', () => ({
  getUserId: jest.fn(),
}));

jest.mock('../../services/events.api.js', () => {
  const actual = jest.requireActual('../../services/events.api.js');
  return {
    ...actual,
    EVENTS_UPDATED_EVENT: 'wellness-events-updated',
    listOpenEvents: jest.fn(),
    listMyEventRegistrations: jest.fn().mockResolvedValue({ registrations: [] }),
    checkInEventRegistration: jest.fn(),
    searchEventPeople: jest.fn(),
    createEventRegistration: jest.fn(),
  };
});

jest.mock('../../../user/services/profileService.js', () => ({
  fetchProfile: jest.fn(),
}));

jest.mock('../../../user/services/user.api.js', () => ({
  getCachedProfile: jest.fn(() => null),
}));

jest.mock('../../../wallet/services/walletApi.js', () => ({
  fetchWallet: jest.fn(),
}));

jest.mock('../../../user/services/avatarDisplayVersion.js', () => ({
  buildUserAvatarUrl: () => null,
}));

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,qr'),
  },
}));

describe('EventsPage', () => {
  let container;
  let root;
  const event = {
    id: 8,
    eventName: 'Member Wellness Meetup',
    hostName: 'Wellness Team',
    place: 'Community Hall',
    eventDate: '2026-12-10',
    ticketPrice: 125,
    seatCount: 20,
    designatedPersons: [{ userId: 7, name: 'Asha Kumar' }],
    status: 'scheduled',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    getUserId.mockResolvedValue(17);
    listOpenEvents.mockResolvedValue({ events: [event] });
    fetchWallet.mockResolvedValue({ balance: 500 });
    createEventRegistration.mockResolvedValue({
      success: true,
      message: 'Successfully Submitted',
      registration: {
        id: 91,
        entryCode: '4821',
        qrPayload: '8:4821',
        amountCharged: 125,
        paymentStatus: 'paid',
      },
      balanceAfter: 375,
    });
    fetchProfile.mockResolvedValue({
      success: true,
      data: {
        userId: 17,
        userName: 'Logged In User',
        email: 'creator@example.com',
        phoneNumber: '9000000017',
        communityId: 'CLUB-17',
        workingPhysicalCentre: { id: 3, name: 'Adayar' },
        dietType: 'Vegetarian',
        eventTranslation: 'TAMIL',
        eventYourCity: 'CHENNAI',
        eventLevel: 'ASSOCIATE',
      },
    });
    searchEventPeople.mockImplementation(async ({ q }) => {
      const text = String(q || '').toLowerCase();
      const people = [
        { userId: 21, name: 'President Ravi', email: 'ravi@example.com' },
        { userId: 22, name: 'Mill Meena', email: 'meena@example.com' },
        { userId: 23, name: 'Incharge Arun', email: 'arun@example.com' },
        {
          userId: 24,
          name: 'Daicy Devi',
          email: 'devi@example.com',
          uplineLabel: 'Incharge Arun / President Ravi',
        },
      ];
      return people.filter((person) => person.name.toLowerCase().includes(text));
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  const renderPage = async () => {
    await act(async () => {
      root.render(<EventsPage user={{ email: 'creator@example.com' }} />);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const pickMemberBySearch = async (inputId, queryText) => {
    const searchInput = container.querySelector(`#${inputId}`);
    expect(searchInput).not.toBeNull();
    act(() => Simulate.change(searchInput, { target: { value: queryText } }));
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
      await Promise.resolve();
    });
    const selectButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Select'));
    expect(selectButton).not.toBeNull();
    act(() => selectButton.click());
  };

  it('loads open events and completes Next → wallet pay → Successfully Submitted + QR', async () => {
    await renderPage();

    const eventCards = Array.from(container.querySelectorAll('article'));
    expect(eventCards).toHaveLength(1);
    expect(container.textContent).toContain('Member Wellness Meetup');
    expect(container.textContent).toContain('My Bookings');
    expect(getUserId).toHaveBeenCalledWith({ email: 'creator@example.com' });
    expect(listOpenEvents).toHaveBeenCalledWith(17);

    const registerButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.trim() === 'Register');
    act(() => registerButton.click());

    const ticketInput = container.querySelector('input[name="ticketNo"]');
    const attendCitySelect = container.querySelector('select[name="attendCity"]');
    const foodTypeSelect = container.querySelector('select[name="foodType"]');
    expect(ticketInput).not.toBeNull();
    expect(attendCitySelect).not.toBeNull();
    expect(foodTypeSelect).not.toBeNull();
    expect(attendCitySelect.value).toBe('online');
    expect(foodTypeSelect.value).toBe('VEG');
    // Autofill fields stay out of the UI but still go to the backend.
    expect(container.querySelector('select[name="translation"]')).toBeNull();
    expect(container.querySelector('select[name="yourCity"]')).toBeNull();
    expect(container.querySelector('select[name="level"]')).toBeNull();
    expect(container.querySelector('input[name="name"]')).toBeNull();
    expect(container.querySelector('input[name="clubNo"]')).toBeNull();
    expect(container.querySelector('input[name="idNo"]')).toBeNull();

    // Event place remains selectable; Online is the default.
    act(() => Simulate.change(attendCitySelect, { target: { value: 'Community Hall' } }));
    await pickMemberBySearch('event-registration-upline-president', 'President');
    await pickMemberBySearch('event-registration-upline-mill', 'Mill');
    await pickMemberBySearch('event-registration-team-incharge', 'Incharge');
    await pickMemberBySearch('event-registration-daicy-team-incharge', 'Daicy');
    act(() => Simulate.change(ticketInput, { target: { value: 'T-55' } }));

    await act(async () => {
      Simulate.submit(ticketInput.closest('form'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createEventRegistration).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Confirm wallet payment');
    expect(fetchWallet).toHaveBeenCalledWith(17);

    const payButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Pay & submit'));
    expect(payButton).not.toBeNull();
    await act(async () => {
      payButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createEventRegistration).toHaveBeenCalledWith(expect.objectContaining({
      userId: 17,
      eventId: 8,
      confirmPayment: true,
      translation: 'TAMIL',
      foodType: 'VEG',
      yourCity: 'CHENNAI',
      level: 'ASSOCIATE',
      clubNo: 'Adayar',
      idNo: 'CLUB-17',
      name: 'Logged In User',
      ticketNo: 'T-55',
      participantCount: 1,
    }));
    expect(container.textContent).toContain('Successfully Submitted');
    expect(container.textContent).toContain('4821');
    expect(container.textContent).toContain('View in My Bookings');
  });

  it('returns to the loaded event list from the registration form', async () => {
    await renderPage();

    const registerButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Register'));
    act(() => registerButton.click());
    expect(container.querySelector('input[name="ticketNo"]')).not.toBeNull();

    const backButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Back to events'));
    act(() => backButton.click());

    expect(container.querySelectorAll('article')).toHaveLength(1);
    expect(container.querySelector('input[name="ticketNo"]')).toBeNull();
  });

  it('shows an empty state without static events when none have been created', async () => {
    listOpenEvents.mockResolvedValue({ events: [] });
    await renderPage();

    expect(container.querySelectorAll('article')).toHaveLength(0);
    expect(container.textContent).toContain('No events have been created yet.');
  });

  it('refreshes the home event list after an event is changed', async () => {
    listOpenEvents
      .mockResolvedValueOnce({ events: [event] })
      .mockResolvedValueOnce({ events: [] });
    await renderPage();

    await act(async () => {
      window.dispatchEvent(new Event(EVENTS_UPDATED_EVENT));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listOpenEvents).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('article')).toHaveLength(0);
    expect(container.textContent).toContain('No events have been created yet.');
  });
});
