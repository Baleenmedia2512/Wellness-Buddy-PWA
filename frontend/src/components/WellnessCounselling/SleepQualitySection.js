// src/components/WellnessCounselling/SleepQualitySection.js
import React from "react";
import { Moon, Clock } from "lucide-react";

/**
 * Sleep Quality Section Component
 * Captures sleep quality and duration
 */
const SleepQualitySection = ({ sleepData, onChange }) => {
  const handleChange = (field, value) => {
    onChange({
      ...sleepData,
      [field]: value,
    });
  };

  const qualityOptions = [
    { value: "poor", label: "Poor 😴", color: "from-red-400 to-red-500" },
    { value: "average", label: "Average 😐", color: "from-yellow-400 to-yellow-500" },
    { value: "good", label: "Good 😊", color: "from-green-400 to-green-500" },
    { value: "excellent", label: "Excellent 😄", color: "from-blue-400 to-blue-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Moon size={20} className="text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-800">Sleep Quality & Duration</h3>
      </div>

      <div className="space-y-4">
        {/* Sleep Quality Selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            How would you rate your sleep quality?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {qualityOptions.map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleChange("quality", value)}
                className={`
                  px-4 py-3 rounded-lg text-sm font-medium transition-all
                  ${
                    sleepData.quality === value
                      ? `bg-gradient-to-r ${color} text-white shadow-lg scale-105`
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sleep Duration */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Average sleep duration
          </label>
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-gray-400" />
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={sleepData.duration || ""}
              onChange={(e) => handleChange("duration", e.target.value)}
              placeholder="7"
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <span className="text-sm text-gray-600">hours per night</span>
          </div>
          <p className="text-xs text-gray-500 ml-7">
            Recommended: 7-9 hours for adults
          </p>
        </div>
      </div>
    </div>
  );
};

export default SleepQualitySection;
