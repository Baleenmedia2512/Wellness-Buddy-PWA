/**
 * On-device face + pose detection via MediaPipe Tasks Vision.
 * No Gemini / no AI credits — runs in the browser (WASM).
 */
import { FaceDetector, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { classifyBodyOrientation } from '../domain/poseGuidance.rules.js';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.tflite';

let visionFilesetPromise = null;
let faceDetectorPromise = null;
let poseLandmarkerPromise = null;

function getVisionFileset() {
  if (!visionFilesetPromise) {
    visionFilesetPromise = FilesetResolver.forVisionTasks(WASM_ROOT);
  }
  return visionFilesetPromise;
}

async function getFaceDetector() {
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      const vision = await getVisionFileset();
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
    })().catch(async () => {
      // GPU may fail on some WebViews — retry CPU.
      const vision = await getVisionFileset();
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
    });
  }
  return faceDetectorPromise;
}

async function getPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      const vision = await getVisionFileset();
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })().catch(async () => {
      const vision = await getVisionFileset();
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    });
  }
  return poseLandmarkerPromise;
}

/**
 * Warm models (call when opening guided capture).
 */
export async function warmPoseGuidanceModels() {
  await Promise.all([getFaceDetector(), getPoseLandmarker()]);
}

/**
 * Analyze a video frame (or canvas/image element).
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} source
 * @param {number} [timestampMs]
 * @returns {Promise<{ orientation: string, faceCount: number, personDetected: boolean }>}
 */
export async function analyzePoseFrame(source, timestampMs = performance.now()) {
  const [faceDetector, poseLandmarker] = await Promise.all([
    getFaceDetector(),
    getPoseLandmarker(),
  ]);

  let faceCount = 0;
  try {
    const faces = faceDetector.detectForVideo(source, timestampMs);
    faceCount = Array.isArray(faces?.detections) ? faces.detections.length : 0;
  } catch {
    faceCount = 0;
  }

  let orientation = 'none';
  try {
    const pose = poseLandmarker.detectForVideo(source, timestampMs);
    const landmarks = pose?.landmarks?.[0] || null;
    orientation = classifyBodyOrientation(landmarks);
  } catch {
    orientation = 'none';
  }

  return {
    orientation,
    faceCount,
    personDetected: orientation !== 'none',
  };
}

/**
 * Analyze a still image (gallery upload) via IMAGE running mode recreate is heavy —
 * draw to canvas and use VIDEO detectors with a synthetic timestamp.
 * @param {HTMLCanvasElement|HTMLImageElement} source
 */
export async function analyzePoseStill(source) {
  return analyzePoseFrame(source, performance.now());
}
