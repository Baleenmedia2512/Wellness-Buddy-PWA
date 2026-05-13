/**
 * HealthProblemSection.js — presentational section.
 * Composes the HealthProblemChips primitive into a labelled form section.
 * Pure render — no state, no validation.
 */
import React from 'react';
import HealthProblemChips from '../components/HealthProblemChips';

export default function HealthProblemSection({ selectedProblems, onChange }) {
  return (
    <HealthProblemChips selectedProblems={selectedProblems} onChange={onChange} />
  );
}
