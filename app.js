const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const cameraButton = document.getElementById('cameraButton');
const videoInput = document.getElementById('videoInput');
const stopButton = document.getElementById('stopButton');
const snapshotButton = document.getElementById('snapshotButton');
const emptyState = document.getElementById('emptyState');
const feedStatus = document.getElementById('feedStatus');
const systemStatus = document.getElementById('systemStatus');
const modeLabel = document.getElementById('modeLabel');
const inputChip = document.getElementById('inputChip');
const modelStatus = document.getElementById('modelStatus');
const detectionsList = document.getElementById('detectionsList');
const commandLog = document.getElementById('commandLog');
const latencyEl = document.getElementById('latency');
const objectsEl = document.getElementById('objects');
const trackedEl = document.getElementById('tracked');
const fpsEl = document.getElementById('fps');
const confidenceBar = document.getElementById('confidenceBar');
const confidenceText = document.getElementById('confidenceText');
const taskLabel = document.getElementById('taskLabel');
const batteryEl = document.getElementById('battery');
const odometryEl = document.getElementById('odometry');
const networkEl = document.getElementById('network');
const queueStatus = document.getElementById('queueStatus');
const clockEl = document.getElementById('clock');

let model = null;
let stream = null;
let animationFrame = null;
let running = false;
let inferenceBusy = false;
let lastInferenceTime = 0;
let processedFrames = 0;
let fpsWindowStart = performance.now();
let currentFps = 0;
let nextTrackId = 1;
let tracks = [];
let logEntries = [];
let odometry = 12.4;

function updateClock() {
  clockEl.textContent = new Date().toLocaleTimeString('en-GB');
}

function addLog(message) {
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logEntries.unshift(`${time} — ${message}`);
  logEntries = logEntries.slice(0, 6);
  commandLog.innerHTML = logEntries.map((entry) => `<li>${entry}</li>`).join('');
}

function setStatus(status, mode, feed = 'Online') {
  systemStatus.textContent = status;
  modeLabel.textContent = mode;
  feedStatus.textContent = feed;
  feedStatus.className = `status-pill ${feed === 'Online' ? 'online' : 'neutral'}`;
}

function resizeCanvas() {
  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;
  if (!width || !height) return;
  overlay.width = width;
  overlay.height = height;
}

function getCentroid(box) {
  return { x: box[0] + box[2] / 2, y: box[1] + box[3] / 2 };
}

function updateTracks(predictions) {
  const candidates = predictions.map((prediction) => ({
    ...prediction,
    centroid: getCentroid(prediction.bbox),
    trackId: null,
  }));

  const usedTracks = new Set();
  candidates.forEach((candidate) => {
    let best = null;
    let bestDistance = Infinity;
    tracks.forEach((track) => {
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
      candidate.trackId = nextTrackId++;
    }
  });

  tracks = candidates.map((candidate) => ({
    id: candidate.trackId,
    className: candidate.class,
    x: candidate.centroid.x,
    y: candidate.centroid.y,
  }));

  return candidates;
}

function drawPredictions(predictions) {
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

  objectsEl.textContent = String(predictions.length);
  trackedEl.textContent = String(new Set(predictions.map((item) => item.trackId)).size);
  latencyEl.textContent = `${latency.toFixed(0)} ms`;
  fpsEl.textContent = currentFps.toFixed(1);
  confidenceBar.style.width = `${confidence}%`;
  confidenceText.textContent = predictions.length
    ? `${confidence}% average confidence across ${predictions.length} detection${predictions.length === 1 ? '' : 's'}.`
    : 'No objects detected in the latest frame.';

  detectionsList.innerHTML = predictions.length
    ? predictions
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((item) => `<li><strong>${item.class}</strong> — ${(item.score * 100).toFixed(0)}% confidence · track #${item.trackId}</li>`)
        .join('')
    : '<li>No objects above the confidence threshold.</li>';

  taskLabel.textContent = predictions.length
    ? `Tracking ${predictions.length} object${predictions.length === 1 ? '' : 's'} in the current scene.`
    : 'Scanning the current scene for known objects.';
}

function updateTelemetry() {
  if (!running) return;
  odometry += 0.02;
  odometryEl.textContent = `${odometry.toFixed(1)} m`;
  const battery = Math.max(82, 92 - Math.floor((odometry - 12.4) / 0.4));
  batteryEl.textContent = `${battery}%`;
  networkEl.textContent = 'Connected';
}

async function loadModel() {
  if (model) return model;
  modelStatus.textContent = 'Loading model';
  modelStatus.className = 'status-pill neutral';
  addLog('Loading COCO-SSD object detection model.');
  model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  modelStatus.textContent = 'Model ready';
  modelStatus.className = 'status-pill ready';
  addLog('COCO-SSD model loaded successfully.');
  return model;
}

async function processFrame(timestamp) {
  if (!running) return;
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
    modelStatus.textContent = 'Inference active';
    modelStatus.className = 'status-pill online';
  } catch (error) {
    addLog(`Inference error: ${error.message}`);
    modelStatus.textContent = 'Inference error';
    modelStatus.className = 'status-pill neutral';
  } finally {
    inferenceBusy = false;
  }
}

async function startCamera() {
  stopPipeline(false);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    video.removeAttribute('controls');
    inputChip.textContent = 'Input: Webcam';
    setStatus('Running', 'Webcam • Real-time inference');
    emptyState.hidden = true;
    running = true;
    stopButton.disabled = false;
    snapshotButton.disabled = false;
    queueStatus.textContent = 'Processing';
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
  const url = URL.createObjectURL(file);
  video.srcObject = null;
  video.src = url;
  video.controls = true;
  inputChip.textContent = 'Input: Local video';
  setStatus('Running', 'Local video • Real-time inference');
  emptyState.hidden = true;
  running = true;
  stopButton.disabled = false;
  snapshotButton.disabled = false;
  queueStatus.textContent = 'Processing';
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
  if (video.srcObject) video.srcObject = null;
  video.pause();
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  tracks = [];
  trackedEl.textContent = '0';
  fpsEl.textContent = '0';
  queueStatus.textContent = 'Ready';
  setStatus('Ready', 'Awaiting video input', 'Offline');
  inputChip.textContent = 'Input: None';
  modelStatus.textContent = model ? 'Model ready' : 'Model idle';
  modelStatus.className = `status-pill ${model ? 'ready' : 'neutral'}`;
  stopButton.disabled = true;
  snapshotButton.disabled = true;
  emptyState.hidden = false;
  taskLabel.textContent = 'Waiting for perception input.';
  networkEl.textContent = 'Ready';
  if (log) addLog('Vision pipeline stopped.');
}

function captureSnapshot() {
  if (!video.videoWidth) return;
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
