/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import BroadcastPage from './BroadcastPage';

function renderPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<BroadcastPage />);
  });
  return {
    container,
    click(selector) {
      const node = container.querySelector(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      act(() => {
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('BroadcastPage', () => {
  it('shows the how-to and opens payment without upload or Burst', () => {
    const view = renderPage();
    expect(view.container.textContent).toMatch(/BroadCast/);
    expect(view.container.querySelector('[aria-label="How to use BroadCast"]')).not.toBeNull();
    expect(view.container.querySelector('[aria-label="Burst"]')).toBeNull();
    expect(view.container.querySelector('input[type="file"]')).toBeNull();

    view.click('[aria-label="Make a payment"]');

    expect(view.container.textContent).toMatch(/Make a payment/);
    expect(view.container.textContent).toMatch(/Nothing is charged from this screen yet/);
    expect(view.container.querySelector('input[type="file"]')).toBeNull();
    expect(view.container.querySelector('[aria-label="Burst"]')).toBeNull();
    view.unmount();
  });

  it('returns to the how-to from the payment screen', () => {
    const view = renderPage();
    view.click('[aria-label="Make a payment"]');
    view.click('button');
    expect(view.container.querySelector('[aria-label="Make a payment"]')).not.toBeNull();
    view.unmount();
  });
});
