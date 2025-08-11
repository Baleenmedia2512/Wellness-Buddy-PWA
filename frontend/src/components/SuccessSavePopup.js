import React, { useState, useMemo, useEffect, useRef } from 'react';

// Add custom styles for animations
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
  @keyframes stackExpand {
    from { transform: scale(0.95); opacity: 0.8; }
    to { transform: scale(1); opacity: 1; }
  }
  .animate-stackExpand {
    animation: stackExpand 0.3s ease-out;
  }
  @keyframes gentle-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .animate-gentle-pulse {
    animation: gentle-pulse 2s ease-in-out infinite;
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  .animate-slideOut {
    animation: slideOut 0.3s ease-in-out forwards;
  }
  @keyframes slideOutLeft {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(-100%); opacity: 0; }
  }
  .animate-slideOutLeft {
    animation: slideOutLeft 0.3s ease-in-out forwards;
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('success-popup-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'success-popup-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

const SuccessSavePopup = ({ 
  open, // Deprecated - for backward compatibility
  popups, 
  onClose, 
  onDelete, 
  nutritionData, // Deprecated - for backward compatibility  
  imagePreview // Deprecated - for backward compatibility
}) => {
  const [expandedId, setExpandedId] = useState(null);
  const [isStackExpanded, setIsStackExpanded] = useState(false);
  const [swipeState, setSwipeState] = useState({});
  const [slidingPopups, setSlidingPopups] = useState(new Set());
  const containerRef = useRef(null);

  const toggleExpanded = (id) => {
    // If we're expanding details and the stack is currently collapsed, expand the stack first
    if (!isStackExpanded && expandedId !== id) {
      setIsStackExpanded(true);
    }
    
    const newExpandedId = expandedId === id ? null : id;
    setExpandedId(newExpandedId);
    
    // If we're hiding details and stack is expanded with only one item having details,
    // keep the stack expanded to maintain proper layering
  };

  // Swipe detection logic
  const handleTouchStart = (id, event) => {
    const touch = event.touches[0];
    setSwipeState(prev => ({
      ...prev,
      [id]: {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isSwiping: false
      }
    }));
  };

  const handleTouchMove = (id, event) => {
    const state = swipeState[id];
    if (!state) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine if this is a horizontal swipe
    if (absDeltaX > 10 && absDeltaX > absDeltaY) {
      if (!state.isSwiping) {
        setSwipeState(prev => ({
          ...prev,
          [id]: { ...state, isSwiping: true }
        }));
      }
      
      // Apply real-time transform during swipe
      const element = event.currentTarget;
      const swipeProgress = Math.min(absDeltaX / 150, 1); // 150px for full swipe
      element.style.transform = `translateX(${deltaX}px)`;
      element.style.opacity = 1 - swipeProgress * 0.5;
      
      // Prevent scrolling during horizontal swipe
      event.preventDefault();
    }
  };

  const handleTouchEnd = (id, event) => {
    const state = swipeState[id];
    if (!state) return;

    const deltaX = event.changedTouches[0].clientX - state.startX;
    const absDeltaX = Math.abs(deltaX);
    const swipeThreshold = 100; // Minimum distance for swipe to close

    // Reset transform
    const element = event.currentTarget;
    
    if (state.isSwiping && absDeltaX > swipeThreshold) {
      // Trigger slide out animation
      setSlidingPopups(prev => new Set([...prev, id]));
      element.style.transform = '';
      element.style.opacity = '';
      element.classList.add(deltaX > 0 ? 'animate-slideOut' : 'animate-slideOutLeft');
      
      // Remove popup after animation
      setTimeout(() => {
        onClose(id);
        setSlidingPopups(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 300);
    } else {
      // Reset position
      element.style.transform = '';
      element.style.opacity = '';
    }

    // Clean up swipe state
    setSwipeState(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  // Handle both old single popup mode and new multiple popup mode
  const effectivePopups = useMemo(() => {
    return popups || (open && nutritionData && imagePreview ? [{
      id: 'legacy',
      nutritionData,
      imagePreview,
      timestamp: new Date()
    }] : []);
  }, [popups, open, nutritionData, imagePreview]);

  // Handle clicks outside the popup container to collapse stack
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsStackExpanded(false);
      }
    };

    if (isStackExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isStackExpanded]);

  const handleStackClick = (event) => {
    // Don't expand if clicking on the "View details" button or close button
    const target = event.target;
    const isViewDetailsButton = target.closest('button')?.textContent?.includes('details') || 
                               target.closest('button')?.textContent?.includes('Hide details');
    const isCloseButton = target.closest('button')?.getAttribute('title') === 'Close';
    const isDeleteButton = target.closest('button')?.textContent?.includes('Delete');
    
    // Don't expand if this was part of a swipe gesture
    const anySwipeActive = Object.values(swipeState).some(state => state.isSwiping);
    
    // If someone clicks "View details", don't toggle the stack - let the toggleExpanded handle it
    if (!isViewDetailsButton && !isCloseButton && !isDeleteButton && !anySwipeActive) {
      setIsStackExpanded(!isStackExpanded);
      // Reset any expanded details when collapsing stack
      if (isStackExpanded) {
        setExpandedId(null);
      }
    }
  };

  // Reset expanded details when stack collapses
  const handleCollapseStack = () => {
    setIsStackExpanded(false);
    setExpandedId(null); // Always reset expanded details when collapsing
  };
  

  const renderNutritionDetails = (data) => {
    const { nutrition, category, detailedItems = [] } = data;
  const totalItems = detailedItems.length;

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      {/* Summary Header */}
      <div className="py-3 border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-900">Nutrition Summary</h3>
          </div>
          <span className="text-sm bg-green-100 text-green-600 px-2 py-1 rounded">
            {nutrition.calories} kcal
          </span>
        </div>
      </div>

      {/* Detailed Items */}
      {detailedItems.length > 0 && (
      <div className="p-3 bg-gray-50">
        <h4 className="text-xs font-semibold text-gray-500 mb-2 tracking-wide">
          FOOD ITEMS
        </h4>
        <div className="space-y-2">
          {detailedItems.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              
              {/* Left: Index + Name + Portion */}
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center text-xs font-medium text-gray-600">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-[11px] text-gray-500">{item.portionDescription}</p>
                </div>
              </div>
              
              {/* Right: Calories + Macros */}
              <div className="text-right">
                <p className="font-semibold text-gray-800">{item.calories} kcal</p>
                <p className="text-[11px] text-gray-500">
                  <span className="text-blue-600">{item.protein}P</span> •{" "}
                  <span className="text-orange-600">{item.carbs}C</span> •{" "}
                  <span className="text-yellow-600">{item.fat}F</span> •{" "}
                  <span className="text-green-600">{item.fiber}Fb</span>
                </p>
              </div>

            </div>
          ))}
        </div>
      </div>
    )}

      {/* Nutrition Grid */}
      <div className="grid grid-cols-4 gap-px bg-gray-100">
        <div className="bg-white p-2 text-center">
          <p className="text-xs text-blue-500">Protein</p>
          <p className="font-medium">{nutrition.protein}g</p>
        </div>
        <div className="bg-white p-2 text-center">
          <p className="text-xs text-orange-500">Carbs</p>
          <p className="font-medium">{nutrition.carbs}g</p>
        </div>
        <div className="bg-white p-2 text-center">
          <p className="text-xs text-yellow-500">Fat</p>
          <p className="font-medium">{nutrition.fat}g</p>
        </div>
        <div className="bg-white p-2 text-center">
          <p className="text-xs text-green-500">Fiber</p>
          <p className="font-medium">{nutrition.fiber}g</p>
        </div>
      </div>
      </div>
    );
  };

  const renderPopup = (popupData, id, isSingle = false, index = 0, total = 1) => {
    const isExpanded = expandedId === id;
    
    // Handle both legacy single popup and new multiple popup format
    let data, image;
    if (isSingle) {
      // Legacy single popup mode
      data = nutritionData;
      image = imagePreview;
    } else if (popupData) {
      // New multiple popup mode
      data = popupData.nutritionData;
      image = popupData.imagePreview;
    } else {
      return null;
    }

    // Calculate stacking offsets for true layered effect
    const isTopCard = index === total - 1;
    const stackOffset = total > 1 ? (total - 1 - index) * 2 : 0; // Even tighter stacking
    const scaleOffset = total > 1 ? (total - 1 - index) * 0.01 : 0; // Minimal scale reduction
    const opacityOffset = total > 1 ? Math.max(0.8, 1 - (total - 1 - index) * 0.08) : 1; // Keep cards more visible

    // Show full cards when stack is expanded, or when it's the top card, or when there's only one card
    const showFullCard = isStackExpanded || isTopCard || total === 1;

    // Calculate margin for layered stacking vs expanded view - much tighter when collapsed
    const marginTop = isStackExpanded ? 
      (index === 0 ? 0 : '4px') : // Small gap when expanded
      (index === 0 ? 0 : `-${60 - (total - 1 - index) * 2}px`); // Much tighter overlap when collapsed

    return (
      <div 
        key={id}
        className={`pointer-events-auto w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 ease-out ${
          isExpanded ? 'max-w-md' : ''
        } ${total > 1 ? 'cursor-pointer hover:shadow-xl' : ''} ${
          showFullCard && isStackExpanded && total > 1 ? 'animate-stackExpand' : ''
        }`}
        style={{ 
          transform: isStackExpanded ? 'none' : `translateY(-${stackOffset}px) scale(${1 - scaleOffset})`,
          opacity: showFullCard ? 1 : opacityOffset,
          zIndex: isExpanded ? 1000 + total + 10 : 50 + index, // Higher z-index for expanded details
          marginTop: marginTop,
          pointerEvents: 'auto', // Make all cards clickable
          boxShadow: total > 1 && !isStackExpanded ? 
            `0 ${Math.max(2, 6 - index)}px ${Math.max(4, 12 - index * 2)}px rgba(0, 0, 0, ${Math.max(0.08, 0.15 - index * 0.03)})` : 
            '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        onClick={total > 1 ? handleStackClick : undefined}
        onTouchStart={(e) => handleTouchStart(id, e)}
        onTouchMove={(e) => handleTouchMove(id, e)}
        onTouchEnd={(e) => handleTouchEnd(id, e)}
      >
        <div className="p-3">
          <div className="flex items-start gap-3">
            {/* Image */}
            {image && (
              <img
                src={image}
                alt="Food preview"
                className="w-16 h-16 object-cover rounded-lg border border-gray-100 flex-shrink-0"
              />
            )}
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800 text-sm truncate">
                  {data?.category?.name || 'Food'}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-green-50 text-xs text-green-600 font-medium whitespace-nowrap">
                  ✓ Saved
                </span>
                {/* Stack indicator */}
                {total > 1 && isTopCard && !isStackExpanded && (
                  <span className="px-1.5 py-0.5 rounded-md bg-green-50 text-xs text-green-600 font-medium whitespace-nowrap">
                    +{total - 1} more
                  </span>
                )}
              </div>
              
              {/* Nutrition Info */}
              <div className="text-xs text-gray-500 mb-1.5">
                <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                  <span>{data?.nutrition?.calories || 0} kcal</span>
                  <span>· {data?.nutrition?.protein || 0}g protein</span>
                  <span>· {data?.nutrition?.carbs || 0}g carbs</span>
                  <span>· {data?.nutrition?.fat || 0}g fat</span>
                </div>
              </div>
              
              {/* View Details Link */}
              <button
                onClick={() => toggleExpanded(id)}
                className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors flex items-center gap-1"
              >
                {isExpanded ? 'Hide details' : 'View details'}
                <svg className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Stack expansion hint */}
              {/* {total > 1 && isTopCard && !isStackExpanded && (
                <div className="text-xs text-blue-600 mt-1 opacity-75 animate-gentle-pulse flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                  Tap to expand stack
                </div>
              )} */}
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => isSingle ? onClose() : onClose(id)}
              className="p-1 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0"
              title="Close"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Expanded Details */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {isExpanded && renderNutritionDetails(data)}
          </div>
        </div>
        
        {/* Delete Button - Only visible when expanded */}
        {isExpanded && (
          <div className="px-3 pb-3">
            <button
              onClick={() => isSingle ? onDelete() : onDelete(id)}
              className="w-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  // Single popup mode (legacy)
  if (open && !popups) {
    return (
      <div className="fixed z-50 bottom-4 left-4 right-4 flex justify-center pointer-events-none">
        {renderPopup(null, 'single', true, 0, 1)}
      </div>
    );
  }

  // Stack mode (new multiple popup system)
  if (!effectivePopups || effectivePopups.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed z-50 bottom-4 left-4 right-4 flex justify-center pointer-events-none"
    >
      <div className="relative w-full max-w-sm">
        {/* Render popups in reverse order so the latest is on top */}
        {effectivePopups.map((popup, idx) => 
          renderPopup(popup, popup.id, false, idx, effectivePopups.length)
        )}
        
        {/* Collapse hint when stack is expanded - now clickable */}
        {isStackExpanded && effectivePopups.length > 1 && (
          <div className="text-center mt-2 pointer-events-auto animate-fadeIn">
            <button
              onClick={handleCollapseStack}
              className="inline-flex items-center gap-2 text-xs text-gray-600 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-200/50 hover:bg-gray-50 hover:shadow-xl transition-all duration-200 active:scale-95"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Tap to collapse
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuccessSavePopup;