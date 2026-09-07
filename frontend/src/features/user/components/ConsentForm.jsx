// Full-screen User Consent Form — one page scroll; Agree required to use the app.
import React, { useState } from 'react';
import TermsAndConditions from '../../../shared/components/TermsAndConditions';
import PrivacyPolicy from '../../../shared/components/PrivacyPolicy';
import CustomAlertModal from '../../../shared/components/CustomAlertModal';
import wellnessValleyIcon from '../../../assets/wellness-valley-icon.png';

const BRAND = '#047857';

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-[15px] font-semibold" style={{ color: BRAND }}>{title}</h2>
    <div className="text-[14px] leading-relaxed text-gray-700 space-y-2">{children}</div>
  </section>
);

const ConsentForm = ({
  onAgree,
  onDecline,
  submitting = false,
  mode = 'post-auth',
  identityLabel = '',
}) => {
  const [choice, setChoice] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDisagreeAlert, setShowDisagreeAlert] = useState(false);
  const [localError, setLocalError] = useState('');

  const openDisagreeAlert = () => {
    setLocalError('');
    setShowDisagreeAlert(true);
  };

  /** Stay on consent form and pre-select Agree so they can Continue. */
  const handleRemain = () => {
    setShowDisagreeAlert(false);
    setChoice('agree');
    setLocalError('');
  };

  /** Leave the app → sign out / login (parent onDecline). */
  const handleLeave = () => {
    setShowDisagreeAlert(false);
    onDecline?.();
  };

  const handleContinue = () => {
    setLocalError('');
    if (choice === 'agree') {
      onAgree?.();
      return;
    }
    if (choice === 'disagree') {
      openDisagreeAlert();
      return;
    }
    setLocalError('Please select I Agree or I Don\'t Agree to continue.');
  };

  const linkClass = 'font-medium underline underline-offset-2';
  const linkStyle = { color: BRAND };

  return (
    <div
      className="fixed inset-0 z-[80] bg-white overflow-y-auto overscroll-y-contain"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
      }}
    >
      <div className="max-w-lg mx-auto px-5 pb-8">
        {/* Brand header — matches Login */}
        <div className="text-center pt-2 pb-5">
          <div className="w-20 h-20 mx-auto mb-3 overflow-hidden">
            <img
              src={wellnessValleyIcon}
              alt="Wellness Valley"
              draggable="false"
              className="w-full h-full object-contain brand-logo"
              style={{
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserDrag: 'none',
              }}
            />
          </div>
          <h1 className="text-xl font-bold text-gray-900">User Consent Form</h1>
          <p className="text-sm text-gray-500 mt-1">
            Consent to Collect and Use Personal and Health Information
          </p>
          {identityLabel ? (
            <p className="text-sm font-medium mt-3" style={{ color: BRAND }}>
              Signed in as {identityLabel}
            </p>
          ) : null}
          {mode === 'post-auth' || mode === 'existing-user' ? (
            <p className="text-xs text-gray-500 mt-1">
              Please accept to continue using Wellness Valley.
            </p>
          ) : null}
        </div>

        <div className="h-px w-full mb-5" style={{ backgroundColor: `${BRAND}22` }} />

        {/* Full consent body — page scrolls as one unit (no nested scroll) */}
        <div className="space-y-6 text-[14px] leading-relaxed text-gray-700">
          <p>Please read this carefully before continuing.</p>

          <p>
            Wellness Valley is a wellness and coaching platform that helps you track daily health
            habits including but not limited to food, weight, workout activity and education, and
            may connect you with a coach or wellness programme.
          </p>

          <p>
            By selecting <strong>I Agree</strong>, you consent to Wellness Valley collecting,
            storing, and using your information as described below and in our{' '}
            <button type="button" className={linkClass} style={linkStyle} onClick={() => setShowPrivacy(true)}>
              Privacy Policy
            </button>{' '}
            and{' '}
            <button type="button" className={linkClass} style={linkStyle} onClick={() => setShowTerms(true)}>
              Terms &amp; Conditions
            </button>.
          </p>

          <p>
            By selecting <strong>I Do Not Agree</strong>, you will not be able to use Wellness
            Valley’s health and coaching features.
          </p>

          <p className="font-medium text-gray-900">
            You confirm that you are 18 years of age or older.
          </p>

          <Section title="1. Who collects your information?">
            <p className="font-medium text-gray-900">Wellness Valley Mobile App (Easy2Work)</p>
            <p>Privacy contact: easy2work.india@gmail.com</p>
            <p>
              If you join through a coach or nutrition centre, authorised coaches or programme
              administrators linked to your account may also access relevant information to support
              your programme.
            </p>
          </Section>

          <Section title="2. What information we collect">
            <p className="font-medium text-gray-900">Account information</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name or username</li>
              <li>Email address and/or mobile number</li>
              <li>Profile photo (if you upload one)</li>
              <li>Login and verification details (including OTP by SMS or email)</li>
            </ul>

            <p className="font-medium text-gray-900 pt-1">Health and wellness information</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Height, weight, BMI, and related body measurements (including but not limited to
                body fat, muscle mass, or BMR, where applicable or available)
              </li>
              <li>Weight goals and activity level</li>
              <li>Diet type</li>
              <li>Food diary entries and nutrition estimates</li>
              <li>Water or hydration estimates linked to your logs</li>
              <li>Workout information including but not limited to steps and calories burned</li>
              <li>Education or wellness session logs</li>
              <li>Progress scores generated from your activity in the App</li>
            </ul>

            <p className="font-medium text-gray-900 pt-1">Photos and media</p>
            <p>
              When you use camera feature or gallery feature, we may screen the image and detect
              including but not limited to below listed information and collect:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Food photos</li>
              <li>Weighing-scale photos</li>
              <li>Education or meeting screenshots</li>
              <li>Smartwatch or fitness-app screenshots</li>
              <li>Profile photo</li>
              <li>
                Before-and-after photos or health transformation testimonial videos or photos or
                videos related to your earnings through this coaching business (only if you use
                those features)
              </li>
            </ul>

            <p className="font-medium text-gray-900 pt-1">Location information</p>
            <p>
              If you allow location access on your device, we may collect approximate or precise
              location, city or area details, and nutrition-centre or club attendance when you are
              nearby.
            </p>

            <p className="font-medium text-gray-900 pt-1">
              Counselling or medical details (only if you use those features)
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Health conditions you choose to report</li>
              <li>
                Recovered health issues or similar details you add for testimonials or
                transformation stories
              </li>
            </ul>
          </Section>

          <Section title="3. Why we collect this information and how we use it">
            <p>We use your information to:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Create and manage your account and verify your identity</li>
              <li>Provide tracking, progress dashboards, goals, reminders, and coaching features</li>
              <li>
                Analyse photos you upload so the App can support wellness features (for example,
                estimating nutrition from a food photo or reading a weight from a scale photo)
              </li>
              <li>Calculate goals, progress, and wellness-related scores</li>
              <li>
                Allow your authorised coach or programme administrators to view relevant progress
                information and support you
              </li>
              <li>Record attendance at nutrition centres or clubs when location is available</li>
              <li>
                Improve accuracy and service quality (for example, when you correct food or weight
                information)
              </li>
              <li>Send important service messages such as verification codes</li>
              <li>Operate, secure, and improve the App</li>
              <li>Meet legal requirements where applicable</li>
            </ol>
            <p className="font-medium text-gray-900">
              Wellness Valley does not sell your personal information.
            </p>
          </Section>

          <Section title="4. Artificial intelligence (AI)">
            <p>
              Some images you capture or upload may be analysed using artificial intelligence tools
              provided by trusted technology partners (such as Google Gemini or similar services).
            </p>
            <p>AI may be used to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Identify foods and estimate nutrition from food photos</li>
              <li>Read weight values from scale photos</li>
              <li>Read activity values from fitness screenshots</li>
              <li>Help classify education or session screenshots</li>
            </ul>
            <p>
              AI results may be saved to your account and shown to you and, where applicable, your
              coach.
            </p>
            <p>
              AI estimates may not always be accurate. Please review and correct important
              information when needed.
            </p>
            <p>
              Wellness Valley is a wellness and coaching platform. It is not a medical diagnosis
              service and does not replace advice from a qualified healthcare professional.
            </p>
          </Section>

          <Section title="5. Who may access your information?">
            <ul className="list-disc pl-5 space-y-1">
              <li>You: Your own account and information</li>
              <li>Your sponsor: Relevant progress and programme information to support coaching</li>
              <li>
                Programme administrators / upline managers: Relevant team or programme progress, as
                designed in the App
              </li>
              <li>Platform administrators: Access needed to operate and support the service</li>
              <li>
                Trusted service providers: Only as needed to run the App (for example hosting, SMS
                verification, sign-in, or AI analysis)
              </li>
              <li>
                People you share a link with: Only the shared content, until the link expires
              </li>
            </ul>
            <p>
              Please share links carefully, as anyone with a valid link may view that shared content
              until it expires.
            </p>
          </Section>

          <Section title="6. Storage and retention">
            <p>
              Your information is stored securely using systems and service providers used to
              operate Wellness Valley.
            </p>
            <p>
              We keep your information while your account is active and as needed to provide the
              service, and otherwise as described in our Privacy Policy.
            </p>
            <p>
              You may request deletion of your account through the App or by contacting
              easy2work.india@gmail.com. After deletion, we remove or de-identify personal
              information as described in the Privacy Policy, except where we must retain limited
              information for legal or security reasons.
            </p>
          </Section>

          <Section title="7. Your choices and rights">
            <p>Subject to applicable law and our Privacy Policy, you may:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access and review your information in the App</li>
              <li>Request correction of inaccurate information</li>
              <li>
                Withdraw consent or request account deletion through the App or by contacting us
              </li>
              <li>
                Ask questions about this consent or our Privacy Policy at easy2work.india@gmail.com
              </li>
            </ul>
            <p>
              If you withdraw consent or delete your account, some or all App features may no longer
              be available. This does not affect processing that was already completed lawfully
              before your request.
            </p>
            <p>
              You can also manage device permissions (camera, photos, location, notifications) in
              your device settings. Some features may not work if required permissions are turned
              off.
            </p>
          </Section>

          <Section title="8. Your confirmation">
            <p>By selecting I Agree, you confirm that:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                You have read and understood this Consent Form, and have had the opportunity to
                review our Privacy Policy and Terms &amp; Conditions.
              </li>
              <li>
                You voluntarily consent to Wellness Valley collecting and using your personal
                information and health-related information as described above.
              </li>
              <li>
                You understand that uploaded images may be analysed using AI for wellness features.
              </li>
              <li>
                You understand that authorised coaches or programme administrators may access
                relevant information to support your coaching programme.
              </li>
              <li>The information you provide will be true to the best of your knowledge.</li>
              <li>
                You understand Wellness Valley is a wellness and coaching platform and not a
                substitute for professional medical advice or emergency care.
              </li>
            </ol>
          </Section>
        </div>

        {/* Agreement — part of the same page scroll */}
        <div className="mt-8 pt-6 space-y-3" style={{ borderTop: `1px solid ${BRAND}33` }}>
          <p className="text-[15px] font-semibold text-gray-900">Agreement</p>

          <div className="flex flex-row gap-3 items-stretch">
            <label
              className="flex-1 flex items-start gap-2.5 p-3.5 rounded-2xl border-2 cursor-pointer transition-colors min-w-0"
              style={{
                borderColor: choice === 'disagree' ? BRAND : '#e5e7eb',
                backgroundColor: choice === 'disagree' ? `${BRAND}0D` : '#fff',
              }}
            >
              <input
                type="radio"
                name="consentChoice"
                className="mt-1 shrink-0 accent-[#047857]"
                checked={choice === 'disagree'}
                onChange={() => {
                  setChoice('disagree');
                  openDisagreeAlert();
                }}
                disabled={submitting}
              />
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900 text-sm leading-snug">I Don&apos;t Agree</span>
                <span className="block text-[11px] text-gray-500 mt-1 leading-snug">
                  I do not consent. I understand I will not be able to use Wellness Valley&apos;s health
                  and coaching features.
                </span>
              </span>
            </label>

            <label
              className="flex-1 flex items-start gap-2.5 p-3.5 rounded-2xl border-2 cursor-pointer transition-colors min-w-0"
              style={{
                borderColor: choice === 'agree' ? BRAND : '#e5e7eb',
                backgroundColor: choice === 'agree' ? `${BRAND}0D` : '#fff',
              }}
            >
              <input
                type="radio"
                name="consentChoice"
                className="mt-1 shrink-0 accent-[#047857]"
                checked={choice === 'agree'}
                onChange={() => setChoice('agree')}
                disabled={submitting}
              />
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900 text-sm leading-snug">I Agree</span>
                <span className="block text-[11px] text-gray-500 mt-1 leading-snug">
                  I consent to the collection and use of my information as described in this form.
                </span>
              </span>
            </label>
          </div>

          {localError ? (
            <p className="text-sm text-red-600" role="alert">{localError}</p>
          ) : null}

          <button
            type="button"
            onClick={handleContinue}
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl text-white font-semibold shadow-sm disabled:opacity-60 active:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            {submitting ? 'Please wait…' : 'Continue'}
          </button>
        </div>
      </div>

      {showTerms && <TermsAndConditions onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}

      <CustomAlertModal
        isOpen={showDisagreeAlert}
        onClose={handleRemain}
        title="Leave or continue?"
        type="warning"
        cancelText="Leave"
        confirmText="Stay and Agree"
        onCancel={handleLeave}
        onConfirm={handleRemain}
        message={
          'You need to agree to continue using Wellness Valley.\n\nIf you leave, you\'ll be signed out and returned to the login screen.'
        }
      />
    </div>
  );
};

export default ConsentForm;
