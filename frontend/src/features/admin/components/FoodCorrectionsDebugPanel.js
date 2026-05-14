import React, { useState, useEffect } from 'react';
import { getUserCorrections } from '../../food-corrections/services/food-corrections.api';
import { getUserContext, formatContextForAI, subscribeToContextUpdates } from '../../../shared/services/userIdentity';
import { geminiService } from '../../../shared/services/geminiService';
import { X, RefreshCw, TrendingUp, Sparkles } from 'lucide-react';
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';
/**
 * Debug panel to view user's food corrections
 * Only visible in development mode
 */
const FoodCorrectionsDebugPanel = ({ userId, isOpen, onClose }) => {
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('corrections'); // 'corrections' | 'context' | 'prompt'
  const [userContext, setUserContext] = useState(null);
  const [lastPrompt, setLastPrompt] = useState(null);
  // Load corrections and context
  const loadData = async (forceRefresh = false) => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Load corrections and user context in parallel
      // Force refresh bypasses cache to get fresh data
      const [correctionsResponse, context] = await Promise.all([
        getUserCorrections(userId),
        getUserContext(userId, forceRefresh)
      ]);
      
      setCorrections(correctionsResponse.data || []);
      setUserContext(context);
      
      if (forceRefresh) {
        console.log('✅ [Debug Panel] Force refreshed context:', context);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when userId changes
  useEffect(() => {
    if (isOpen && userId) {
      loadData();
    }
  }, [isOpen, userId]);
  
  // Subscribe to context updates (from profile edits, food corrections, etc.)
  useEffect(() => {
    if (!isOpen || !userId) return;
    
    const unsubscribe = subscribeToContextUpdates((updatedContext) => {
      console.log('✅ [Debug Panel] Context updated automatically:', updatedContext);
      setUserContext(updatedContext);
      // Also refresh corrections in case food name was corrected
      getUserCorrections(userId).then(response => {
        setCorrections(response.data || []);
      });
    });
    
    // Cleanup subscription when panel closes or userId changes
    return unsubscribe;
  }, [isOpen, userId]);
  
  // Load last prompt when panel opens or when switching to prompt tab
  useEffect(() => {
    if (isOpen && activeTab === 'prompt') {
      const promptData = geminiService.getLastPrompt();
      setLastPrompt(promptData);
      console.log('ðŸ” [Debug Panel] Loaded last prompt:', promptData);
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 md:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm md:text-base font-semibold">AI Personalization</h2>
              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] md:text-xs rounded font-medium">DEV MODE</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (activeTab === 'prompt') {
                    // Refresh prompt
                    const promptData = geminiService.getLastPrompt();
                    setLastPrompt(promptData);
                    console.log('🔄 [Debug Panel] Refreshed prompt:', promptData);
                  } else {
                    // Refresh corrections and context
                    loadData(true);
                  }
                }}
                disabled={loading}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                title={activeTab === 'prompt' ? 'Refresh prompt' : 'Refresh (force fetch new data)'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex border-t">
            <button
              onClick={() => setActiveTab('corrections')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'corrections'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Corrections ({corrections.length})
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'context'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              User Context
            </button>
            <button
              onClick={() => setActiveTab('prompt')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'prompt'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Recent Prompt
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && !corrections.length && !userContext && (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Corrections Tab */}
          {activeTab === 'corrections' && !loading && !error && corrections.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">No corrections yet</p>
              <p className="text-xs mt-1.5">Edit some food names to see them here!</p>
            </div>
          )}

          {activeTab === 'corrections' && corrections.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-600 mb-2 px-1">
                Total: <span className="font-semibold">{corrections.length}</span> correction{corrections.length !== 1 ? 's' : ''}
              </div>

              {corrections.map((correction) => (
                <div
                  key={correction.id}
                  className="bg-gray-50 rounded-md p-2.5 border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-red-600 line-through text-xs md:text-sm truncate">
                          {correction.ai_detected}
                        </span>
                        <span className="text-gray-400 text-xs">→</span>
                        <span className="text-green-600 font-medium text-xs md:text-sm truncate">
                          {correction.user_corrected}
                        </span>
                      </div>
                      <div className="text-[10px] md:text-xs text-gray-500">
                        {istToLocalDate(correction.last_corrected).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium whitespace-nowrap">
                      {correction.times_corrected}×
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* User Context Tab */}
          {activeTab === 'context' && (
            <div className="space-y-3">
              {/* AI Prompt Preview */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-3 border-2 border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-purple-900">AI Context Prompt</h3>
                </div>
                
                {userContext ? (
                  <div className="bg-white rounded-md p-3 border border-purple-200 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {formatContextForAI(userContext) || 'No context available yet'}
                  </div>
                ) : (
                  <div className="text-xs text-purple-600 text-center py-4">
                    No context loaded. Sign in to see your AI context.
                  </div>
                )}
              </div>

              {/* Simplified Stats */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-xs space-y-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-600 font-medium">Personal Corrections:</span>
                    <span className="font-semibold text-blue-600">{userContext?.personalCorrections?.length || 0}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">Your food name corrections that AI learns from</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-600 font-medium">Global Patterns:</span>
                    <span className="font-semibold text-purple-600">{userContext?.globalPatterns?.length || 0}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">Common corrections made by 3+ users</p>
                </div>
                
                {userContext?.dietPreference && userContext.dietPreference !== 'Non-Vegetarian' && (
                  <div className="pt-1 border-t border-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Diet Preference:</span>
                      <span className="font-semibold text-green-600">{userContext.dietPreference}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Info Description */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-blue-600 text-xs font-bold">i</span>
                  </div>
                  <div className="text-xs text-blue-800 leading-relaxed">
                    <p className="font-semibold mb-1">How this prompt is built:</p>
                    <ul className="space-y-0.5 ml-2">
                      <li>• Your <strong>personal corrections</strong> (top 5 by frequency)</li>
                      <li>• Your <strong>diet preference</strong> (if not Non-Vegetarian)</li>
                      <li>• <strong>Global patterns</strong> from 3+ users with same corrections</li>
                    </ul>
                    <p className="mt-1.5 text-blue-700">This context is automatically added to every AI food detection request.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Recent Prompt Tab */}
          {activeTab === 'prompt' && (
            <div className="space-y-3">
              {lastPrompt?.prompt ? (
                <>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                        <span className="text-green-600 text-xs font-bold">✓</span>
                      </div>
                      <div className="text-xs text-green-800">
                        <p className="font-semibold mb-1">Last Sent to Gemini:</p>
                        <p className="text-green-700">
                          {istToLocalDate(lastPrompt.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-green-400">Full Prompt Text</h3>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(lastPrompt.prompt);
                          alert('Prompt copied to clipboard!');
                        }}
                        className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-green-400 text-xs rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words max-h-96 overflow-y-auto font-mono">{lastPrompt.prompt}</pre>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="text-xs text-blue-800">
                      <p className="font-semibold mb-1">📊 Prompt Stats:</p>
                      <ul className="space-y-0.5 ml-2">
                        <li>• Characters: <strong>{lastPrompt.prompt.length.toLocaleString()}</strong></li>
                        <li>• Lines: <strong>{lastPrompt.prompt.split('\n').length}</strong></li>
                        <li>• Approx. Tokens: <strong>~{Math.ceil(lastPrompt.prompt.length / 4)}</strong></li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No prompt sent yet</p>
                  <p className="text-xs mt-1.5">Upload a food image to see the AI prompt!</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t bg-gray-50 text-[10px] md:text-xs text-gray-600 space-y-0.5">
          {activeTab === 'corrections' ? (
            <>
              <p>This panel shows all food name corrections you've made.</p>
              <p>The AI will learn from these corrections to improve future suggestions.</p>
            </>
          ) : activeTab === 'context' ? (
            <>
              <p>User context is injected into Gemini AI prompts to personalize food detection.</p>
              <p>Built from your corrections, diet preference, and common patterns across users.</p>
            </>
          ) : (
            <>
              <p>This shows the exact prompt sent to Gemini AI for the most recent food analysis.</p>
              <p>Includes your personalization context + standard analysis instructions.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodCorrectionsDebugPanel;
