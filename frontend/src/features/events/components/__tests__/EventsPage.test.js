import React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { getUserId } from '../../../../shared/services/getUserId.js';
import { EVENTS_UPDATED_EVENT, listEvents } from '../../services/events.api.js';
import EventsPage from '../EventsPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../../../../shared/services/getUserId.js', () => ({
  getUserId: jest.fn(),
}));

jest.mock('../../services/events.api.js', () => ({
  EVENTS_UPDATED_EVENT: 'wellness-events-updated',
  listEvents: jest.fn(),
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
    getUserId.mockResolvedValue(17);
    listEvents.mockResolvedValue({ events: [event] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderPage = async () => {
    await act(async () => {
      root.render(<EventsPage user={{ email: 'creator@example.com' }} />);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('loads created events and confirms a name-only registration without saving it', async () => {
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
    expect(nameInput).not.toBeNull();
    expect(container.querySelectorAll('form input')).toHaveLength(1);
    expect(container.querySelectorAll('form select, form textarea')).toHaveLength(0);
    act(() => Simulate.change(nameInput, { target: { value: 'Asha Kumar' } }));
    act(() => Simulate.submit(nameInput.closest('form')));

    expect(container.textContent).toContain('Thank you, Asha Kumar!');
    expect(container.textContent).toContain('it has not been saved');
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
