// src/pages/PrivacyPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-teal-400 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800">Wellness Valley</h1>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-400 to-teal-400 px-6 py-8">
            <h2 className="text-3xl font-bold text-white">Privacy Policy</h2>
            <p className="text-green-100 mt-2">Your privacy and data security are our top priorities</p>
          </div>

          {/* Privacy Content */}
          <div className="p-8">
            <div className="space-y-6 text-gray-700">
              
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
                </p>
                <p className="mb-4">
                  This Privacy Policy describes how Wellness Valley ("we," "our," or "us") collects, uses, and protects your personal information when you use our Progressive Web Application and related services.
                </p>
                <p className="mb-4">
                  We are committed to protecting your privacy and ensuring transparency about our data practices.
                </p>
              </div>

              {/* Include the same content as the modal version */}
              {/* ... (same content structure as PrivacyPolicy.js) ... */}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
