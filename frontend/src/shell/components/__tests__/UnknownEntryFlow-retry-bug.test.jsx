/**
 * Test: Unknown→Food retry bug fix (2026-06-09)
 * 
 * Bug: Retry button always shows "Still couldn't recognise it" error even when
 *      AI successfully detects food, because code checks wrong keys.
 * 
 * Root cause: geminiService.analyzeImageForNutrition() returns
 *             { nutrition, detailedItems } but code checks { total, foods }.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/userEvent';
import '@testing-library/jest-dom';
import UnknownEntryFlow from '../UnknownEntryFlow';
import { geminiService } from '../../../shared/services/geminiService';
import { promoteUnknownToFood } from '../../../features/captures';

jest.mock('../../../shared/services/geminiService');
jest.mock('../../../features/captures');

describe('UnknownEntryFlow — Retry bug fix', () => {
  const baseProps = {
    open: true,
    captureId: 'capture-123',
    imageBase64: 'data:image/jpeg;base64,fake',
    canMutate: true,
    userId: 'user-42',
    apiBaseUrl: 'http://localhost:3000',
    onClose: jest.fn(),
    onChanged: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('REPRODUCES BUG: Retry fails when AI returns detailedItems instead of foods', async () => {
    // Simulate successful AI detection (geminiService format)
    geminiService.analyzeImageForNutrition.mockResolvedValue({
      nutrition: { calories: 422, protein: 10, carbs: 64, fat: 14, fiber: 7 },
      detailedItems: [
        { name: 'Dosa', calories: 297, protein: 7, carbs: 48, fat: 9, fiber: 3 },
        { name: 'Sambar', calories: 125, protein: 4, carbs: 16, fat: 5, fiber: 4 }
      ],
      itemCount: 2,
      confidence: 'high'
    });

    const { user } = render(<UnknownEntryFlow {...baseProps} />);
    
    // Click Retry button
    const retryBtn = screen.getByText('Retry');
    await user.click(retryBtn);

    // BUG: Should succeed and call promoteUnknownToFood, but shows error instead
    await waitFor(() => {
      // BEFORE FIX: This assertion PASSES (shows the bug exists)
      expect(screen.getByText(/Still couldn't recognise it/i)).toBeInTheDocument();
      
      // BEFORE FIX: This assertion FAILS
      expect(promoteUnknownToFood).not.toHaveBeenCalled();
    });
  });

  test('AFTER FIX: Retry succeeds when AI returns detailedItems format', async () => {
    geminiService.analyzeImageForNutrition.mockResolvedValue({
      nutrition: { calories: 422, protein: 10, carbs: 64, fat: 14, fiber: 7 },
      detailedItems: [
        { name: 'Dosa', calories: 297, protein: 7, carbs: 48, fat: 9, fiber: 3 },
        { name: 'Sambar', calories: 125, protein: 4, carbs: 16, fat: 5, fiber: 4 }
      ],
      itemCount: 2,
      confidence: 'high'
    });

    promoteUnknownToFood.mockResolvedValue({ ok: true });

    const { user } = render(<UnknownEntryFlow {...baseProps} />);
    
    const retryBtn = screen.getByText('Retry');
    await user.click(retryBtn);

    await waitFor(() => {
      // AFTER FIX: Promotion API is called with transformed data
      expect(promoteUnknownToFood).toHaveBeenCalledWith({
        captureId: 'capture-123',
        viewerUserId: 'user-42',
        analysisResult: {
          foods: [
            { name: 'Dosa', calories: 297, protein: 7, carbs: 48, fat: 9, fiber: 3 },
            { name: 'Sambar', calories: 125, protein: 4, carbs: 16, fat: 5, fiber: 4 }
          ],
          total: { calories: 422, protein: 10, carbs: 64, fat: 14, fiber: 7 },
          confidence: 'high'
        }
      });
      
      // Dialog is closed and parent callback fires
      expect(baseProps.onChanged).toHaveBeenCalled();
    });
  });

  test('Retry still fails correctly when AI returns zero calories', async () => {
    geminiService.analyzeImageForNutrition.mockResolvedValue({
      nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      detailedItems: [
        { name: 'Unknown', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      ],
      itemCount: 1,
      confidence: 'low'
    });

    const { user } = render(<UnknownEntryFlow {...baseProps} />);
    
    const retryBtn = screen.getByText('Retry');
    await user.click(retryBtn);

    await waitFor(() => {
      // Correctly shows error for genuinely unrecognized photos
      expect(screen.getByText(/Still couldn't recognise it/i)).toBeInTheDocument();
      expect(promoteUnknownToFood).not.toHaveBeenCalled();
    });
  });

  test('Retry fails correctly when AI returns empty detailedItems', async () => {
    geminiService.analyzeImageForNutrition.mockResolvedValue({
      nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      detailedItems: [],
      itemCount: 0,
      confidence: 'low'
    });

    const { user } = render(<UnknownEntryFlow {...baseProps} />);
    
    const retryBtn = screen.getByText('Retry');
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/Still couldn't recognise it/i)).toBeInTheDocument();
      expect(promoteUnknownToFood).not.toHaveBeenCalled();
    });
  });
});
