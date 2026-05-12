// src/components/WellnessCounselling/EatingHabitsSection.js
import React from "react";
import { Clock, Coffee, Sunrise, Sun, Cookie, Moon, Droplet } from "lucide-react";

/**
 * Eating Habits Section Component
 * Captures daily food intake timeline and dietary preferences
 */
const EatingHabitsSection = ({ eatingHabits, onChange }) => {
  const handleTimeChange = (field, value) => {
    onChange({
      ...eatingHabits,
      [field]: value,
    });
  };

  const timeInputs = [
    { field: "wakeUpTime", label: "Wake-up time", icon: Sunrise, placeholder: "08:00 AM" },
    { field: "teaCoffeeTime", label: "Tea / Coffee", icon: Coffee, placeholder: "08:30 AM" },
    { field: "breakfastTime", label: "Breakfast", icon: Sun, placeholder: "09:00 AM" },
    { field: "lunchTime", label: "Lunch", icon: Sun, placeholder: "01:00 PM" },
    { field: "snacksTime", label: "Snacks", icon: Cookie, placeholder: "05:00 PM" },
    { field: "dinnerTime", label: "Dinner", icon: Moon, placeholder: "08:00 PM" },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={18} className="text-green-600 sm:w-5 sm:h-5" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-800">Eating Habits</h3>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {timeInputs.map(({ field, label, icon: Icon, placeholder }) => (
          <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Icon size={16} className="text-gray-400 flex-shrink-0 sm:w-[18px] sm:h-[18px]" />
              <label className="text-xs sm:text-sm font-medium text-gray-700 sm:w-32 sm:flex-shrink-0">
                {label}
              </label>
            </div>
            <input
              type="time"
              value={eatingHabits[field] || ""}
              onChange={(e) => handleTimeChange(field, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        ))}

        {/* Veg / Non-Veg Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 pt-1 sm:pt-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-4 sm:w-6" /> {/* Spacer for icon alignment */}
            <label className="text-xs sm:text-sm font-medium text-gray-700 sm:w-32 sm:flex-shrink-0">
              Diet Type
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTimeChange("dietType", "Vegetarian")}
              className={`
                px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all
                ${
                  eatingHabits.dietType === "Vegetarian"
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
            >
              🥗 Vegetarian
            </button>
            <button
              type="button"
              onClick={() => handleTimeChange("dietType", "Non-Vegetarian")}
              className={`
                px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all
                ${
                  eatingHabits.dietType === "Non-Vegetarian"
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
            >
              🍗 Non-Vegetarian
            </button>
          </div>
        </div>

        {/* Water Intake */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 pt-1 sm:pt-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Droplet size={16} className="text-blue-400 flex-shrink-0 sm:w-[18px] sm:h-[18px]" />
            <label className="text-xs sm:text-sm font-medium text-gray-700 sm:w-32 sm:flex-shrink-0">
              Water Intake
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              min="0"
              max="10"
              value={eatingHabits.waterIntake || ""}
              onChange={(e) => handleTimeChange("waterIntake", e.target.value)}
              placeholder="2.5"
              className="w-20 sm:w-24 px-2.5 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <span className="text-xs sm:text-sm text-gray-600">liters/day</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EatingHabitsSection;
