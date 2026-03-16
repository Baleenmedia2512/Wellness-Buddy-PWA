// src/pages/WellnessCounselling.js
import React, { useState } from "react";
import { FileHeart, Plus, List, ArrowLeft } from "lucide-react";
import WellnessCounsellingForm from "../components/WellnessCounselling/WellnessCounsellingForm";
import TouchFeedbackButton from "../components/TouchFeedbackButton";

/**
 * Wellness Counselling Page
 * Main page for wellness counselling assessments
 */
const WellnessCounselling = ({ user, onBack }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Mock data for previous assessments (will be replaced with real data later)
  const previousAssessments = [
    {
      id: 1,
      date: "2026-03-10",
      healthProblems: ["Diabetes", "Back pain", "Tiredness"],
    },
    {
      id: 2,
      date: "2026-02-15",
      healthProblems: ["Headache", "Acidity", "Constipation"],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        {onBack && (
          <div className="mb-4">
            <TouchFeedbackButton
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back</span>
            </TouchFeedbackButton>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <FileHeart size={32} className="text-green-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              Wellness Counselling
            </h1>
          </div>
          <p className="text-gray-600">
            Comprehensive health assessment and personalized guidance
          </p>
        </div>

        {/* New Assessment Button */}
        <div className="mb-8">
          <TouchFeedbackButton
            onClick={() => setIsFormOpen(true)}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
          >
            <Plus size={24} />
            Start New Assessment
          </TouchFeedbackButton>
        </div>

        {/* Previous Assessments */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <List size={20} className="text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              Previous Assessments
            </h2>
          </div>

          {previousAssessments.length > 0 ? (
            <div className="space-y-3">
              {previousAssessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-600">
                      {new Date(assessment.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-xs text-green-600 font-medium">
                      View Details →
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assessment.healthProblems.map((problem, idx) => (
                      <span
                        key={idx}
                        className="inline-block bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full"
                      >
                        {problem}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileHeart size={48} className="mx-auto mb-3 opacity-30" />
              <p>No previous assessments found.</p>
              <p className="text-sm">Start your first assessment to begin!</p>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            ℹ️ About Wellness Counselling
          </h3>
          <p className="text-sm text-blue-800">
            This comprehensive assessment helps us understand your health conditions,
            daily habits, and lifestyle patterns. Based on this information, we can
            provide personalized dietary recommendations and wellness guidance tailored
            to your specific needs.
          </p>
        </div>
      </div>

      {/* Wellness Counselling Form Modal */}
      <WellnessCounsellingForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        user={user}
      />
    </div>
  );
};

export default WellnessCounselling;
