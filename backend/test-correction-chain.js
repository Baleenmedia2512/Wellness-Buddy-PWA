/**
 * Test Correction Chain Logic
 * Demonstrates how the system handles correction chains
 */

// Simulate correction data
const corrections = [
  { AiDetected: "Juice", UserCorrected: "Milk", UserId: 1, TimesCorrected: 1 },
  { AiDetected: "Milk", UserCorrected: "Tea", UserId: 3, TimesCorrected: 1 },
];

// Build global patterns map (same as in get-user-context.js)
const globalPatternsMap = new Map();
corrections.forEach((row) => {
  const key = `${row.AiDetected}|${row.UserCorrected}`;
  if (!globalPatternsMap.has(key)) {
    globalPatternsMap.set(key, {
      ai_detected: row.AiDetected,
      user_corrected: row.UserCorrected,
      users: new Set(),
      total_corrections: 0,
    });
  }
  const pattern = globalPatternsMap.get(key);
  pattern.users.add(row.UserId);
  pattern.total_corrections += row.TimesCorrected || 1;
});

console.log("📊 Original Corrections:");
globalPatternsMap.forEach((pattern, key) => {
  console.log(`  ${pattern.ai_detected} → ${pattern.user_corrected}`);
});

// Build correction chain map
const correctionChainMap = new Map();
globalPatternsMap.forEach((pattern) => {
  if (!correctionChainMap.has(pattern.ai_detected)) {
    correctionChainMap.set(pattern.ai_detected, []);
  }
  correctionChainMap.get(pattern.ai_detected).push({
    target: pattern.user_corrected,
    total_corrections: pattern.total_corrections,
    user_count: pattern.users.size,
  });
});

// Sort each correction group by priority
correctionChainMap.forEach((corrections, key) => {
  corrections.sort((a, b) => {
    if (b.total_corrections !== a.total_corrections)
      return b.total_corrections - a.total_corrections;
    return b.user_count - a.user_count;
  });
});

// Function to follow correction chain
const followCorrectionChain = (foodName, visited = new Set()) => {
  if (visited.has(foodName)) return foodName;
  visited.add(foodName);

  const corrections = correctionChainMap.get(foodName);
  if (!corrections || corrections.length === 0) return foodName;

  const bestCorrection = corrections[0].target;
  return followCorrectionChain(bestCorrection, visited);
};

console.log("\n🔗 Correction Chains:");
console.log(
  `  Juice → ${followCorrectionChain("Juice")} ✅ (chains through Milk)`,
);
console.log(`  Milk → ${followCorrectionChain("Milk")} ✅`);
console.log(
  `  Tea → ${followCorrectionChain("Tea")} ✅ (no further correction)`,
);

console.log("\n📝 User Flow:");
console.log(
  "  User 1: Uploads image → AI detects 'Juice' → Corrects to 'Milk'",
);
console.log("  User 2: Uploads image → AI detects 'Juice' → Shows 'Milk' ✓");
console.log("  User 3: Sees 'Milk' → Corrects to 'Tea'");
console.log(
  "  User 4: Uploads image → AI detects 'Juice' → Shows 'Tea' ✅ (follows chain!)",
);

console.log("\n🎯 Final Result:");
console.log("  When AI detects 'Juice', system shows: 'Tea'");
