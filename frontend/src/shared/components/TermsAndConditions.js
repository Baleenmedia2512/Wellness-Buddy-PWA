// src/components/TermsAndConditions.js
import React from 'react';

const TermsAndConditions = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-400 to-teal-400 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Terms and Conditions</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-6 text-gray-700">
            
            <div>
              <p className="text-sm text-gray-500 mb-4">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
              </p>
              <p className="mb-4">
                Welcome to Wellness Valley ("we," "our," or "us"). These Terms and Conditions ("Terms") govern your use of our Progressive Web Application (PWA) and related services (collectively, the "Service").
              </p>
              <p className="mb-4">
                By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these terms, you may not access the Service.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">1. Acceptance of Terms</h3>
              <p className="mb-3">
                By downloading, installing, or using the Wellness Valley app, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">2. Description of Service</h3>
              <p className="mb-3">
                Wellness Valley is a health and nutrition tracking application that allows users to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Track food intake and nutritional information</li>
                <li>Analyze food images using AI technology</li>
                <li>Monitor dietary habits and wellness goals</li>
                <li>Access personalized health insights</li>
                <li>Store and sync health data across devices</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">3. User Accounts and Registration</h3>
              <p className="mb-3">
                To use certain features of our Service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">4. Health and Medical Disclaimers</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
                <p className="text-yellow-800 font-semibold mb-2">IMPORTANT HEALTH NOTICE:</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700">
                  <li>Wellness Valley is NOT a medical device or diagnostic tool</li>
                  <li>Information provided is for general wellness purposes only</li>
                  <li>Always consult healthcare professionals for medical advice</li>
                  <li>Do not use our app to diagnose or treat medical conditions</li>
                  <li>Nutritional information may not be 100% accurate</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">5. User Conduct and Prohibited Uses</h3>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Use the Service for any unlawful purpose or prohibited activity</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Upload malicious code, viruses, or harmful content</li>
                <li>Reverse engineer, decompile, or disassemble the app</li>
                <li>Share inappropriate, offensive, or harmful content</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">6. Intellectual Property Rights</h3>
              <p className="mb-3">
                The Service and its original content, features, and functionality are owned by Wellness Valley and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">7. Privacy and Data Protection</h3>
              <p className="mb-3">
                Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">8. Third-Party Services</h3>
              <p className="mb-3">
                Our Service may integrate with third-party services (Google Services, AI APIs, etc.). Your use of such services is subject to their respective terms and conditions.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">9. Limitation of Liability</h3>
              <p className="mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, WELLNESS VALLEY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">10. Disclaimers</h3>
              <p className="mb-3">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">11. Termination</h3>
              <p className="mb-3">
                We may terminate or suspend your account and access to the Service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">12. Changes to Terms</h3>
              <p className="mb-3">
                We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the app. Continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">13. Governing Law</h3>
              <p className="mb-3">
                These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">14. Contact Information</h3>
              <p className="mb-3">
                If you have any questions about these Terms and Conditions, please contact us after:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <p><strong>Email:</strong> easy2work.india@gmail.com</p>
                </div>
                <div>
                  <p><strong>Business Hours:</strong> Monday - Friday, 9:30 AM - 6:00 PM IST</p>
                  <p><strong>Response Time:</strong> We aim to respond to all inquiries within 48 hours during business days</p>
                </div>
                <div>
                  <p><strong>Mailing Address:</strong></p>
                  <p>Easy2Work<br/>
                  2nd Floor, West Wing, 2, Gokul Arcade<br/>
                  Sardar Patel Rd, Adyar<br/>
                  Chennai, Tamil Nadu 600020<br/>
                  India</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-green-400 to-teal-400 text-white rounded-lg hover:from-green-500 hover:to-teal-500 transition-all duration-200 font-medium"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
