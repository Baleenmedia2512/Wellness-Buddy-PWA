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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={20} className="text-green-600" />
        <h3 className="text-lg font-semibold text-gray-800">Eating Habits</h3>
      </div>

      <div className="space-y-3">
        {timeInputs.map(({ field, label, icon: Icon, placeholder }) => (
          <div key={field} className="flex items-center gap-3">
            <Icon size={18} className="text-gray-400 flex-shrink-0" />
            <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
              {label}
            </label>
            <input
              type="time"
              value={eatingHabits[field] || ""}
              onChange={(e) => handleTimeChange(field, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        ))}

        {/* Veg / Non-Veg Toggle */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-6" /> {/* Spacer for icon alignment */}
          <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
            Diet Type
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTimeChange("dietType", "Vegetarian")}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
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
                px-4 py-2 rounded-lg text-sm font-medium transition-all
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
        <div className="flex items-center gap-3 pt-2">
          <Droplet size={18} className="text-blue-400 flex-shrink-0" />
          <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
            Water Intake
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              min="0"
              max="10"
              value={eatingHabits.waterIntake || ""}
              onChange={(e) => handleTimeChange("waterIntake", e.target.value)}
              placeholder="2.5"
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <span className="text-sm text-gray-600">liters/day</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EatingHabitsSection;
