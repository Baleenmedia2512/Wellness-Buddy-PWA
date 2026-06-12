/**
 * Test: Unknown→Food retry bug fix (2026-06-09)
 * 
 * Bug: Retry button always shows "Still couldn't recognise it" error even when
 *      AI successfully detects food, because code checks wrong keys.
 * 
 * Root cause: geminiService.analyzeImageForNutrition() returns
 *             { nutrition, detailedItems } but code checks { total, foods }.
 * 
 * Fix: Use hasRecognizedFood() helper that properly sums calories from detailedItems.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import UnknownEntryFlow from '../UnknownEntryFlow';
import { geminiService } from '../../../shared/services/geminiService';
import { promoteUnknownToFood } from '../../../features/captures';

jest.mock('../../../shared/services/geminiService');
jest.mock('../../../features/captures');
jest.mock('../../../features/nutrition', () => ({
  SmartFoodSearchModal: () => null,
}));
jest.mock('../../../features/weight', () => ({
  ManualWeightEntryModal: () => null,
  saveWeight: jest.fn(),
}));
jest.mock('../../../features/education', () => ({
  ManualEducationEntryModal: () => null,
  saveLog: jest.fn(),
}));

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

  test('REPRODUCES BUG (now fixed): Retry succeeds when AI returns detailedItems', async () => {
    // Simulate successful AI detection (geminiService format)
    geminiService.analyzeImageForNutrition.mockResolvedValue({
      nutrition: { calories: 422, protein: 10, carbs: 64, fat: 14, fiber: 7 },
      detailedItems: [
        { name: 'Dosa', nutrition: { calories: 297, protein: 7, carbs: 48, fat: 9, fiber: 3 } },
        { name: 'Sambar', nutrition: { calories: 125, protein: 4, carbs: 16, fat: 5, fiber: 4 } }
      ],
      itemCount: 2,
      confidence: 'high'
    });

    promoteUnknownToFood.mockResolvedValue({ ok: true });

    render(<UnknownEntryFlow {...baseProps} />);
    
    // Click Retry button
    const retryBtn = screen.getByText('Retry');
    await userEvent.click(retryBtn);

    // AFTER FIX: Promotion API is called successfully
    await waitFor(() => {
      expect(promoteUnknownToFood).toHaveBeenCalled();
      expect(baseProps.onChanged).toHaveBeenCalledWith({ kind: 'food', captureId: 'capture-123' });
    });
  });

  test('Retry transforms Gemini analysis to backend format correctly', async () => {
    geminiService.analyzeImageForNutrition.mockResolvedValue({
      nutrition: { calories: 422, protein: 10, carbs: 64, fat: 14, fiber: 7, sugar: 5, sodium: 320, cholesterol: 15 },
      detailedItems: [
        { 
          name: 'Dosa',
          nutrition: { calories: 297, protein: 7, carbs: 48, fat: 9, fiber: 3, sugar: 2, sodium: 200, cholesterol: 10 }
        },
        { 
          name: 'Sambar',
          nutrition: { calories: 125, protein: 4, carbs: 16, fat: 5, fiber: 4, sugar: 3, sodium: 120, cholesterol: 5 }
        }
      ],
      itemCount: 2,
      confidence: 'high'
    });

    promoteUnknownToFood.mockResolvedValue({ ok: true });

    render(<UnknownEntryFlow {...baseProps} />);
    
    const retryBtn = screen.getByText('Retry');
    await userEvent.click(retryBtn);

    await waitFor(() => {
      // Verify transformation includes all nutrition fields
      const call = promoteUnknownToFood.mock.calls[0][0];
      expect(call.captureId).toBe('capture-123');
      expect(call.viewerUserId).toBe('user-42');
      expect(call.analysisResult.foods).toHaveLength(2);
      expect(call.analysisResult.total.calories).toBe(422);
      expect(call.analysisResult.confidence).toBe('high');
      
      // Dialog is closed and parent callback fires with kind info
      expect(baseProps.onChanged).toHaveBeenCalledWith({ kind: 'food', captureId: 'capture-123' });
    });
  });

  test('Retry fails correctly when AI returns zero calories', async () => {
    geminiService.analyzeImageForNutrition.mockResolvedValue({
      nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      detailedItems: [
        { name: 'Unknown', nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } }
      ],
      itemCount: 1,
      confidence: 'low'
    });

    render(<UnknownEntryFlow {...baseProps} />);
    
    const retryBtn = screen.getByText('Retry');
    await userEvent.click(retryBtn);

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

    render(<UnknownEntryFlow {...baseProps} />);
    
    const retryBtn = screen.getByText('Retry');
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/Still couldn't recognise it/i)).toBeInTheDocument();
      expect(promoteUnknownToFood).not.toHaveBeenCalled();
    });
  });

  test('Retry sums calories from detailedItems when nutrition.calories is missing', async () => {
    geminiService.analyzeImageForNutrition.mockResolvedValue({
      nutrition: { protein: 10, carbs: 64, fat: 14, fiber: 7 }, // Missing calories
      detailedItems: [
        { name: 'Dosa', nutrition: { calories: 297 } },
        { name: 'Sambar', nutrition: { calories: 125 } }
      ],
      confidence: 'high'
    });

    promoteUnknownToFood.mockResolvedValue({ ok: true });

    render(<UnknownEntryFlow {...baseProps} />);
    const retryBtn = screen.getByText('Retry');
    await userEvent.click(retryBtn);

    await waitFor(() => {
      // Should sum 297 + 125 = 422 and proceed with promotion
      expect(promoteUnknownToFood).toHaveBeenCalled();
      const call = promoteUnknownToFood.mock.calls[0][0];
      expect(call.analysisResult.total.calories).toBe(422);
    });
  });
});
