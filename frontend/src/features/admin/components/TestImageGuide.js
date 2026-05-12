import React from 'react';

const TestImageGuide = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  const testFoods = [
    {
      name: "Clear Food Photos",
      description: "Well-lit, close-up shots work best",
      tips: "Good lighting and focus improve accuracy"
    },
    {
      name: "Single Food Items",
      description: "Individual foods are easier to analyze",
      tips: "Separate complex dishes when possible"
    },
    {
      name: "Multiple Food Recognition",
      description: "AI can detect several foods in one image",
      tips: "Each food will be analyzed separately"
    },
    {
      name: "Common Food Types",
      description: "Fruits, vegetables, proteins, grains",
      tips: "Standard foods have better recognition"
    },
    {
      name: "Prepared Dishes",
      description: "Cooked meals and restaurant foods",
      tips: "AI estimates based on visible ingredient"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-green-700">
              🤖 AI Food Analysis Guide
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h3 className="font-semibold text-blue-700 mb-2">🤖 Using Gemini AI:</h3>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• Advanced computer vision for food recognition</li>
              <li>• Upload clear photos for best results</li>
              <li>• AI identifies multiple foods automatically</li>
              <li>• Calculates nutrition from visual analysis</li>
              <li>• Also supports text-based food queries</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-3">📸 Photo Guidelines:</h3>
            <div className="space-y-3">
              {testFoods.map((food, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">{food.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{food.description}</p>
                  <p className="text-xs text-blue-600 mt-1">💡 {food.tips}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h3 className="font-semibold text-green-700 mb-2">✅ Best Practices:</h3>
            <ul className="text-sm text-green-600 space-y-1">
              <li>• Take photos in natural lighting</li>
              <li>• Position food at center of frame</li>
              <li>• Avoid shadows and reflections</li>
              <li>• Include standard serving sizes when possible</li>
              <li>• Clean, uncluttered backgrounds work best</li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <h3 className="font-semibold text-red-700 mb-2">🚫 Avoid:</h3>
            <ul className="text-sm text-red-600 space-y-1">
              <li>• Blurry or dark photos</li>
              <li>• Food obscured by packaging</li>
              <li>• Extreme close-ups without context</li>
              <li>• Multiple dishes mixed together</li>
              <li>• Non-food items in frame</li>
            </ul>
          </div>

          <div className="bg-purple-50 border  border-emerald-300200 rounded-lg p-3">
            <h3 className="font-semibold text-purple-700 mb-2">🔄 AI Features:</h3>
            <p className="text-sm text-purple-600">
              • Automatic food detection and classification<br />
              • Nutrition estimation based on visual analysis<br />
              • Support for both single and multiple food items<br />
              • Confidence scoring for accuracy assessment
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestImageGuide;
