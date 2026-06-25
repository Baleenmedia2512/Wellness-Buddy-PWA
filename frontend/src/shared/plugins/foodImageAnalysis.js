import { registerPlugin } from '@capacitor/core';

const FoodImageAnalysis = registerPlugin('FoodImageAnalysis');

export async function getQueuedImages() {
  return FoodImageAnalysis.getQueuedImages();
}

export async function markImageProcessed(imagePath) {
  return FoodImageAnalysis.markImageProcessed({ imagePath });
}

export default FoodImageAnalysis;
