// src/pages/WellnessCounsellingCards.js
import React, { useState, useEffect } from "react";
import { Search, Plus, RefreshCw, FileHeart, Edit2 } from "lucide-react";
import {
  BodyParamsForm,
  BodyParamsShareSheet,
  preloadBodyParamsShareAssets,
  listBodyParamsCards
} from "../features/body-parameters-card";
import { CapacitorHttp } from '@capacitor/core';
import { debugLog } from '../shared/utils/logger.js';
import { format } from 'date-fns';

/**
 * Wellness Counselling - Body Parameters Cards View
 * Shows body parameter cards for team members in a tile/grid layout
 */
const WellnessCounsellingCards = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bodyParamsCards, setBodyParamsCards] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Body Parameters Card states
  const [isBodyParamsFormOpen, setIsBodyParamsFormOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null); // for editing
  const [bodyParamsShareData, setBodyParamsShareData] = useState(null);
  const [bodyParamsPreCapCard, setBodyParamsPreCapCard] = useState(null);

  // Warm share-card images
  useEffect(() => {
    if (!isBodyParamsFormOpen) return;
    preloadBodyParamsShareAssets();
  }, [isBodyParamsFormOpen]);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  const getUserId = async (email) => {
    if (!email) throw new Error("User email is required");
    
    const response = await CapacitorHttp.get({
      url: `${apiBaseUrl}/api/user/lookup?email=${encodeURIComponent(email)}`
    });
    const data = response.data;
    
    if (!data.success) throw new Error(data.message || "User not found");
    return data.userId;
  };

  const fetchData = async (isBackground = false) => {
    if (!user?.email) {
      setError("User information not available. Please log in again.");
      return;
    }

    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const userId = await getUserId(user.email);
      debugLog('📋 [WellnessCounselling] Fetching body params cards for coach:', userId);
      
      const cards = await listBodyParamsCards(userId);
      debugLog('✅ [WellnessCounselling] Fetched cards:', cards.length);
      
      setBodyParamsCards(cards || []);
    } catch (err) {
      console.error("Error fetching cards:", err);
      setError(err.message || "Failed to load body parameter cards.");
    } finally {
      if (!isBackground) setLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleRefresh = () => fetchData(true);

  // Filter cards by search query
  const filteredCards = bodyParamsCards.filter(card => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      card.name?.toLowerCase().includes(query) ||
      card.phoneNumber?.toLowerCase().includes(query)
    );
  });

  const handleEditCard = (card) => {
    setSelectedCard(card);
    setIsBodyParamsFormOpen(true);
  };

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading body parameters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-green-50 to-blue-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Body Parameters</h1>
              <p className="text-xs text-gray-500">{filteredCards.length} Cards</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <FileHeart className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Cards</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => fetchData()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileHeart className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No matching cards' : 'No body parameters yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery
                ? `No cards match "${searchQuery}"`
                : 'Create your first body parameters card using the + button below'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                onClick={() => handleEditCard(card)}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{card.name}</h3>
                      <p className="text-sm text-gray-500">{card.phoneNumber}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCard(card);
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} className="text-gray-400" />
                    </button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-600 font-medium">Height</p>
                      <p className="text-sm font-semibold text-blue-900">{card.heightCm} cm</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-xs text-green-600 font-medium">Weight</p>
                      <p className="text-sm font-semibold text-green-900">{card.weightKg} kg</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2">
                      <p className="text-xs text-purple-600 font-medium">BMI</p>
                      <p className="text-sm font-semibold text-purple-900">{card.bmi}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <p className="text-xs text-orange-600 font-medium">Age</p>
                      <p className="text-sm font-semibold text-orange-900">{card.age} yrs</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <span>{card.gender}</span>
                    <span>{card.recordedDate ? format(new Date(card.recordedDate), 'MMM d, yyyy') : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setSelectedCard(null);
          setIsBodyParamsFormOpen(true);
        }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-green-600 to-green-700 text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Create Body Parameters Card"
      >
        <Plus size={28} />
      </button>

      {/* Body Parameters Card Form */}
      <BodyParamsForm
        isOpen={isBodyParamsFormOpen}
        onClose={() => {
          setIsBodyParamsFormOpen(false);
          setSelectedCard(null);
        }}
        user={user}
        selectedMember={null}
        existingCard={selectedCard}
        onSaveStart={(formData) => {
          setBodyParamsPreCapCard(formData);
        }}
        onSaveSuccess={(card, shareUrl, previousCard) => {
          setIsBodyParamsFormOpen(false);
          setSelectedCard(null);
          
          // Instantly add/update card in the list (optimistic update)
          setBodyParamsCards(prevCards => {
            if (previousCard) {
              // Update existing card
              return prevCards.map(c => c.id === card.id ? card : c);
            } else {
              // Add new card at the beginning
              return [card, ...prevCards];
            }
          });
          
          // Show share sheet immediately
          setBodyParamsShareData({ card, shareUrl, previousCard: previousCard || null });
          
          // Refresh in background to sync with server
          fetchData(true);
        }}
      />

      {/* Body Parameters Share Sheet */}
      <BodyParamsShareSheet
        isOpen={!!bodyParamsShareData}
        onClose={() => {
          setBodyParamsShareData(null);
          setBodyParamsPreCapCard(null);
          // Refresh the list immediately when share sheet closes
          fetchData(true);
        }}
        card={bodyParamsShareData?.card}
        shareUrl={bodyParamsShareData?.shareUrl}
        preCapCard={bodyParamsPreCapCard}
        previousCard={bodyParamsShareData?.previousCard ?? null}
      />
    </div>
  );
};

export default WellnessCounsellingCards;
