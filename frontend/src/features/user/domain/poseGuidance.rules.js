/**
 * Pure pose / face guidance rules for transformation photos.
 * Landmarks come from on-device MediaPipe (no Gemini).
 *
 * Pose landmark indices (MediaPipe Pose):
 *  0 nose, 11 left shoulder, 12 right shoulder,
 *  23 left hip, 24 right hip
 */

export const POSE_STEPS = Object.freeze(['front', 'left', 'right']);

export const POSE_STEP_COPY = Object.freeze({
  front: {
    title: 'Front pose',
    instruction: 'Face the camera. Full body in frame, arms relaxed at your sides.',
    captureHint: 'Look straight ahead — face and both shoulders visible.',
  },
  left: {
    title: 'Left side pose',
    instruction: 'Turn so your LEFT side faces the camera. Full body in frame.',
    captureHint: 'Stand in left profile — left shoulder toward the camera.',
  },
  right: {
    title: 'Right side pose',
    instruction: 'Turn so your RIGHT side faces the camera. Full body in frame.',
    captureHint: 'Stand in right profile — right shoulder toward the camera.',
  },
});

/**
 * @param {{ x: number, y: number, z?: number, visibility?: number }|null|undefined} lm
 * @param {number} [minVisibility]
 */
export function isLandmarkVisible(lm, minVisibility = 0.5) {
  if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number') return false;
  if (lm.visibility == null) return true;
  return Number(lm.visibility) >= minVisibility;
}

/**
 * Classify body orientation from pose landmarks (normalized 0–1 coords).
 * @param {Array<{ x: number, y: number, z?: number, visibility?: number }>|null|undefined} landmarks
 * @returns {'front'|'left'|'right'|'unknown'|'none'}
 */
export function classifyBodyOrientation(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 25) return 'none';

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const shouldersOk = isLandmarkVisible(leftShoulder) && isLandmarkVisible(rightShoulder);
  if (!shouldersOk) return 'none';

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
  const torsoHeight = Math.max(
    Math.abs(((leftHip?.y ?? leftShoulder.y) + (rightHip?.y ?? rightShoulder.y)) / 2 - leftShoulder.y),
    0.05,
  );
  const widthRatio = shoulderWidth / torsoHeight;

  // Narrow shoulders in frame → side profile; wide → front.
  const looksSide = widthRatio < 0.55;
  const looksFront = widthRatio >= 0.7;

  if (looksFront && isLandmarkVisible(nose, 0.4)) {
    return 'front';
  }

  if (looksSide || (!looksFront && isLandmarkVisible(nose, 0.3))) {
    // Nose left of mid-shoulder → camera sees right side of body (right profile).
    // Nose right of mid-shoulder → camera sees left side of body (left profile).
    if (!isLandmarkVisible(nose, 0.25)) return 'unknown';
    if (nose.x < midShoulderX - 0.02) return 'right';
    if (nose.x > midShoulderX + 0.02) return 'left';
    return 'unknown';
  }

  return 'unknown';
}

/**
 * @param {number} faceCount
 * @returns {boolean}
 */
export function hasUsableFace(faceCount) {
  return Number(faceCount) >= 1;
}

/**
 * Live guidance for the required pose step.
 * @param {'front'|'left'|'right'} requiredPose
 * @param {{ orientation: string, faceCount?: number, personDetected?: boolean }} sample
 * @returns {{ ok: boolean, code: string, message: string }}
 */
export function evaluatePoseGuidance(requiredPose, sample = {}) {
  const orientation = sample.orientation || 'none';
  const faceCount = sample.faceCount ?? 0;
  const personDetected = sample.personDetected !== false && orientation !== 'none';

  if (!personDetected || orientation === 'none') {
    return {
      ok: false,
      code: 'no_person',
      message: 'Step fully into the frame so your whole body is visible.',
    };
  }

  if (requiredPose === 'front') {
    if (!hasUsableFace(faceCount)) {
      return {
        ok: false,
        code: 'no_face',
        message: 'Face the camera — we need to see your face clearly (on-device check).',
      };
    }
    if (orientation !== 'front') {
      return {
        ok: false,
        code: 'wrong_pose',
        message: POSE_STEP_COPY.front.captureHint,
      };
    }
    return { ok: true, code: 'ready', message: 'Looking good — hold still and capture.' };
  }

  if (requiredPose === 'left') {
    if (orientation !== 'left') {
      return {
        ok: false,
        code: 'wrong_pose',
        message: POSE_STEP_COPY.left.captureHint,
      };
    }
    return { ok: true, code: 'ready', message: 'Left side looking good — capture now.' };
  }

  if (requiredPose === 'right') {
    if (orientation !== 'right') {
      return {
        ok: false,
        code: 'wrong_pose',
        message: POSE_STEP_COPY.right.captureHint,
      };
    }
    return { ok: true, code: 'ready', message: 'Right side looking good — capture now.' };
  }

  return { ok: false, code: 'unknown', message: 'Adjust your pose to match the guide.' };
}
