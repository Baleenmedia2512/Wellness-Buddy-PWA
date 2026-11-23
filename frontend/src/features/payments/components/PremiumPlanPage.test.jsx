/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import PremiumPlanPage from './PremiumPlanPage';

describe('PremiumPlanPage', () => {
  it('shows the level quote with GST and Pay Now', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <PremiumPlanPage
          busy={false}
          message=""
          quote={{
            positionCode: 'SV',
            baseAmount: 299,
            gstAmount: 54,
            gstRate: 0.18,
            amount: 353,
          }}
          onClose={() => {}}
          onPayNow={() => {}}
        />,
      );
    });
    const text = document.body.textContent;
    expect(text).toMatch(/Premium plan/);
    expect(text).toMatch(/₹299/);
    expect(text).toMatch(/\+18% GST/);
    expect(text).not.toMatch(/SV/);
    expect(text).not.toMatch(/Community Position/);
    expect(text).toMatch(/Pay Now - ₹353/);
    act(() => root.unmount());
    container.remove();
  });

  it('asks for Community Position when quote is missing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <PremiumPlanPage busy={false} message="" quote={null} onClose={() => {}} onPayNow={() => {}} />,
      );
    });
    const text = document.body.textContent;
    expect(text).toMatch(/Fill Community Position on your profile/);
    expect(text).not.toMatch(/price/i);
    expect(text).not.toMatch(/GST/);
    act(() => root.unmount());
    container.remove();
  });
});
