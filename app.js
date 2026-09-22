const video = typeof document !== 'undefined' ? document.getElementById('video') : null;
const overlay = typeof document !== 'undefined' ? document.getElementById('overlay') : null;
const ctx = overlay ? overlay.getContext('2d') : null;
const cameraButton = typeof document !== 'undefined' ? document.getElementById('cameraButton') : null;
const videoInput = typeof document !== 'undefined' ? document.getElementById('videoInput') : null;
const stopButton = typeof document !== 'undefined' ? document.getElementById('stopButton') : null;
const snapshotButton = typeof document !== 'undefined' ? document.getElementById('snapshotButton') : null;
const emptyState = typeof document !== 'undefined' ? document.getElementById('emptyState') : null;
const feedStatus = typeof document !== 'undefined' ? document.getElementById('feedStatus') : null;
const systemStatus = typeof document !== 'undefined' ? document.getElementById('systemStatus') : null;
const modeLabel = typeof document !== 'undefined' ? document.getElementById('modeLabel') : null;
const inputChip = typeof document !== 'undefined' ? document.getElementById('inputChip') : null;
const modelStatus = typeof document !== 'undefined' ? document.getElementById('modelStatus') : null;
const detectionsList = typeof document !== 'undefined' ? document.getElementById('detectionsList') : null;
const commandLog = typeof document !== 'undefined' ? document.getElementById('commandLog') : null;
const latencyEl = typeof document !== 'undefined' ? document.getElementById('latency') : null;
const objectsEl = typeof document !== 'undefined' ? document.getElementById('objects') : null;
const trackedEl = typeof document !== 'undefined' ? document.getElementById('tracked') : null;
const fpsEl = typeof document !== 'undefined' ? document.getElementById('fps') : null;
const confidenceBar = typeof document !== 'undefined' ? document.getElementById('confidenceBar') : null;
const confidenceText = typeof document !== 'undefined' ? document.getElementById('confidenceText') : null;
const taskLabel = typeof document !== 'undefined' ? document.getElementById('taskLabel') : null;
const batteryEl = typeof document !== 'undefined' ? document.getElementById('battery') : null;
const odometryEl = typeof document !== 'undefined' ? document.getElementById('odometry') : null;
const networkEl = typeof document !== 'undefined' ? document.getElementById('network') : null;
const queueStatus = typeof document !== 'undefined' ? document.getElementById('queueStatus') : null;
const clockEl = typeof document !== 'undefined' ? document.getElementById('clock') : null;

let model = null;
let stream = null;
let animationFrame = null;
let running = false;
let inferenceBusy = false;
let lastInferenceTime = 0;
let processedFrames = 0;
let fpsWindowStart = typeof performance !== 'undefined' ? performance.now() : 0;
let currentFps = 0;
let nextTrackId = 1;
let tracks = [];
let logEntries = [];
let odometry = 12.4;

function updateClock() {
  if (!clockEl) return;
  clockEl.textContent = new Date().toLocaleTimeString('en-GB');
}

function addLog(message) {
  if (!commandLog) return;
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logEntries.unshift(`${time} — ${message}`);
  logEntries = logEntries.slice(0, 6);
  commandLog.innerHTML = logEntries.map((entry) => `<li>${entry}</li>`).join('');
}

function setStatus(status, mode, feed = 'Online') {
  if (!systemStatus || !modeLabel || !feedStatus) return;
  systemStatus.textContent = status;
  modeLabel.textContent = mode;
  feedStatus.textContent = feed;
  feedStatus.className = `status-pill ${feed === 'Online' ? 'online' : 'neutral'}`;
}

function resizeCanvas() {
  if (!video || !overlay) return;
  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;
  if (!width || !height) return;
  overlay.width = width;
  overlay.height = height;
}

export function getCentroid(box) {
  return { x: box[0] + box[2] / 2, y: box[1] + box[3] / 2 };
}

