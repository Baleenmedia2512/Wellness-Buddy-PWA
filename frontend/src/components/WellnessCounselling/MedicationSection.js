// src/components/WellnessCounselling/MedicationSection.js
import React from "react";
import { Pill } from "lucide-react";

/**
 * Medication Section Component
 * Captures current medication details
 */
const MedicationSection = ({ medicationDetails, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Pill size={20} className="text-red-600" />
        <h3 className="text-lg font-semibold text-gray-800">Current Medications</h3>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          List any medications you are currently taking
        </label>
        <textarea
          value={medicationDetails || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Example:&#10;• Metformin 500mg - twice daily after meals&#10;• Vitamin D3 - once weekly&#10;• Thyroid medication - morning empty stomach"
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500">
          Include medicine name, dosage, and frequency. Leave blank if not taking any medications.
        </p>
      </div>
    </div>
  );
};

export default MedicationSection;
