import React from 'react';
import { useSwipeToDelete } from '../../hooks/useSwipeToDelete';

const MealCard = ({ meal, foodData, mealTime, calories, onDelete, onClick }) => {
  const { dx, dragging, animating, armed, leaving, progress, scale, elRef, handlers } =
    useSwipeToDelete({ onDelete: () => onDelete(meal) });

  return (
    <div
      className="relative w-full"
      style={{ touchAction: dragging ? 'none' : 'pan-y', height: 84 }}
    >
      <div
        aria-hidden
        className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl"
      >
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: progress,
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style={{
              transform: `rotate(${armed ? 10 : 0}deg)`,
              transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)',
              strokeWidth: armed ? 2.2 : 2,
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"
            />
          </svg>
        </div>
      </div>

      <div
        ref={elRef}
        role="button"
        aria-label={`${foodData.name}, ${Math.round(calories)} kilocalories`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (leaving) return;
          if (e.key === 'Backspace' || e.key === 'Delete') handlers.onTouchEnd();
          if (e.key === 'Enter') onClick(meal);
        }}
        {...handlers}
        onClick={() => { if (!dragging && Math.abs(dx) < 5 && !leaving) onClick(meal); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl select-none cursor-pointer overflow-hidden ${leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${dx}px) scale(${scale})`,
          transition: animating
            ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1), box-shadow 180ms ease'
            : 'none',
          minHeight: 76,
          willChange: 'transform',
          boxShadow: `0 10px 30px -10px rgba(0,0,0,${progress * 0.15 + 0.05}), inset 0 0 0 1px rgba(0,0,0,0.05)`,
        }}
      >
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{
            width: `${progress * 100}%`,
            transition: dragging ? 'none' : 'width 180ms ease',
            opacity: progress > 0 ? 1 : 0,
          }}
        />

        <div className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            {meal.ImageBase64 && meal.ImageBase64.trim() !== '' ? (
              <img
                src={meal.ImageBase64.startsWith('data:image')
                  ? meal.ImageBase64
                  : `data:image/jpeg;base64,${meal.ImageBase64}`}
                alt={foodData.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : meal.ImagePath ? (
              <img
                src={meal.ImagePath}
                alt={foodData.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span className="text-2xl">🍽️</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">{foodData.name}</h4>
            <p className="text-sm text-gray-500">{mealTime}</p>
          </div>

          <div className="text-right">
            <p className="font-bold text-lg text-gray-900">{Math.round(calories)}</p>
            <p className="text-[11px] text-gray-500 -mt-0.5 tracking-wide">kcal</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MealCard;
