import { CentroidTracker } from './tracker.js';

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
const avgConfidenceEl = typeof document !== 'undefined' ? document.getElementById('avgConfidence') : null;

// AI Bridge controls
const bridgeToggle = typeof document !== 'undefined' ? document.getElementById('bridgeToggle') : null;
const bridgeUrlInput = typeof document !== 'undefined' ? document.getElementById('bridgeUrl') : null;
const bridgeStatusEl = typeof document !== 'undefined' ? document.getElementById('bridgeStatus') : null;
const decisionCommandEl = typeof document !== 'undefined' ? document.getElementById('decisionCommand') : null;
const decisionReasoningEl = typeof document !== 'undefined' ? document.getElementById('decisionReasoning') : null;
const decisionMetaEl = typeof document !== 'undefined' ? document.getElementById('decisionMeta') : null;

let model = null;
let stream = null;
let animationFrame = null;
let running = false;
let inferenceBusy = false;
let pipelineGeneration = 0;
let modelPromise = null;
let lastInferenceTime = 0;
let processedFrames = 0;
let fpsWindowStart = typeof performance !== 'undefined' ? performance.now() : 0;
let currentFps = 0;
const tracker = new CentroidTracker();
let videoObjectUrl = null;
let logEntries = [];
let odometry = 12.4;

// Bridge state
let bridgeEnabled = false;
let bridgeBusy = false;
let lastBridgePost = 0;
const BRIDGE_INTERVAL_MS = 1500;
let lastTrackedPredictions = [];

function updateClock() {
  if (!clockEl) return;
  clockEl.textContent = new Date().toLocaleTimeString('en-GB');
}

export function addLog(message) {
  if (!commandLog) return;
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logEntries.unshift(`${time} — ${String(message)}`);
  logEntries = logEntries.slice(0, 8);
  commandLog.replaceChildren();
  logEntries.forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = entry;
    commandLog.appendChild(item);
  });
}

function setStatus(status, mode, feed = 'Online') {
  if (!systemStatus || !modeLabel || !feedStatus) return;
  systemStatus.textContent = status;
  modeLabel.textContent = mode;
  feedStatus.textContent = feed;
  feedStatus.className = `status-pill ${feed === 'Online' ? 'online' : 'neutral'}`;
}

function setBridgeStatus(text, kind = 'neutral') {
  if (!bridgeStatusEl) return;
  bridgeStatusEl.textContent = text;
  bridgeStatusEl.className = `status-pill ${kind}`;
}

function resizeCanvas() {
  if (!video || !overlay) return;
  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;
  if (!width || !height) return;
  overlay.width = width;
  overlay.height = height;
}