export function updateTracks(predictions, existingTracks = tracks, initialNextTrackId = nextTrackId) {
  const candidates = predictions.map((prediction) => ({
    ...prediction,
    centroid: getCentroid(prediction.bbox),
    trackId: null,
  }));

  const usedTracks = new Set();
  let nextTrackIdValue = initialNextTrackId;

  candidates.forEach((candidate) => {
    let best = null;
    let bestDistance = Infinity;
    existingTracks.forEach((track) => {
      if (usedTracks.has(track.id) || track.className !== candidate.class) return;
      const distance = Math.hypot(candidate.centroid.x - track.x, candidate.centroid.y - track.y);
      if (distance < bestDistance && distance < 90) {
        best = track;
        bestDistance = distance;
      }
    });

    if (best) {
      candidate.trackId = best.id;
      usedTracks.add(best.id);
    } else {
      candidate.trackId = nextTrackIdValue++;
    }
  });

  const nextTracks = candidates.map((candidate) => ({
    id: candidate.trackId,
    className: candidate.class,
    x: candidate.centroid.x,
    y: candidate.centroid.y,
  }));

  if (tracks === existingTracks) {
    tracks = nextTracks;
    nextTrackId = nextTrackIdValue;
  }

  return candidates;
}

function drawPredictions(predictions) {
  if (!video || !overlay || !ctx) return;
  resizeCanvas();
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  predictions.forEach((prediction) => {
    const [x, y, width, height] = prediction.bbox;
    const label = `${prediction.class} ${(prediction.score * 100).toFixed(0)}% • #${prediction.trackId}`;

    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    ctx.font = '600 14px Inter, sans-serif';
    const textWidth = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(4, 17, 11, 0.88)';
    ctx.fillRect(x, Math.max(0, y - 28), textWidth, 28);
    ctx.fillStyle = '#ecfdf5';
    ctx.fillText(label, x + 8, Math.max(19, y - 9));
  });
}

function renderInsights(predictions, latency) {
  const confidence = predictions.length
    ? Math.round((predictions.reduce((sum, item) => sum + item.score, 0) / predictions.length) * 100)
    : 0;

  if (objectsEl) objectsEl.textContent = String(predictions.length);
  if (trackedEl) trackedEl.textContent = String(new Set(predictions.map((item) => item.trackId)).size);
  if (latencyEl) latencyEl.textContent = `${latency.toFixed(0)} ms`;
  if (fpsEl) fpsEl.textContent = currentFps.toFixed(1);
  if (confidenceBar) confidenceBar.style.width = `${confidence}%`;
  if (confidenceText) {
    confidenceText.textContent = predictions.length
      ? `${confidence}% average confidence across ${predictions.length} detection${predictions.length === 1 ? '' : 's'}.`
      : 'No objects detected in the latest frame.';
  }

  if (detectionsList) {
    detectionsList.innerHTML = predictions.length
      ? predictions
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map((item) => `<li><strong>${item.class}</strong> — ${(item.score * 100).toFixed(0)}% confidence · track #${item.trackId}</li>`)
          .join('')
      : '<li>No objects above the confidence threshold.</li>';
  }

  if (taskLabel) {
    taskLabel.textContent = predictions.length
      ? `Tracking ${predictions.length} object${predictions.length === 1 ? '' : 's'} in the current scene.`
      : 'Scanning the current scene for known objects.';
  }
}

export function updateTelemetry({ running: isRunning = running, odometryValue = odometry, odometryElRef = odometryEl, batteryElRef = batteryEl, networkElRef = networkEl } = {}) {
  if (!isRunning) return;
  const nextOdometry = odometryValue + 0.02;
  if (odometryElRef) odometryElRef.textContent = `${nextOdometry.toFixed(1)} m`;
  const battery = Math.max(82, 92 - Math.floor((nextOdometry - 12.4) / 0.4));
  if (batteryElRef) batteryElRef.textContent = `${battery}%`;
  if (networkElRef) networkElRef.textContent = 'Connected';
  odometry = nextOdometry;
}

async function loadModel() {
  if (model) return model;
  if (modelStatus) {
    modelStatus.textContent = 'Loading model';
    modelStatus.className = 'status-pill neutral';
  }
  addLog('Loading COCO-SSD object detection model.');
  model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  if (modelStatus) {
    modelStatus.textContent = 'Model ready';
    modelStatus.className = 'status-pill ready';
  }
  addLog('COCO-SSD model loaded successfully.');
  return model;
}

