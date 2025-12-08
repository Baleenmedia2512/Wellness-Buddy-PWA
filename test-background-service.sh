#!/bin/bash

# Background Service Testing Utility
# Run this script to test various scenarios

echo "🧪 Wellness Valley Background Service Testing"
echo "============================================="

BASE_URL="http://localhost:3000"
TEST_USER_ID="277"

echo ""
echo "📊 1. Database Connection Test"
echo "------------------------------"
curl -s "$BASE_URL/api/test-db" | jq '.'

echo ""
echo "📋 2. Latest Background Analysis Results"
echo "----------------------------------------"
curl -s "$BASE_URL/api/get-background-analysis?userId=$TEST_USER_ID&limit=5" | jq '.data[] | {id: .ID, imagePath: .ImagePath, calories: .TotalCalories, createdAt: .CreatedAt}'

echo ""
echo "👤 3. User Lookup Test"
echo "----------------------"
curl -s -X POST "$BASE_URL/api/lookup-user-id" \
     -H "Content-Type: application/json" \
     -d '{"email": "logeshwaran67677@gmail.com"}' | jq '.'

echo ""
echo "🔍 4. Database Statistics"
echo "-------------------------"
curl -s "$BASE_URL/api/get-background-analysis?userId=$TEST_USER_ID&limit=1000" | jq '{
  total_entries: .pagination.total,
  latest_entry: .data[0].CreatedAt,
  total_calories_today: [.data[] | select(.CreatedAt | startswith("2025-07-28")) | .TotalCalories // 0] | add
}'

echo ""
echo "📱 5. Android Service Status"
echo "-----------------------------"
echo "Run this command to check Android logs:"
echo "adb logcat -s GalleryMonitorService:D DatabaseSyncClient:D RetryQueue:D"

echo ""
echo "✅ Testing Complete!"
echo ""
echo "Next Steps:"
echo "1. Take a food photo on Android device"
echo "2. Wait 5-10 seconds"
echo "3. Run this script again to see new entries"
echo "4. Check Android logs with: adb logcat -s GalleryMonitorService"
