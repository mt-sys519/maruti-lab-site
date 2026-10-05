'use strict';
// A classic Worker is intentional: MediaPipe's WASM loader uses importScripts.
let tracker = null;
let busy = false;
let delegate = 'CPU';
async function initialize() {
  const { FaceLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
  const options = { runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true,
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' } };
  try {
    tracker = await FaceLandmarker.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } });
    delegate = 'GPU';
  } catch {
    tracker = await FaceLandmarker.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  }
  // Compile/warm the detector before enabling the camera. Keep this on the Worker.
  const warmStart = performance.now();
  const warmCanvas = new OffscreenCanvas(320, 240);
  tracker.detectForVideo(warmCanvas, 1);
  self.postMessage({ type: 'ready', delegate, warmupMs: performance.now() - warmStart });
}
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try { await initialize(); }
    catch (error) { self.postMessage({ type: 'error', message: String(error?.message || error) }); }
    return;
  }
  if (data.type !== 'frame') return;
  const bitmap = data.bitmap;
  if (!tracker || busy) { bitmap?.close(); self.postMessage({ type: 'pose', timestamp: data.timestamp, found: false }); return; }
  busy = true;
  const start = performance.now();
  try {
    const result = tracker.detectForVideo(bitmap, data.timestamp);
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    self.postMessage({ type: 'pose', timestamp: data.timestamp, found: !!matrix,
      yaw: matrix ? -Math.atan2(matrix[8], matrix[10]) * 180 / Math.PI : 0,
      inferenceMs: performance.now() - start });
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error?.message || error) });
  } finally {
    bitmap?.close();
    busy = false;
  }
};
