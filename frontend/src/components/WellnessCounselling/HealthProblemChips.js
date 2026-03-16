// src/components/WellnessCounselling/HealthProblemChips.js
import React from "react";
import { X } from "lucide-react";

/**
 * Health Problem Chips Component
 * Displays health problems as clickable chips/badges that can be selected/deselected
 */
const HealthProblemChips = ({ selectedProblems, onChange }) => {
  const healthProblems = [
    "Headache",
    "Migraine headache",
    "Vision problem",
    "Oral problem",
    "Dental problem",
    "Breathing problem",
    "Gastric",
    "Acidity",
    "Indigestion",
    "Constipation",
    "Leg pain",
    "Back pain",
    "Shoulder pain",
    "Body pain",
    "Tiredness",
    "Diabetes",
    "Blood pressure",
    "Cholesterol",
    "Thyroid",
  ];

  const toggleProblem = (problem) => {
    if (selectedProblems.includes(problem)) {
      // Remove if already selected
      onChange(selectedProblems.filter((p) => p !== problem));
    } else {
      // Add if not selected
      onChange([...selectedProblems, problem]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Health Problems
        </label>
        <span className="text-xs text-gray-500">
          {selectedProblems.length} selected
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        Tap to select health problems. Selected problems appear in green.
      </p>
      <div className="flex flex-wrap gap-2">
        {healthProblems.map((problem) => {
          const isSelected = selectedProblems.includes(problem);
          return (
            <button
              key={problem}
              type="button"
              onClick={() => toggleProblem(problem)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium
                transition-all duration-200 ease-in-out
                ${
                  isSelected
                    ? "bg-green-500 text-white shadow-md scale-105"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
                active:scale-95
              `}
            >
              <span>{problem}</span>
              {isSelected && <X size={14} strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HealthProblemChips;
