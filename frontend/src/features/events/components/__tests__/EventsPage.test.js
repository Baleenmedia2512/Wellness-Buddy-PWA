import React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { getUserId } from '../../../../shared/services/getUserId.js';
import { fetchProfile } from '../../../user/services/profileService.js';
import {
  createEventRegistration,
  EVENTS_UPDATED_EVENT,
  listEvents,
  searchEventPeople,
} from '../../services/events.api.js';
import EventsPage from '../EventsPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../../../../shared/services/getUserId.js', () => ({
  getUserId: jest.fn(),
}));

jest.mock('../../services/events.api.js', () => ({
  EVENTS_UPDATED_EVENT: 'wellness-events-updated',
  listEvents: jest.fn(),
  searchEventPeople: jest.fn(),
  createEventRegistration: jest.fn(),
}));

jest.mock('../../../user/services/profileService.js', () => ({
  fetchProfile: jest.fn(),
}));

jest.mock('../../../user/services/avatarDisplayVersion.js', () => ({
  buildUserAvatarUrl: () => null,
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
    listEvents.mockResolvedValue({ events: [event] });
    createEventRegistration.mockResolvedValue({
      success: true,
      registration: { id: 91 },
    });
    fetchProfile.mockResolvedValue({
      success: true,
      data: {
        userId: 17,
        userName: 'Logged In User',
        email: 'creator@example.com',
        phoneNumber: '9000000017',
        communityId: 'CLUB-17',
        dietType: 'Vegetarian',
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

  it('loads created events and saves registration details', async () => {
    await renderPage();

    const eventCards = Array.from(container.querySelectorAll('article'));
    expect(eventCards).toHaveLength(1);
    expect(container.textContent).toContain('Member Wellness Meetup');
    expect(container.textContent).toContain('Community Hall');
    expect(container.textContent).toContain('Wellness Team');
    expect(container.textContent).not.toContain('Wellness Workshop');
    expect(getUserId).toHaveBeenCalledWith({ email: 'creator@example.com' });
    expect(listEvents).toHaveBeenCalledWith(17);

    const registerButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.trim() === 'Register');
    act(() => registerButton.click());

    const nameInput = container.querySelector('input[name="name"]');
    const translationSelect = container.querySelector('select[name="translation"]');
    const attendCitySelect = container.querySelector('select[name="attendCity"]');
    const foodTypeSelect = container.querySelector('select[name="foodType"]');
    const participantInput = container.querySelector('input[name="participantCount"]');
    expect(nameInput).not.toBeNull();
    expect(translationSelect).not.toBeNull();
    expect(attendCitySelect).not.toBeNull();
    expect(foodTypeSelect).not.toBeNull();
    expect(participantInput).not.toBeNull();
    expect(participantInput.value).toBe('1');
    expect(participantInput.readOnly).toBe(true);
    expect(container.querySelector('#event-registration-upline-president')).not.toBeNull();
    expect(container.querySelector('#event-registration-upline-mill')).not.toBeNull();
    expect(container.querySelector('#event-registration-team-incharge')).not.toBeNull();
    expect(container.querySelector('#event-registration-daicy-team-incharge')).toBeNull();
    const yourCitySelect = container.querySelector('select[name="yourCity"]');
    expect(yourCitySelect).not.toBeNull();
    expect(yourCitySelect.value).toBe('');
    expect(Array.from(yourCitySelect.options).map((option) => option.value)).toEqual([
      '',
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
    ]);
    expect(container.textContent).toContain('Personal Detail');
    expect(container.textContent).toContain('Your City');
    expect(container.textContent).toContain('Team Incharge Detail');
    expect(container.querySelectorAll('form select')).toHaveLength(5);
    expect(Array.from(container.querySelector('select[name="level"]').options).map((option) => option.value)).toEqual([
      '',
      'PC',
      'ASSOCIATE',
      'SV',
      'WT',
      'AWT',
      'GET TEAM',
      '2500 GET TEAM',
      'MILL TEAM',
      'PT',
    ]);
    expect(Array.from(attendCitySelect.options).map((option) => option.value)).toEqual(['', 'Community Hall']);
    expect(Array.from(foodTypeSelect.options).map((option) => option.value)).toEqual([
      '',
      'VEG',
      'NON VEG',
      'VEG & NON VEG',
    ]);

    act(() => Simulate.change(translationSelect, { target: { value: 'TAMIL' } }));
    act(() => Simulate.change(attendCitySelect, { target: { value: 'Community Hall' } }));
    expect(foodTypeSelect.value).toBe('VEG');
    await pickMemberBySearch('event-registration-upline-president', 'President');
    await pickMemberBySearch('event-registration-upline-mill', 'Mill');
    await pickMemberBySearch('event-registration-team-incharge', 'Incharge');
    expect(container.textContent).toContain('Incharge Arun Team Sub Incharge');
    expect(container.querySelector('#event-registration-daicy-team-incharge')).not.toBeNull();
    await pickMemberBySearch('event-registration-daicy-team-incharge', 'Daicy');
    expect(container.querySelector('input[name="clubNo"]').value).toBe('CLUB-17');
    expect(container.querySelector('input[name="zoomEmail"]').value).toBe('creator@example.com');
    expect(nameInput.value).toBe('Logged In User');
    expect(container.querySelector('input[name="idNo"]').value).toBe('17');
    expect(container.querySelector('input[name="phoneNumber"]').value).toBe('9000000017');
    act(() => Simulate.change(container.querySelector('select[name="level"]'), { target: { value: 'ASSOCIATE' } }));
    act(() => Simulate.change(container.querySelector('input[name="ticketNo"]'), { target: { value: 'T-55' } }));
    act(() => Simulate.change(yourCitySelect, { target: { value: 'CHENNAI' } }));
    await act(async () => {
      Simulate.submit(nameInput.closest('form'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createEventRegistration).toHaveBeenCalledWith(expect.objectContaining({
      userId: 17,
      eventId: 8,
      translation: 'TAMIL',
      attendCity: 'Community Hall',
      foodType: 'VEG',
      name: 'Logged In User',
      yourCity: 'CHENNAI',
      ticketNo: 'T-55',
      level: 'ASSOCIATE',
      participantCount: 1,
    }));
    expect(container.textContent).toContain('Thank you, Logged In User!');
    expect(container.textContent).toContain('Your registration has been saved.');
    expect(container.textContent).toContain('Translation: TAMIL');
    expect(container.textContent).toContain('PD Attend City: Community Hall');
    expect(container.textContent).toContain('Food Type: VEG');
    expect(container.textContent).toContain('Upline President Team: President Ravi');
    expect(container.textContent).toContain('Upline Mill Team: Mill Meena');
    expect(container.textContent).toContain('Club No: CLUB-17');
    expect(container.textContent).toContain('Zoom Email: creator@example.com');
    expect(container.textContent).toContain('ID No: 17');
    expect(container.textContent).toContain('Level: ASSOCIATE');
    expect(container.textContent).toContain('Phone: 9000000017');
    expect(container.textContent).toContain('No of Participant: 1');
    expect(container.textContent).toContain('PD Ticket No: T-55');
    expect(container.textContent).toContain('Your City: CHENNAI');
    expect(container.textContent).toContain('Team Incharge: Incharge Arun');
    expect(container.textContent).toContain('Daicy Team Incharge: Daicy Devi + Incharge Arun / President Ravi');
  });

  it('returns to the loaded event list from the registration form', async () => {
    await renderPage();

    const registerButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Register'));
    act(() => registerButton.click());
    expect(container.querySelector('input[name="name"]')).not.toBeNull();

    const backButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Back to events'));
    act(() => backButton.click());

    expect(container.querySelectorAll('article')).toHaveLength(1);
    expect(container.querySelector('input[name="name"]')).toBeNull();
  });

  it('shows an empty state without static events when none have been created', async () => {
    listEvents.mockResolvedValue({ events: [] });
    await renderPage();

    expect(container.querySelectorAll('article')).toHaveLength(0);
    expect(container.textContent).toContain('No events have been created yet.');
    expect(container.textContent).not.toContain('Wellness Workshop');
  });

  it('refreshes the home event list after an event is changed', async () => {
    listEvents
      .mockResolvedValueOnce({ events: [event] })
      .mockResolvedValueOnce({ events: [] });
    await renderPage();

    await act(async () => {
      window.dispatchEvent(new Event(EVENTS_UPDATED_EVENT));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listEvents).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('article')).toHaveLength(0);
    expect(container.textContent).toContain('No events have been created yet.');
  });

});
