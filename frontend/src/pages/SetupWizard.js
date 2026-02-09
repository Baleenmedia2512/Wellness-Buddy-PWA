import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import wellnessValleyIcon from '../assets/wellness-valley-icon.png';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const SetupWizard = ({ onClose, onNavigateToOTP, onLogout }) => {
  // Step 1: Coach Search, Step 2: Team ID
  const [step, setStep] = useState(1); 
  
  // Step 1: Coach Search
  const [searchQuery, setSearchQuery] = useState('');
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [searching, setSearching] = useState(false);
  
  // Step 2: Team ID
  const [teamId, setTeamId] = useState('');
  const [teamIdStatus, setTeamIdStatus] = useState(null); // 'new', 'available', 'taken', 'taken-by-you'
  const [teamIdInfo, setTeamIdInfo] = useState(null); // Store additional info like existingCoach
  const [checkingTeamId, setCheckingTeamId] = useState(false);
  const [claimingTeamId, setClaimingTeamId] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  // General
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Mask email function
  const maskEmail = (email) => {
    if (!email) return '';
    const [username, domain] = email.split('@');
    if (!domain) return email;
    const visibleChars = Math.min(3, Math.floor(username.length / 2));
    const masked = username.substring(0, visibleChars) + '***';
    return `${masked}@${domain}`;
  };

  // Format Team ID as user types (auto-uppercase)
  const formatTeamId = (value) => {
    const cleaned = value.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned.slice(0, 10);
  };

  // Validate Team ID format
  const isValidTeamIdFormat = (id) => {
    return /^[a-zA-Z0-9]{10}$/.test(id);
  };

  // Real-time search with debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setCoaches([]);
      setError('');
      return;
    }

    const delaySearch = setTimeout(() => {
      searchCoaches(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Search coaches
  const searchCoaches = async (query) => {
    setSearching(true);
    setError('');

    try {
      const userEmail = localStorage.getItem('userEmail');
      const response = await axios.get(
        `${API_BASE}/api/users/search?q=${encodeURIComponent(query)}&email=${encodeURIComponent(userEmail || '')}`
      );

      setCoaches(response.data.coaches);
      
      if (response.data.coaches.length === 0) {
        // Don't show error immediately, just empty list
      }
    } catch (err) {
      console.error(err);
      setCoaches([]);
    } finally {
      setSearching(false);
    }
  };

  // Check Team ID availability
  const checkTeamIdAvailability = async () => {
    if (!isValidTeamIdFormat(teamId)) {
      setError('Team ID must be exactly 10 alphanumeric characters');
      setTeamIdStatus(null);
      return;
    }

    setCheckingTeamId(true);
    setError('');

    try {
      const userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        setError('Session expired. Please login again.');
        return;
      }

      const response = await axios.get(
        `${API_BASE}/api/team/check-availability?teamId=${teamId}&email=${encodeURIComponent(userEmail)}`
      );

      setTeamIdStatus(response.data.status);
      setTeamIdInfo(response.data);
      
      if (response.data.status === 'taken-by-you') {
        setSuccess('You already own this ID.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to check Team ID');
      setTeamIdStatus(null);
    } finally {
      setCheckingTeamId(false);
    }
  };

  // Skip Team ID and send request directly
  const skipTeamIdAndSendRequest = async () => {
    if (!selectedCoach) {
      setError('Please select a coach first');
      return;
    }

    setClaimingTeamId(true);
    setSendingRequest(true);
    setError('');

    try {
      const userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        setError('Session expired. Please login again.');
        setClaimingTeamId(false);
        setSendingRequest(false);
        return;
      }

      console.log('Skipping Team ID - Sending approval request:', { coachId: selectedCoach.userId, email: userEmail });

      // Send approval request to coach WITHOUT claiming Team ID
      const requestResponse = await axios.post(
        `${API_BASE}/api/upline/request`,
        { coachId: selectedCoach.userId, email: userEmail }
      );

      console.log('Approval request sent (no Team ID):', requestResponse.data);

      setSuccess(`Request sent!`);
      
      // Navigate to OTP validation after delay
      setTimeout(() => {
        if (onNavigateToOTP) {
          onNavigateToOTP();
        } else if (onClose) {
          onClose();
        }
      }, 1500);
    } catch (err) {
      console.error('Skip setup error:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to send request';
      setError(errorMessage);
      setClaimingTeamId(false);
      setSendingRequest(false);
    }
  };

  // Claim Team ID and send approval request
  const claimTeamIdAndSendRequest = async () => {
    if (!selectedCoach) {
      setError('Please select a coach first');
      return;
    }

    setClaimingTeamId(true);
    setSendingRequest(true);
    setError('');

    try {
      const userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        setError('Session expired. Please login again.');
        setClaimingTeamId(false);
        setSendingRequest(false);
        return;
      }

      console.log('Claiming Team ID:', { teamId, email: userEmail });

      // Step 1: Claim Team ID
      const claimResponse = await axios.post(
        `${API_BASE}/api/team/claim-id`,
        { teamId, email: userEmail }
      );

      console.log('Team ID claimed successfully:', claimResponse.data);

      console.log('Sending approval request:', { coachId: selectedCoach.userId, email: userEmail });

      // Step 2: Send approval request to coach
      const requestResponse = await axios.post(
        `${API_BASE}/api/upline/request`,
        { coachId: selectedCoach.userId, email: userEmail }
      );

      console.log('Approval request sent:', requestResponse.data);

      setSuccess(`Request sent!`);
      
      // Navigate to OTP validation after delay
      setTimeout(() => {
        if (onNavigateToOTP) {
          onNavigateToOTP();
        } else if (onClose) {
          onClose();
        }
      }, 1500);
    } catch (err) {
      console.error('Setup error:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to complete setup';
      setError(errorMessage);
      setClaimingTeamId(false);
      setSendingRequest(false);
    }
  };

  // Auto-check Team ID when user types
  useEffect(() => {
    if (teamId.length === 10 && isValidTeamIdFormat(teamId)) {
      const timer = setTimeout(() => {
        checkTeamIdAvailability();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setTeamIdStatus(null);
    }
  }, [teamId]);

  return (
    <div className="fixed inset-0 z-[9999] bg-green-900/40 backdrop-blur-sm flex items-center justify-center sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-[2rem] shadow-2xl overflow-hidden relative flex flex-col"
      >
        {/* Logout Button */}
        <button 
             onClick={onLogout}
             className="absolute right-4 top-4 z-10 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
             title="Log Out"
        >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>

        <div className="shrink-0">
            {/* Header Icon */}
            <div className="flex justify-center pt-8 pb-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden">
                <img 
                    src={wellnessValleyIcon} 
                    alt="Wellness Valley" 
                    className="w-full h-full object-contain brand-logo"
                    draggable="false"
                    style={{ 
                      WebkitUserSelect: 'none', 
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      WebkitUserDrag: 'none'
                    }}
                />
            </div>
            </div>

            <div className="px-8 text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Wellness Valley</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
                Complete these 2 simple steps to join your team and activate your account.
            </p>
            </div>

            {/* Stepper */}
            <div className="flex justify-center items-center gap-4 mb-8">
                <div className="flex flex-col items-center gap-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= 1 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>1</div>
                    <span className={`text-xs font-bold ${step >= 1 ? 'text-green-600' : 'text-gray-400'}`}>Coach</span>
                </div>
                <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-green-500' : 'bg-gray-200'} mb-4`} />
                <div className="flex flex-col items-center gap-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= 2 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>2</div>
                    <span className={`text-xs font-bold ${step >= 2 ? 'text-green-600' : 'text-gray-400'}`}>Team ID</span>
                </div>
            </div>
        </div>

        <div className="px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  {/* find your coach */}
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Person who invited you for this Program</h3>
                  {/* <p className="text-gray-500 text-sm mb-4">Search for the person who invited you to Wellness Valley. They will be your mentor.</p> */}
                  
                  <div className="relative group">
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-green-500 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/10 transition-all shadow-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      autoFocus
                    />
                    <svg className="absolute left-4 top-4 w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searching && (
                      <div className="absolute right-4 top-4">
                        <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Results or Empty State */}
                <div className="min-h-[80px] mb-4">
                  {coaches.length > 0 ? (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar p-1">
                      {coaches.map((coach) => (
                        <div
                          key={coach.userId}
                          onClick={() => setSelectedCoach(coach)}
                          className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${
                            selectedCoach?.userId === coach.userId
                              ? 'bg-green-50 border-green-500 shadow-md shadow-green-100'
                              : 'bg-white border-gray-100 shadow-sm hover:border-green-200 hover:shadow-md'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            selectedCoach?.userId === coach.userId ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {coach.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 truncate">{coach.userName}</div>
                            <div className="text-xs text-gray-500 truncate">{maskEmail(coach.email)}</div>
                          </div>
                          {selectedCoach?.userId === coach.userId && (
                            <div className="text-green-500 bg-white rounded-full p-1 shadow-sm">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
                        <p>{searchQuery.length > 1 && !searching ? 'No coaches found' : 'Start typing to search...'}</p>
                    </div>
                  )}
                </div>

                {/* Info Box Removed */}

                <button
                  className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                    selectedCoach
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  onClick={() => selectedCoach && setStep(2)}
                  disabled={!selectedCoach}
                >
                  <span>Continue</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Selected Coach Card */}
                <div className="bg-green-50 rounded-xl p-4 flex items-center justify-between mb-8 border border-green-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-green-700 font-bold">
                            {selectedCoach?.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs text-green-600 font-medium">Selected Coach</p>
                            <div className="text-sm font-bold text-gray-900">{selectedCoach?.userName}</div>
                        </div>
                    </div>
                    <button onClick={() => setStep(1)} className="text-green-600 text-sm font-bold hover:text-green-700">
                        Change
                    </button>
                </div>

                <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Create your Team ID <span className="text-xs text-gray-400 font-normal">(Optional)</span></h3>
                    <p className="text-gray-500 text-sm mb-4">This unique ID will identify your personal team structure. You can skip this step.</p>
                    
                    <div className="relative">
                        <input
                        type="text"
                        className={`w-full py-6 bg-gray-50 rounded-xl text-center text-2xl font-mono tracking-widest border-2 focus:ring-0 transition-all ${
                            teamIdStatus === 'new' ? 'border-blue-500 text-blue-700' :
                            teamIdStatus === 'available' ? 'border-green-500 text-green-700' :
                            teamIdStatus === 'taken' ? 'border-red-300 text-red-600' :
                            teamIdStatus === 'taken-by-you' ? 'border-yellow-500 text-yellow-700' :
                            'border-transparent text-gray-500'
                        }`}
                        value={teamId}
                        onChange={(e) => {
                            setTeamId(formatTeamId(e.target.value));
                            setTeamIdStatus(null);
                            setError('');
                        }}
                        placeholder="MYTEAM2025"
                        maxLength={10}
                        />
                        {/* Status Indicator Icon */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {checkingTeamId ? (
                            <div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full"></div>
                        ) : teamIdStatus === 'new' ? (
                            <div className="text-blue-500 bg-blue-100 rounded-full p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                        ) : teamIdStatus === 'available' ? (
                            <div className="text-green-500 bg-green-100 rounded-full p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                        ) : teamIdStatus === 'taken' ? (
                            <div className="text-red-500 bg-red-100 rounded-full p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            </div>
                        ) : teamIdStatus === 'taken-by-you' ? (
                            <div className="text-yellow-500 bg-yellow-100 rounded-full p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                        ) : null}
                        </div>
                    </div>
                    
                    {/* Status Messages */}
                    {teamIdStatus && !error && (
                      <div className="mt-4">
                        {teamIdStatus === 'new' && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3 text-left">
                            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
                                 <span className="text-white text-[10px] font-bold tracking-wider">NEW</span>
                            </div>
                            <div>
                                <h4 className="text-blue-900 font-bold text-sm">This is a new Team ID!</h4>
                                <p className="text-blue-600/80 text-xs font-medium">You'll be the first coach.</p>
                            </div>
                          </div>
                        )}
                        
                        {teamIdStatus === 'available' && teamIdInfo?.existingCoach && (
                          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 shrink-0">
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                </div>
                                <div>
                                    <h4 className="text-green-900 font-bold text-sm">Join as Co-Coach</h4>
                                    <p className="text-green-600/80 text-xs font-medium">There is a coach already.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-green-100 shadow-sm w-full">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                <span className="text-green-800 text-xs font-bold truncate">{teamIdInfo.existingCoach.name}</span>
                            </div>
                          </div>
                        )}
                        
                        {teamIdStatus === 'taken' && (
                          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3 text-left">
                            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-500 shrink-0">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </div>
                            <div>
                                <h4 className="text-red-900 font-bold text-sm">This Team ID is full</h4>
                                <p className="text-red-600/80 text-xs font-medium">Already has 2 coaches.</p>
                            </div>
                          </div>
                        )}
                        
                        {teamIdStatus === 'taken-by-you' && (
                          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 flex items-center gap-3 text-left">
                            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600 shrink-0">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h4 className="text-yellow-900 font-bold text-sm">You own this Team ID</h4>
                                <p className="text-yellow-600/80 text-xs font-medium">This is your current ID.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {error && (
                      <p className="text-red-500 text-xs mt-2 text-center">{error}</p>
                    )}
                    
                    {/* Helper Text */}
                    <div className="mt-3 text-center">
                      <p className="text-gray-400 text-xs">
                        {teamId.length}/10 characters • Letters & Numbers only
                      </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex gap-3">
                        <button
                            className="w-14 py-3.5 rounded-xl font-bold text-base bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all flex items-center justify-center"
                            onClick={() => setStep(1)}
                            aria-label="Back"
                            disabled={claimingTeamId}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                            className={`flex-1 py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                                (teamIdStatus === 'new' || teamIdStatus === 'available') && !claimingTeamId
                                ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={claimTeamIdAndSendRequest}
                            disabled={(teamIdStatus !== 'new' && teamIdStatus !== 'available') || claimingTeamId}
                        >
                            {claimingTeamId ? (
                                <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                <span>Complete Setup</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </>
                            )}
                        </button>
                    </div>
                    
                    {/* Skip Team ID Button */}
                    <button
                        className="w-full py-3 rounded-xl font-semibold text-sm bg-transparent border-2 border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-600 transition-all flex items-center justify-center gap-2"
                        onClick={skipTeamIdAndSendRequest}
                        disabled={claimingTeamId}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>Skip Team ID & Continue</span>
                    </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default SetupWizard;
