import React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import EventsPage from '../EventsPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('EventsPage', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<EventsPage />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('lists sample events and confirms a name-only registration without saving it', () => {
    const eventCards = Array.from(container.querySelectorAll('article'));
    expect(eventCards).toHaveLength(3);
    expect(new Set(eventCards.map((card) => card.className)).size).toBe(3);

    const registerButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Register'));
    act(() => registerButton.click());

    const nameInput = container.querySelector('input[name="name"]');
    expect(nameInput).not.toBeNull();
    expect(container.querySelectorAll('form input')).toHaveLength(1);
    expect(container.querySelectorAll('form select, form textarea')).toHaveLength(0);
    act(() => Simulate.change(nameInput, { target: { value: 'Asha Kumar' } }));
    act(() => Simulate.submit(nameInput.closest('form')));

    expect(container.textContent).toContain('Thank you, Asha Kumar!');
    expect(container.textContent).toContain('Your name has not been saved');
  });

  it('returns to the event cards from the registration form', () => {
    const registerButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Register'));
    act(() => registerButton.click());
    expect(container.querySelector('input[name="name"]')).not.toBeNull();

    const backButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Back to events'));
    act(() => backButton.click());

    expect(container.querySelectorAll('article')).toHaveLength(3);
    expect(container.querySelector('input[name="name"]')).toBeNull();
  });
});
