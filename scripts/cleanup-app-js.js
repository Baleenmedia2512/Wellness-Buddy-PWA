const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/App.js');
let content = fs.readFileSync(filePath, 'utf8');

const hasCRLF = content.includes('\r\n');
if (hasCRLF) content = content.replace(/\r\n/g, '\n');

const originalLength = content.length;

// 1. Remove state declarations block
content = content.replace(/\n  \/\/ Discipline report state \(for coaches\).*?useMarathon\(\{ userId: user\?\.id \}\);\n/s, '\n');

// 2. Remove Wellness University + Summary reports state
content = content.replace(/\n  \/\/ Wellness University state\n  const \[showWellnessReport.*?const \[reportsInitialMember, setReportsInitialMember\] = useState\(null\);\n/s, '\n');

// 3. Remove Marathon Recognition effects
content = content.replace(/  \/\/ ── Marathon Recognition: fetch on startup.*?}, \[user\?\.id, fetchPendingRecognition\]\); \/\/ eslint-disable-line.*?-- stable deps\n\n/s, '');

// 4. Remove alarm permission effect
content = content.replace(/\n  \/\/ On Android, request exact alarm permission.*?return \(\) => clearTimeout\(t\);\n  }, \[user, permissionsReady\]\);\n/s, '\n');

// 5. Remove openWellnessReportsPage & closeWellnessReportsPage
content = content.replace(/\n  const openWellnessReportsPage = useCallback\(.*?\), \[\],\n  \);\n\n  const closeWellnessReportsPage = useCallback\(\(\) => \{.*?\}, \[\]\);\n/s, '\n');

// 6. Fix showMainPage
content = content.replace("    setShowWellnessReports(false);\n    setShowActivityTimeReport(false);\n    setShowDisciplineReport(false);\n    setShowMarathon(false);\n    // setShowStepCounter(false); // feature disabled\n", '');

// 7. Remove initReminders call
content = content.replace(/\n          \/\/ Initialise personalised native reminders[\s\S]*?}\n          }\n\n          \/\/ Background validation/, '\n\n          // Background validation');

// 8. Remove handleNativeTaskReminderAction callback and effect
content = content.replace(/\n  \/\*\* Native local-notification \/ alarm[\s\S]*?}, \[handleNativeTaskReminderAction\]\);\n/, '\n');

// 9. Remove useDeferredValue declarations
['deferredShowWellnessReports = useDeferredValue(showWellnessReports)',
 'deferredShowDisciplineReport = useDeferredValue(showDisciplineReport)',
 'deferredShowActivityReport = useDeferredValue(showActivityReport)',
 'deferredShowMarathon = useDeferredValue(showMarathon)'].forEach(pat => {
  content = content.replace(new RegExp('\\n  const ' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ';\\n'), '\n');
});
content = content.replace('\n  const deferredShowActivityTimeReport = useDeferredValue(\n    showActivityTimeReport,\n  );\n', '\n');

// 10. Remove WellnessReportsPage render block
content = content.replace(/\n  \/\/ Summary \+ trend reports \(nutrition \/ weight \/ education\)\n  if \(deferredShowWellnessReports\) \{[\s\S]*?\n  \}\n\n  \/\/ Full page dashboard/, '\n\n  // Full page dashboard');

// 11. Remove commented step counter block
content = content.replace(/\n  \/\/ Step Counter page[\s\S]*?\/\/ \}\n\n  \/\/ Reminders/, '\n\n  // Reminders');

// 13. Remove Reminders render block
content = content.replace(/\n  \/\/ Reminders page\n  if \(showReminders\) \{[\s\S]*?\n  \}\n\n  \/\/ Discipline/, '\n\n  // Discipline');

// 14. Remove DisciplineReport render block
content = content.replace(/\n  \/\/ Discipline Report for all users\n  if \(deferredShowDisciplineReport\) \{[\s\S]*?\n  \}\n\n  \/\/ Activity Report/, '\n\n  // Activity Report');

// 15. Remove ActivityReport render block
content = content.replace(/\n  \/\/ Activity Report[\s\S]*?if \(deferredShowActivityReport\) \{[\s\S]*?\n  \}\n\n  \/\/ Activity Time/, '\n\n  // Activity Time');

// 16. Remove ActivityTimeReport render block  
content = content.replace(/\n  \/\/ Activity Time Report\n  if \(deferredShowActivityTimeReport\) \{[\s\S]*?\n  \}\n\n  \/\/ Wellness Counselling/, '\n\n  // Wellness Counselling');

