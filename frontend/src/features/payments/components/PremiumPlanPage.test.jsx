/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import PremiumPlanPage from './PremiumPlanPage';

describe('PremiumPlanPage', () => {
  it('shows the 199 plan and Pay Now', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <PremiumPlanPage busy={false} message="" onClose={() => {}} onPayNow={() => {}} />,
      );
    });
    const text = document.body.textContent;
    expect(text).toMatch(/Premium plan/);
    expect(text).toMatch(/₹199/);
    expect(text).toMatch(/Pay Now/);
    act(() => root.unmount());
    container.remove();
  });
});