async function processFrame(timestamp) {
  if (!running || !video || !model) return;
  animationFrame = requestAnimationFrame(processFrame);

  if (inferenceBusy || video.readyState < 2) return;
  if (timestamp - lastInferenceTime < 120) return;

  inferenceBusy = true;
  lastInferenceTime = timestamp;
  const started = performance.now();

  try {
    const predictions = await model.detect(video, 20, 0.55);
    const tracked = updateTracks(predictions);
    const latency = performance.now() - started;
    processedFrames += 1;

    const now = performance.now();
    if (now - fpsWindowStart >= 1000) {
      currentFps = processedFrames / ((now - fpsWindowStart) / 1000);
      processedFrames = 0;
      fpsWindowStart = now;
    }

    drawPredictions(tracked);
    renderInsights(tracked, latency);
    updateTelemetry();
    if (modelStatus) {
      modelStatus.textContent = 'Inference active';
      modelStatus.className = 'status-pill online';
    }
  } catch (error) {
    addLog(`Inference error: ${error.message}`);
    if (modelStatus) {
      modelStatus.textContent = 'Inference error';
      modelStatus.className = 'status-pill neutral';
    }
  } finally {
    inferenceBusy = false;
  }
}

async function startCamera() {
  stopPipeline(false);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (!video) return;
    video.srcObject = stream;
    video.removeAttribute('controls');
    if (inputChip) inputChip.textContent = 'Input: Webcam';
    setStatus('Running', 'Webcam • Real-time inference');
    if (emptyState) emptyState.hidden = true;
    running = true;
    if (stopButton) stopButton.disabled = false;
    if (snapshotButton) snapshotButton.disabled = false;
    if (queueStatus) queueStatus.textContent = 'Processing';
    addLog('Webcam stream started.');
    await video.play();
    resizeCanvas();
    await loadModel();
    animationFrame = requestAnimationFrame(processFrame);
  } catch (error) {
    addLog(`Camera unavailable: ${error.message}`);
    setStatus('Ready', 'Camera permission required', 'Offline');
  }
}

async function loadVideo(file) {
  stopPipeline(false);
  if (!video) return;
  const url = URL.createObjectURL(file);
  video.srcObject = null;
  video.src = url;
  video.controls = true;
  if (inputChip) inputChip.textContent = 'Input: Local video';
  setStatus('Running', 'Local video • Real-time inference');
  if (emptyState) emptyState.hidden = true;
  running = true;
  if (stopButton) stopButton.disabled = false;
  if (snapshotButton) snapshotButton.disabled = false;
  if (queueStatus) queueStatus.textContent = 'Processing';
  addLog(`Loaded video: ${file.name}.`);

  video.onloadedmetadata = async () => {
    resizeCanvas();
    await video.play();
    await loadModel();
    animationFrame = requestAnimationFrame(processFrame);
  };
}

function stopPipeline(log = true) {
  running = false;
  inferenceBusy = false;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (video && video.srcObject) video.srcObject = null;
  if (video) video.pause();
  if (ctx && overlay) ctx.clearRect(0, 0, overlay.width, overlay.height);
  tracks = [];
  if (trackedEl) trackedEl.textContent = '0';
  if (fpsEl) fpsEl.textContent = '0';
  if (queueStatus) queueStatus.textContent = 'Ready';
  setStatus('Ready', 'Awaiting video input', 'Offline');
  if (inputChip) inputChip.textContent = 'Input: None';
  if (modelStatus) {
    modelStatus.textContent = model ? 'Model ready' : 'Model idle';
    modelStatus.className = `status-pill ${model ? 'ready' : 'neutral'}`;
  }
  if (stopButton) stopButton.disabled = true;
  if (snapshotButton) snapshotButton.disabled = true;
  if (emptyState) emptyState.hidden = false;
  if (taskLabel) taskLabel.textContent = 'Waiting for perception input.';
  if (networkEl) networkEl.textContent = 'Ready';
  if (log) addLog('Vision pipeline stopped.');
}

function captureSnapshot() {
  if (!video || !video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const link = document.createElement('a');
  link.download = `robot-vision-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  addLog('Captured current camera frame.');
}

if (typeof document !== 'undefined') {
  cameraButton.addEventListener('click', startCamera);
  videoInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) loadVideo(file);
  });
  stopButton.addEventListener('click', () => stopPipeline(true));
  snapshotButton.addEventListener('click', captureSnapshot);
  video.addEventListener('resize', resizeCanvas);
  video.addEventListener('ended', () => stopPipeline(true));

  updateClock();
  setInterval(updateClock, 1000);
  addLog('System initialized.');
}
