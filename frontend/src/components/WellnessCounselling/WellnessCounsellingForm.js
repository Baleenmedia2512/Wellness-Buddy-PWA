// src/components/WellnessCounselling/WellnessCounsellingForm.js
import React, { useState } from "react";
import { X, Save, CheckCircle, AlertCircle } from "lucide-react";
import HealthProblemChips from "./HealthProblemChips";
import EatingHabitsSection from "./EatingHabitsSection";
import SleepQualitySection from "./SleepQualitySection";
import MedicationSection from "./MedicationSection";
import TouchFeedbackButton from "../TouchFeedbackButton";

/**
 * Wellness Counselling Form Component
 * Main form for capturing comprehensive wellness assessment data
 */
const WellnessCounsellingForm = ({ isOpen, onClose, user }) => {
  const [selectedHealthProblems, setSelectedHealthProblems] = useState([]);
  const [eatingHabits, setEatingHabits] = useState({
    wakeUpTime: "",
    teaCoffeeTime: "",
    breakfastTime: "",
    lunchTime: "",
    snacksTime: "",
    dinnerTime: "",
    dietType: "",
    waterIntake: "",
  });
  const [sleepData, setSleepData] = useState({
    quality: "",
    duration: "",
  });
  const [medicationDetails, setMedicationDetails] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // For now, just log the data (no backend yet)
      const formData = {
        userId: user?.email,
        healthProblems: selectedHealthProblems,
        eatingHabits,
        sleepData,
        medicationDetails,
        submittedAt: new Date().toISOString(),
      };

      console.log("✅ Wellness Counselling Data:", formData);

      // Show success message
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error("❌ Error saving data:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle form reset
  const handleReset = () => {
    if (window.confirm("Are you sure you want to clear all data?")) {
      setSelectedHealthProblems([]);
      setEatingHabits({
        wakeUpTime: "",
        teaCoffeeTime: "",
        breakfastTime: "",
        lunchTime: "",
        snacksTime: "",
        dinnerTime: "",
        dietType: "",
        waterIntake: "",
      });
      setSleepData({ quality: "", duration: "" });
      setMedicationDetails("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto">
      <div className="min-h-screen w-full flex items-start justify-center p-4 py-8">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl relative">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-t-xl flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold">Wellness Counselling</h2>
              <p className="text-sm text-green-100">
                Initial Assessment Record
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Success Message */}
            {saveSuccess && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                <CheckCircle size={20} />
                <span>Assessment saved successfully!</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {/* User Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Customer Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <span className="ml-2 font-medium">{user?.name || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <span className="ml-2 font-medium">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Health Problems Section */}
            <div className="border-t pt-6">
              <HealthProblemChips
                selectedProblems={selectedHealthProblems}
                onChange={setSelectedHealthProblems}
              />
            </div>

            {/* Eating Habits Section */}
            <div className="border-t pt-6">
              <EatingHabitsSection
                eatingHabits={eatingHabits}
                onChange={setEatingHabits}
              />
            </div>

            {/* Sleep Quality Section */}
            <div className="border-t pt-6">
              <SleepQualitySection
                sleepData={sleepData}
                onChange={setSleepData}
              />
            </div>

            {/* Medication Section */}
            <div className="border-t pt-6">
              <MedicationSection
                medicationDetails={medicationDetails}
                onChange={setMedicationDetails}
              />
            </div>

            {/* Form Actions */}
            <div className="border-t pt-6 flex gap-3">
              <TouchFeedbackButton
                type="button"
                onClick={handleReset}
                variant="outline"
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Clear All
              </TouchFeedbackButton>
              <TouchFeedbackButton
                type="submit"
                disabled={isSaving || selectedHealthProblems.length === 0}
                className={`
                  flex-1 px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2
                  ${
                    isSaving || selectedHealthProblems.length === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700"
                  }
                `}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Save Assessment
                  </>
                )}
              </TouchFeedbackButton>
            </div>

            {selectedHealthProblems.length === 0 && (
              <p className="text-sm text-amber-600 text-center">
                Please select at least one health problem to continue
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default WellnessCounsellingForm;
