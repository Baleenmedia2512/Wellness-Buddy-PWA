"""
fix_weight_capture_duplication.py
==================================
Run this script inside the frontend/src/ directory of any copy of the codebase
that still has duplicate weight state declarations after the useWeightCapture
hook extraction.

Problem: App.js has BOTH
  1. const { weightResult, ... } = useWeightCapture(...)   ← new hook call
  2. const [weightResult, setWeightResult] = useState(...) ← old declaration
causing "Identifier 'weightResult' has already been declared" at build time.

This script removes group #2 (the old inline declarations).

Usage (from frontend/src/):
    python fix_weight_capture_duplication.py

Or specify a custom path:
    python fix_weight_capture_duplication.py path/to/App.js
"""
import sys, os

APPJS = sys.argv[1] if len(sys.argv) > 1 else "App.js"
if not os.path.exists(APPJS):
    print(f"ERROR: {APPJS} not found. Run from frontend/src/ or pass the path as argument.")
    sys.exit(1)

LF = b"\r\n"
with open(APPJS, "rb") as fh:
    raw = fh.read()
lines = raw.split(LF)
print(f"[fix] Loaded {APPJS}: {len(lines)} lines")

def find(arr, pattern, start=0):
    p = pattern.encode() if isinstance(pattern, str) else pattern
    for i, l in enumerate(arr[start:], start):
        if p in l:
            return i
    return -1

def trim_jsdoc_backward(arr, i):
    """Walk backward past blank lines and JSDoc comment blocks."""
    while i >= 0:
        s = arr[i].strip()
        if not s or s.startswith(b"*") or s.startswith(b"/*"):
            i -= 1
        else:
            break
    return i

# ── 1. Locate and verify hook call exists ────────────────────────────────
hook_line = find(lines, "} = useWeightCapture({")
if hook_line == -1:
    print("[fix] ERROR: useWeightCapture hook call not found.")
    print("       Has the hook call been added to App.js yet?")
    sys.exit(1)
print(f"[fix] Hook call found at line {hook_line+1}")

# ── 2. Remove weight state group 1 (weightResult … showWeightProgressModal)
sg1_s = find(lines, "const [weightResult, setWeightResult]")
sg1_e = find(lines, "const [showWeightProgressModal", sg1_s if sg1_s != -1 else 0)

if sg1_s == -1:
    print("[fix] Group 1 (weightResult block) not found — already removed.")
elif sg1_s > hook_line:
    print(f"[fix] WARNING: weightResult (line {sg1_s+1}) is AFTER the hook call ({hook_line+1}). Skipping.")
else:
    print(f"[fix] Removing group 1: lines {sg1_s+1}–{sg1_e+1} ({sg1_e-sg1_s+1} lines)")
    lines = lines[:sg1_s] + lines[sg1_e+1:]
    # Recalculate hook_line since we removed lines above it
    hook_line = find(lines, "} = useWeightCapture({")
    print(f"[fix]   Hook call now at line {hook_line+1}")

# ── 3. Remove weight state group 2 (showDuplicateWeightModal … pendingWeightSaveData)
sg2_s = find(lines, "const [showDuplicateWeightModal")
sg2_e = find(lines, "const [pendingWeightSaveData", sg2_s if sg2_s != -1 else 0)

if sg2_s == -1:
    print("[fix] Group 2 (duplicate modal state) not found — already removed.")
elif sg2_s > hook_line:
    print(f"[fix] WARNING: showDuplicateWeightModal (line {sg2_s+1}) is after hook call. Skipping.")
else:
    print(f"[fix] Removing group 2: lines {sg2_s+1}–{sg2_e+1} ({sg2_e-sg2_s+1} lines)")
    lines = lines[:sg2_s] + lines[sg2_e+1:]
    hook_line = find(lines, "} = useWeightCapture({")