// 17. Remove Marathon Dashboard render block
content = content.replace(/\n  \/\/ Marathon Dashboard[\s\S]*?if \(deferredShowMarathon\) \{[\s\S]*?\n  \}\n\n  \/\/ Main app interface/, '\n\n  // Main app interface');

// 18. Fix back button handler
content = content.replace("      if (showActivityTimeReport) {\n        showMainPage();\n        return true;\n      }\n      if (showDisciplineReport) {\n        showMainPage();\n        return true;\n      }\n      if (showMarathon) {\n        showMainPage();\n        return true;\n      }\n", '');
content = content.replace("      if (showStepCounter) {\n        // setShowStepCounter(false); // feature disabled\n        Session.setCurrentPage(\"main\");\n        return true;\n      }\n", '');
content = content.replace("      !showDashboard &&\n        !showActivityTimeReport &&\n        !showDisciplineReport &&\n        !showMarathon &&\n        !showStepCounter,\n    );", "      !showDashboard,\n    );");
content = content.replace("  }, [\n    ionRouter,\n    showDashboard,\n    showActivityTimeReport,\n    showDisciplineReport,\n    showMarathon,\n    showStepCounter,\n  ]);", "  }, [\n    ionRouter,\n    showDashboard,\n  ]);");

// 19. Fix homeScreenActiveRef effect deps
content = content.replace("      !showActivityTimeReport &&\n      !showDisciplineReport &&\n      !showMarathon;\n  }, [\n    user,\n    authLoading,\n    showDashboard,\n    showCompleteProfile,\n    showActivityTimeReport,\n    showDisciplineReport,\n    showMarathon,\n  ]);", "  }, [\n    user,\n    authLoading,\n    showDashboard,\n    showCompleteProfile,\n  ]);");

// 20. Fix task panel launch effect deps
content = content.replace("      !showActivityTimeReport &&\n      !showDisciplineReport &&\n      !showMarathon;\n\n    if (!isHome", ";\n\n    if (!isHome");
content = content.replace("    showActivityTimeReport,\n    showDisciplineReport,\n    showMarathon,\n    showTaskPanel,", "    showTaskPanel,");

// 21. Remove Header props for deleted features
content = content.replace(/\n          onShowWellnessReports=\{[^\n]*\}\n/, '\n');
content = content.replace("          // onShowStepCounter={showStepCounterPage}   // FEATURE DISABLED\n          onShowReminders={showRemindersPage}\n", '');
content = content.replace(/          onShowDisciplineReport=\{[\s\S]*?          \}\n/, '');
content = content.replace(/          onShowActivityTimeReport=\{[\s\S]*?          \}\n/, '');
content = content.replace(/          onShowActivityReport=\{[\s\S]*?          \}\n/, '');
content = content.replace(/          onShowWellnessEnrollment=\{[\s\S]*?          \}\n/, '');
content = content.replace(/          onShowWellnessReport=\{[\s\S]*?          \}\n/, '');
content = content.replace(/          onShowAttendanceReport=\{[\s\S]*?          \}\n/, '');
content = content.replace(/          onShowMarathon=\{[\s\S]*?          \}\n/, '');

// 22. Remove Attendance Report and WellnessUniversity Report inline blocks
content = content.replace(/\n        \{\/\* Attendance Report \*\/\}\n        \{showAttendanceReport && \([\s\S]*?\)\}\n/, '\n');
content = content.replace(/\n        \{\/\* Wellness University Report \*\/\}\n        \{showWellnessReport && \([\s\S]*?\)\}\n/, '\n');

// Restore CRLF if needed
if (hasCRLF) content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');

console.log('Original:', originalLength, 'New:', content.replace(/\r\n/g, '\n').length);

// Check remaining
const check = content.replace(/\r\n/g, '\n');
const terms = ['showDisciplineReport','showActivityTimeReport','showActivityReport','showStepCounter','showReminders','showAttendanceReport','showMarathon','showWellnessReports','showWellnessReport','fetchPendingRecognition','pendingRecognition','MarathonDashboard','DisciplineReport','ActivityTimeReport','ActivityReport','AttendanceReport','WellnessReportsPage','WellnessUniversityReport','ReminderSettingsPage','initReminders','checkExactAlarmPermission','openWellnessReportsPage','useMarathon'];
console.log('Remaining:');
terms.forEach(t => { const n=(check.match(new RegExp(t,'g'))||[]).length; if(n>0) console.log(' ',t,n+'x'); });
