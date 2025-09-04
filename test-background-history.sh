#!/bin/bash

# Test script for Background Analysis History feature
echo "🧪 Testing Background Analysis History API endpoints..."

BASE_URL="http://localhost:3000"

echo ""
echo "1. Testing save background analysis..."
curl -X POST "$BASE_URL/api/save-background-analysis" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "248",
    "imagePath": "/storage/test_apple.jpg",
    "analysisResult": {
      "foods": [{
        "name": "Apple",
        "nutrition": {
          "calories": 95,
          "protein": 0.5,
          "carbs": 25,
          "fat": 0.3,
          "fiber": 4.4
        },
        "confidence": 0.95
      }]
    },
    "deviceInfo": "Test Script"
  }'

echo ""
echo ""
echo "2. Testing get background analysis..."
curl -X GET "$BASE_URL/api/get-background-analysis?userId=248&limit=5"

echo ""
echo ""
echo "3. Testing delete background analysis (this will fail until we have a real ID)..."
curl -X DELETE "$BASE_URL/api/delete-background-analysis" \
  -H "Content-Type: application/json" \
  -d '{"id": 999}'

echo ""
echo ""
echo "✅ Background Analysis History API test complete!"
