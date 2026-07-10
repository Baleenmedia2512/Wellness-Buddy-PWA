import React from 'react';
import { useWellnessScore } from '../hooks/useWellnessScore';
import { useISTToday } from '../hooks/useISTToday';
import WellnessScoreSheet from './WellnessScoreSheet';

/**
 * Full-page wellness score view for members (no configuration UI).
 */
export default function WellnessScorePage({ user, apiBaseUrl, onBack }) {
  const today = useISTToday();
  const { loading, error, data, reload } = useWellnessScore({ user, apiBaseUrl, date: today });

  return (
    <WellnessScoreSheet
      onBack={onBack}
      scoreData={data}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