# ── 4. Remove lastWeight if still declared
lw_i = find(lines, "const [lastWeight, setLastWeight]")
if lw_i == -1:
    print("[fix] lastWeight not found — already removed.")
elif lw_i > hook_line:
    print(f"[fix] WARNING: lastWeight (line {lw_i+1}) is after hook call. Skipping.")
else:
    print(f"[fix] Removing lastWeight at line {lw_i+1}")
    lines = lines[:lw_i] + lines[lw_i+1:]
    hook_line = find(lines, "} = useWeightCapture({")

# ── 5. Remove useWeightProgressCheck import (now internal to hook)
uwpc_i = find(lines, "import { useWeightProgressCheck }")
if uwpc_i == -1:
    print("[fix] useWeightProgressCheck import not found — already removed.")
else:
    print(f"[fix] Removing useWeightProgressCheck import at line {uwpc_i+1}")
    lines = lines[:uwpc_i] + lines[uwpc_i+1:]
    hook_line = find(lines, "} = useWeightCapture({")

# ── 6. Remove function bodies if still present (before hook call)
funcs_to_remove = [
    "const triggerReverseProgressModal = async",
    "const performWeightSave = async",
    "const handleWeightEditSave = async",
    "const saveWeightEntry = async",
    "const fetchLastWeight = async",
]
for func_name in funcs_to_remove:
    fi = find(lines, func_name)
    if fi == -1:
        print(f"[fix] {func_name.split('=')[0].strip()} not found — already removed.")
        continue
    # Recalculate hook line
    hook_line = find(lines, "} = useWeightCapture({")
    if fi > hook_line:
        print(f"[fix] {func_name.split('=')[0].strip()} (line {fi+1}) is after hook call — skipping.")
        continue

    # Find the end of this function: the closing "};" followed by blank / next function
    # Walk forward from fi+1 looking for a top-level "};"
    depth = 0
    fe = fi
    for j in range(fi, len(lines)):
        l = lines[j]
        depth += l.count(b"{") - l.count(b"}")
        if j > fi and depth <= 0:
            fe = j
            break
    # Trim back past any leading JSDoc comment
    func_start = trim_jsdoc_backward(lines, fi - 1) + 1
    print(f"[fix] Removing {func_name.split('=')[0].strip()} (lines {func_start+1}–{fe+1})")
    lines = lines[:func_start] + lines[fe+1:]

# ── 7. Write output ───────────────────────────────────────────────────────
final = LF.join(lines) + LF
print(f"[fix] Final line count: {len(lines)}")

# Verify no duplicates remain
dupes_found = False
weight_state_vars = [
    b"const [weightResult,", b"const [savedWeightId,", b"const savedWeightIdRef",
    b"const [weightDiff,", b"const [showWeightCelebration,", b"const [weightEntrySaved,",
    b"const [pendingWeightImage,", b"const [showWeightProgressModal,",
    b"const [isEditingWeight,", b"const [editWeightValue,",
    b"const [isSavingWeightEdit,", b"const [weightEditError,",
    b"const [showDuplicateWeightModal,", b"const [duplicateWeightInfo,",
    b"const [pendingWeightSaveData,", b"const [lastWeight,",
]
for v in weight_state_vars:
    hook_pos = find(lines, "} = useWeightCapture({")
    found_before = -1
    for i, l in enumerate(lines[:hook_pos if hook_pos != -1 else len(lines)]):
        if v in l:
            found_before = i
            break
    if found_before != -1:
        print(f"[fix] WARN: Still found before hook: line {found_before+1}: {lines[found_before].strip()[:80].decode('utf-8','replace')}")
        dupes_found = True

if dupes_found:
    print("[fix] Some duplicates remain — check the warnings above.")
else:
    print("[fix] Duplicate check PASSED — no weight state declared before hook call.")

with open(APPJS, "wb") as fh:
    fh.write(final)
print(f"[fix] Written to {APPJS}")
print("[fix] Done. Run your build to verify: npm run build")