export function updateTracks(predictions) {
  return tracker.update(predictions);
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
  if (avgConfidenceEl) avgConfidenceEl.textContent = predictions.length ? `${confidence}%` : '--%';
  if (confidenceBar) confidenceBar.style.width = `${confidence}%`;
  if (confidenceText) {
    confidenceText.textContent = predictions.length
      ? `${confidence}% average confidence across ${predictions.length} detection${predictions.length === 1 ? '' : 's'}.`
      : 'No objects detected in the latest frame.';
  }

  if (detectionsList) {
    detectionsList.replaceChildren();
    const visiblePredictions = [...predictions].sort((a, b) => b.score - a.score).slice(0, 8);
    if (!visiblePredictions.length) {
      const item = document.createElement('li');
      item.textContent = 'No objects above the confidence threshold.';
      detectionsList.appendChild(item);
    } else {
      visiblePredictions.forEach((prediction) => {
        const item = document.createElement('li');
        const name = document.createElement('strong');
        name.textContent = String(prediction.class);
        item.append(name, document.createTextNode(` — ${(prediction.score * 100).toFixed(0)}% confidence · track #${prediction.trackId}`));
        detectionsList.appendChild(item);
      });
    }
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

function buildScenePayload(predictions) {
  const width = video?.videoWidth || 0;
  const height = video?.videoHeight || 0;
  const batteryText = batteryEl?.textContent || '90%';
  const battery = parseInt(batteryText, 10) || 90;

  return {
    timestamp: new Date().toISOString(),
    frame_id: `dash-${Date.now()}`,
    frame_width: width || null,
    frame_height: height || null,
    detections: predictions.map((p) => {
      const [x, y, w, h] = p.bbox;
      return {
        label: p.class,
        confidence: Number(p.score.toFixed(3)),
        bbox: [x, y, x + w, y + h],
        track_id: p.trackId ?? null,
      };
    }),
    robot_state: {
      battery,
      odometry_m: Number(odometry.toFixed(2)),
      network: networkEl?.textContent || 'Connected',
      source: 'robot-vision-dashboard',
    },
    environment: {
      source: 'browser',
      model: 'coco-ssd',
      input: inputChip?.textContent || 'unknown',
    },
  };
}

function renderDecision(decision) {
  if (decisionCommandEl) {
    const params = decision.params && Object.keys(decision.params).length
      ? ` ${JSON.stringify(decision.params)}`
      : '';
    decisionCommandEl.textContent = `${decision.command}${params}`;
  }
  if (decisionReasoningEl) {
    decisionReasoningEl.textContent = decision.reasoning || '—';
  }
  if (decisionMetaEl) {
    const conf = decision.confidence != null ? `${(decision.confidence * 100).toFixed(0)}%` : '—';
    const lat = decision.total_latency_s != null ? `${decision.total_latency_s.toFixed(2)}s` : '—';
    decisionMetaEl.textContent = `Confidence ${conf} · Latency ${lat} · ${decision.robot_success ? 'OK' : 'Fail'}`;
  }
}

async function postToBridge(predictions) {
  if (!bridgeEnabled || bridgeBusy || !bridgeUrlInput) return;
  const now = performance.now();
  if (now - lastBridgePost < BRIDGE_INTERVAL_MS) return;

  const url = (bridgeUrlInput.value || '').trim();
  if (!url) return;

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname);
    const validProtocol = parsedUrl.protocol === 'https:'
      || (parsedUrl.protocol === 'http:' && isLoopback);
    if (!validProtocol || parsedUrl.username || parsedUrl.password) {
      throw new Error('Use HTTPS or a local HTTP bridge URL without embedded credentials.');
    }
  } catch (error) {
    setBridgeStatus('Invalid URL', 'neutral');
    addLog('Bridge configuration error: ' + error.message);
    return;
  }

  bridgeBusy = true;
  lastBridgePost = now;
  setBridgeStatus('Sending…', 'neutral');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const payload = buildScenePayload(predictions);
    const response = await fetch(parsedUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const decision = await response.json();
    if (!decision || typeof decision !== 'object' || typeof decision.command !== 'string') {
      throw new Error('Bridge returned an invalid decision payload.');
    }

    renderDecision(decision);
    setBridgeStatus('Linked', 'online');
    addLog('AI: ' + decision.command + ' — ' + String(decision.reasoning || '').slice(0, 80));
  } catch (error) {
    const message = error.name === 'AbortError' ? 'Request timed out after 8 seconds.' : error.message;
    setBridgeStatus('Offline', 'neutral');
    addLog('Bridge error: ' + message);
  } finally {
    clearTimeout(timeoutId);
    bridgeBusy = false;
  }
}
async function loadModel() {
  if (model) return model;
  if (modelPromise) return modelPromise;

  if (modelStatus) {
    modelStatus.textContent = 'Loading model';
    modelStatus.className = 'status-pill neutral';
  }
  addLog('Loading COCO-SSD object detection model.');

  modelPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' })
    .then((loadedModel) => {
      model = loadedModel;
      if (modelStatus) {
        modelStatus.textContent = 'Model ready';
        modelStatus.className = 'status-pill ready';
      }
      addLog('COCO-SSD model loaded successfully.');
      return model;
    })
    .finally(() => {
      modelPromise = null;
    });

  return modelPromise;
}
async function processFrame(timestamp, generation = pipelineGeneration) {
  if (!running || generation !== pipelineGeneration || !video || !model) return;
  animationFrame = requestAnimationFrame((nextTimestamp) => processFrame(nextTimestamp, generation));

  if (inferenceBusy || video.readyState < 2) return;
  if (timestamp - lastInferenceTime < 120) return;

  inferenceBusy = true;
  lastInferenceTime = timestamp;
  const started = performance.now();

  try {
    const predictions = await model.detect(video, 20, 0.55);
    if (!running || generation !== pipelineGeneration) return;
    const tracked = updateTracks(predictions);
    lastTrackedPredictions = tracked;
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

    // Stream scene to Bedrock robotics bridge when enabled
    postToBridge(tracked);
  } catch (error) {
    if (generation !== pipelineGeneration) return;
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
  const generation = pipelineGeneration;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
      return;
    }
    processedFrames = 0;
    currentFps = 0;
    lastInferenceTime = 0;
    fpsWindowStart = performance.now();
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
    if (!running || generation !== pipelineGeneration) return;
    animationFrame = requestAnimationFrame((timestamp) => processFrame(timestamp, generation));
  } catch (error) {
    stopPipeline(false);
    addLog(`Camera unavailable: ${error.message}`);
    setStatus('Ready', 'Camera permission required', 'Offline');
  }
}

