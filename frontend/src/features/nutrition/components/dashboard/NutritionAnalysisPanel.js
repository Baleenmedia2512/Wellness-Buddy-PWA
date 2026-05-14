import React from 'react';
import { Beef, Wheat, Droplet, Leaf } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';
import EditableFoodItem from '../EditableFoodItem';
import StatusOverlay from './StatusOverlay';
import { parseAnalysisData, istToLocalDate } from '../../services/nutritionDashboard/analysisHelpers';

const MacroPill = ({ icon: Icon, value }) => (
  <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
    <Icon className="w-4 h-4 text-white mr-1.5" />
    <span className="text-xs font-medium text-white">{Math.round(value)}g</span>
  </div>
);

const NutritionAnalysisPanel = ({
  selectedMeal,
  isClosingModal,
  isEditing,
  isSaving,
  saveStatus,
  setSaveStatus,
  deletingId,
  localDetailedItems,
  localNutrition,
  resetKey,
  itemRefs,
  editingStates,
  handleEditingChange,
  handleFoodUpdate,
  handleDeleteFoodItem,
  handleRestoreFoodItem,
  handleCloseModal,
  handleDeleteMeal,
  user,
}) => {
  if (!selectedMeal) return null;
  const foodData = parseAnalysisData(selectedMeal.AnalysisData, 'text-white');
  const mealTime = istToLocalDate(selectedMeal.CreatedAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
  const calories = localNutrition.calories || foodData.nutrition.calories || selectedMeal.TotalCalories || 0;
  const protein = localNutrition.protein || foodData.nutrition.protein || selectedMeal.TotalProtein || 0;
  const carbs = localNutrition.carbs || foodData.nutrition.carbs || selectedMeal.TotalCarbs || 0;
  const fat = localNutrition.fat || foodData.nutrition.fat || selectedMeal.TotalFat || 0;
  const fiber = localNutrition.fiber || foodData.nutrition.fiber || selectedMeal.TotalFiber || 0;
  const imgSrc = selectedMeal.ImageBase64 && selectedMeal.ImageBase64.trim() !== ''
    ? (selectedMeal.ImageBase64.startsWith('data:image') ? selectedMeal.ImageBase64 : `data:image/jpeg;base64,${selectedMeal.ImageBase64}`)
    : selectedMeal.ImagePath;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
      onClick={isSaving || saveStatus ? undefined : handleCloseModal}
    >
      <div
        className={`bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transition-all duration-500 ease-in-out ${isClosingModal ? 'animate-slideDown' : 'animate-slideUp'} ${isEditing ? 'max-h-[90vh]' : 'max-h-[80vh]'} relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {saveStatus && <StatusOverlay status={saveStatus} onRetry={() => setSaveStatus(null)} />}

        <div className="relative flex flex-col" style={{ maxHeight: isEditing ? '90vh' : '80vh' }}>
          <div className="relative">
            {imgSrc ? (
              <img src={imgSrc} alt="Meal"
                className={`w-full object-cover transition-all duration-500 ease-in-out ${isEditing ? 'h-48' : 'h-72'}`}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=880&q=80'; }} />
            ) : (
              <div className={`w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ${isEditing ? 'h-48' : 'h-72'}`} />
            )}

            <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-all ${isEditing ? 'p-3 space-y-1' : 'p-5 space-y-3'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className={`font-bold text-white leading-tight ${isEditing ? 'text-lg' : 'text-xl'}`}>{foodData.name}</h2>
                  <p className={`text-white/70 mt-0.5 ${isEditing ? 'text-[10px]' : 'text-xs'}`}>Logged at {mealTime}</p>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-white ${isEditing ? 'text-2xl' : 'text-3xl'}`}>{Math.round(calories)}</span>
                  <span className={`text-white/70 ml-1 ${isEditing ? 'text-[10px]' : 'text-xs'}`}>kcal</span>
                </div>
              </div>
              <div className={`flex flex-wrap gap-2 pt-1 overflow-hidden transition-all ${isEditing ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
                <MacroPill icon={Beef} value={protein} />
                <MacroPill icon={Wheat} value={carbs} />
                <MacroPill icon={Droplet} value={fat} />
                <MacroPill icon={Leaf} value={fiber} />
              </div>
            </div>

            <button onClick={handleCloseModal} disabled={isSaving || saveStatus}
              className={`absolute top-4 right-4 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center border border-white/20 ${isSaving || saveStatus ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/60'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 overflow-y-auto" style={{ maxHeight: isEditing ? '60vh' : '40vh' }}>
            {localDetailedItems?.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">Food Items</h3>
                <div className="space-y-2">
                  {[...localDetailedItems]
                    .map((item, originalIndex) => ({ item, originalIndex, calories: item?.nutrition?.calories || item?.calories || 0 }))
                    .sort((a, b) => b.calories - a.calories)
                    .map(({ item, originalIndex }) => (
                      <div key={`${originalIndex}-${resetKey}`}>
                        <EditableFoodItem
                          ref={(el) => (itemRefs.current[originalIndex] = el)}
                          foodItem={item} index={originalIndex}
                          onUpdate={handleFoodUpdate} onDelete={handleDeleteFoodItem}
                          onRestore={handleRestoreFoodItem} onEditingChange={handleEditingChange}
                          disabled={isEditing && !editingStates[originalIndex]} hideButtons={false} user={user} />
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {!isEditing && (
            <div className="p-4 pt-0">
              <TouchFeedbackButton
                disabled={deletingId === selectedMeal?.ID}
                className={`w-full flex items-center justify-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2 shadow-sm ${deletingId === selectedMeal?.ID ? 'bg-red-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 active:scale-95'}`}
                onClick={() => handleDeleteMeal(selectedMeal)}
              >
                {deletingId === selectedMeal?.ID ? 'Deleting…' : 'Delete'}
              </TouchFeedbackButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NutritionAnalysisPanel;
