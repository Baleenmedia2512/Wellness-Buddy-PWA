// src/components/PrivacyPolicy.js
import React from 'react';

const PrivacyPolicy = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-400 to-teal-400 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Privacy Policy</h2>
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
                This Privacy Policy describes how Wellness Valley ("we," "our," or "us") collects, uses, and protects your personal information when you use our Progressive Web Application and related services.
              </p>
              <p className="mb-4">
                We are committed to protecting your privacy and ensuring transparency about our data practices.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">1. Information We Collect</h3>
              
              <h4 className="font-semibold text-gray-700 mb-2">1.1 Personal Information</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li><strong>Account Information:</strong> Email address, name, profile information</li>
                <li><strong>Authentication Data:</strong> Login credentials, OTP verification data</li>
                <li><strong>Google Account Data:</strong> When you sign in with Google (name, email, profile picture)</li>
              </ul>

              <h4 className="font-semibold text-gray-700 mb-2">1.2 Health and Wellness Data</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li><strong>Food and Nutrition Data:</strong> Food photos, nutritional intake, dietary preferences</li>
                <li><strong>Health Metrics:</strong> Weight, goals, progress tracking data</li>
                <li><strong>Wellness Insights:</strong> Personalized recommendations and analysis</li>
              </ul>

              <h4 className="font-semibold text-gray-700 mb-2">1.3 Technical Information</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li><strong>Device Information:</strong> Device type, operating system, browser type</li>
                <li><strong>Usage Data:</strong> App interactions, feature usage, session duration</li>
                <li><strong>Location Data:</strong> General location (if permitted) for relevant features</li>
                <li><strong>Camera Access:</strong> Food photos for nutritional analysis</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">2. How We Use Your Information</h3>
              
              <h4 className="font-semibold text-gray-700 mb-2">2.1 Primary Services</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Provide personalized nutrition tracking and analysis</li>
                <li>Process and analyze food images using AI technology</li>
                <li>Generate wellness insights and recommendations</li>
                <li>Sync data across your devices</li>
                <li>Maintain and improve app functionality</li>
              </ul>

              <h4 className="font-semibold text-gray-700 mb-2">2.2 Communication</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Send account verification and security notifications</li>
                <li>Provide customer support and respond to inquiries</li>
                <li>Send important updates about our services</li>
                <li>Deliver optional wellness tips and insights (with consent)</li>
              </ul>

              <h4 className="font-semibold text-gray-700 mb-2">2.3 Analytics and Improvement</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Analyze usage patterns to improve our services</li>
                <li>Conduct research to enhance AI accuracy</li>
                <li>Detect and prevent fraud or abuse</li>
                <li>Ensure app security and performance</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">3. Information Sharing and Disclosure</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                <p className="text-blue-800 font-semibold mb-2">We do NOT sell your personal information.</p>
              </div>

              <h4 className="font-semibold text-gray-700 mb-2">3.1 Third-Party Service Providers</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li><strong>Google Services:</strong> Authentication, cloud storage, analytics</li>
                <li><strong>AI/ML Services:</strong> Food image analysis and nutritional data processing</li>
                <li><strong>Cloud Infrastructure:</strong> Secure data storage and app hosting</li>
                <li><strong>Analytics Providers:</strong> App performance and usage analytics</li>
              </ul>

              <h4 className="font-semibold text-gray-700 mb-2">3.2 Legal Requirements</h4>
              <p className="mb-3">
                We may disclose your information when required by law, court order, or to protect our rights, property, or safety, or that of our users or others.
              </p>

              <h4 className="font-semibold text-gray-700 mb-2">3.3 Business Transfers</h4>
              <p className="mb-3">
                In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">4. Data Security</h3>
              <p className="mb-3">We implement industry-standard security measures to protect your information:</p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li><strong>Encryption:</strong> Data encrypted in transit and at rest</li>
                <li><strong>Secure Authentication:</strong> Multi-factor authentication options</li>
                <li><strong>Access Controls:</strong> Limited access to personal data on need-to-know basis</li>
                <li><strong>Regular Security Audits:</strong> Ongoing monitoring and security assessments</li>
                <li><strong>Secure Cloud Infrastructure:</strong> Industry-leading cloud security providers</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">5. Your Privacy Rights and Choices</h3>
              
              <h4 className="font-semibold text-gray-700 mb-2">5.1 Access and Control</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li><strong>Access:</strong> Request access to your personal information</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                <li><strong>Data Portability:</strong> Export your data in a portable format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              </ul>

              <h4 className="font-semibold text-gray-700 mb-2">5.2 App Permissions</h4>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li><strong>Camera:</strong> Required for food photo analysis (can be revoked)</li>
                <li><strong>Storage:</strong> For saving photos and app data locally</li>
                <li><strong>Internet:</strong> For syncing data and AI analysis</li>
                <li><strong>Notifications:</strong> For wellness reminders (optional)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">6. Data Retention</h3>
              <p className="mb-3">We retain your information for as long as necessary to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Provide our services and maintain your account</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes and enforce agreements</li>
                <li>Improve our services through analytics</li>
              </ul>
              <p className="mb-3">
                You may request deletion of your account and associated data at any time through the app settings or by contacting us.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">7. International Data Transfers</h3>
              <p className="mb-3">
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data during such transfers.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">8. Children's Privacy</h3>
              <p className="mb-3">
                Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware of such collection, we will take steps to remove that information.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">9. Cookies and Tracking</h3>
              <p className="mb-3">We use cookies and similar technologies to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1 mb-3">
                <li>Remember your preferences and settings</li>
                <li>Analyze app usage and performance</li>
                <li>Provide personalized experiences</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
              <p className="mb-3">
                You can control cookie preferences through your browser settings, though some features may not function properly if cookies are disabled.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">10. Changes to This Privacy Policy</h3>
              <p className="mb-3">
                We may update this Privacy Policy periodically. We will notify you of any material changes via email or through the app. The updated policy will be effective when posted.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">11. Contact Us</h3>
              <p className="mb-3">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Email:</strong> easy2work.india@gmail.com</p>
                <p><strong>Address:</strong> Easy2Work: No.32, 3rd Cross St, Kasturba Nagar, Adyar, Chennai, Tamil Nadu 600020</p>
                <p><strong>Business Hours:</strong> Monday - Friday, 9:00 AM - 6:00 PM IST</p>
                <p><strong>Response Time:</strong> We aim to respond to privacy inquiries within 72 hours</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-semibold mb-2">Your Trust Matters</p>
              <p className="text-green-700">
                We are committed to protecting your privacy and maintaining the security of your personal information. 
                If you have any concerns or questions, please don't hesitate to reach out to us.
              </p>
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

export default PrivacyPolicy;