async function loadVideo(file) {
  stopPipeline(false);
  if (!video) return;
  if (!file || (file.type && !file.type.startsWith('video/'))) {
    addLog('Unsupported file: please select a video.');
    return;
  }
  videoObjectUrl = URL.createObjectURL(file);
  const generation = pipelineGeneration;
  processedFrames = 0;
  currentFps = 0;
  lastInferenceTime = 0;
  fpsWindowStart = performance.now();
  video.srcObject = null;
  video.src = videoObjectUrl;
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
    try {
      resizeCanvas();
      await video.play();
      await loadModel();
      if (!running || generation !== pipelineGeneration) return;
      animationFrame = requestAnimationFrame((timestamp) => processFrame(timestamp, generation));
    } catch (error) {
      addLog('Video startup error: ' + error.message);
      stopPipeline(false);
    }
  };
  video.onerror = () => {
    addLog('Unable to read the selected video file.');
    stopPipeline(false);
  };
}

function stopPipeline(log = true) {
  pipelineGeneration += 1;
  running = false;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (video && video.srcObject) video.srcObject = null;
  if (video) video.pause();
  if (video) { video.onloadedmetadata = null; video.onerror = null; }
  if (videoObjectUrl) {
    URL.revokeObjectURL(videoObjectUrl);
    videoObjectUrl = null;
    if (video) { video.removeAttribute('src'); video.load(); }
  }
  if (ctx && overlay) ctx.clearRect(0, 0, overlay.width, overlay.height);
  tracker.reset();
  lastTrackedPredictions = [];
  if (trackedEl) trackedEl.textContent = '0';
  if (fpsEl) fpsEl.textContent = '0';
  if (avgConfidenceEl) avgConfidenceEl.textContent = '--%';
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

function onBridgeToggle() {
  bridgeEnabled = Boolean(bridgeToggle?.checked);
  if (bridgeEnabled) {
    setBridgeStatus('Ready', 'ready');
    addLog('AI Bridge enabled — streaming detections to robotics demo.');
    // Push current frame immediately if available
    if (lastTrackedPredictions.length) postToBridge(lastTrackedPredictions);
  } else {
    setBridgeStatus('Off', 'neutral');
    addLog('AI Bridge disabled.');
  }
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

  if (bridgeToggle) {
    bridgeToggle.addEventListener('change', onBridgeToggle);
    bridgeEnabled = bridgeToggle.checked;
  }

  updateClock();
  setInterval(updateClock, 1000);
  addLog('System initialized.');
  setBridgeStatus('Off', 'neutral');
}
