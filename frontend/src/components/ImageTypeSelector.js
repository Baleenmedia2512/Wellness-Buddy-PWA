// src/components/ImageTypeSelector.js
import React from "react";
import { X } from "lucide-react";

/**
 * ImageTypeSelector
 * Shown when the user taps "Enter Manually" after an AI failure.
 * Asks what type of image they uploaded so the right manual entry modal opens.
 */
const ImageTypeSelector = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  const types = [
    {
      id: "food",
      emoji: "🍽️",
      label: "Food",
      description: "Meal, snack or drink",
      color: "orange",
    },
    {
      id: "weight",
      emoji: "⚖️",
      label: "Weight Scale",
      description: "Body weight reading",
      color: "green",
    },
    {
      id: "education",
      emoji: "🎓",
      label: "Education",
      description: "Online meeting screenshot",
      color: "blue",
    },
    {
      id: "smartwatch",
      emoji: "⌚",
      label: "Smartwatch",
      description: "Fitness app or watch data",
      color: "purple",
    },
  ];

  const colorMap = {
    orange:  { bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  hover: "hover:bg-orange-100"  },
    green:   { bg: "bg-green-50",   border: "border-green-300",   text: "text-green-700",   hover: "hover:bg-green-100"   },
    blue:    { bg: "bg-blue-50",    border: "border-blue-300",    text: "text-blue-700",    hover: "hover:bg-blue-100"    },
    purple:  { bg: "bg-purple-50",  border: "border-purple-300",  text: "text-purple-700",  hover: "hover:bg-purple-100"  },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        {/* Header */}
        <div className="relative flex flex-col items-center px-4 pt-5 pb-4 border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-2.5">
            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-800 tracking-tight">What did you upload?</h2>
          <p className="text-xs text-gray-400 mt-0.5">Select the type to enter manually</p>
        </div>

        {/* Type buttons */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {types.map((t) => {
            const c = colorMap[t.color];
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${c.bg} ${c.border} ${c.hover}`}
              >
                <span className="text-3xl">{t.emoji}</span>
                <span className={`text-sm font-bold ${c.text}`}>{t.label}</span>
                <span className="text-xs text-gray-500 text-center leading-tight">{t.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ImageTypeSelector;
