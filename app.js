const detections = [
  'Pallet detected at 3.1 m (94% confidence)',
  'Obstacle cone identified on left path (91%)',
  'Forklift marker recognized in lane 2 (88%)',
  'Human worker detected near docking area (86%)'
];

const commandLog = [
  '12:03: AI model warmed up for corridor scan',
  '12:04: Cloud telemetry synced to dashboard',
  '12:05: Safety alert threshold updated'
];

const detectionList = document.getElementById('detectionsList');
const commandLogEl = document.getElementById('commandLog');
const clockEl = document.getElementById('clock');
const latencyEl = document.getElementById('latency');
const objectsEl = document.getElementById('objects');
const batteryEl = document.getElementById('battery');
const confidenceBar = document.getElementById('confidenceBar');
const confidenceText = document.getElementById('confidenceText');
const taskLabel = document.getElementById('taskLabel');
const targetBox = document.getElementById('targetBox');

function updateClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString('en-GB');
}

function seedLists() {
  detectionList.innerHTML = detections
    .map((item) => `<li>${item}</li>`)
    .join('');

  commandLogEl.innerHTML = commandLog
    .map((item) => `<li>${item}</li>`)
    .join('');
}

function updateAiSimulation() {
  const randomIndex = Math.floor(Math.random() * detections.length);
  const confidence = 82 + Math.floor(Math.random() * 15);
  const latency = 12 + Math.floor(Math.random() * 12);
  const battery = Math.max(70, 92 - Math.floor(Math.random() * 5));
  const objectCount = 3 + Math.floor(Math.random() * 3);

  detectionList.innerHTML = detections
    .map((item, index) => `<li>${index === randomIndex ? '● ' + item : item}</li>`)
    .join('');

  commandLogEl.innerHTML = [
    `Live update: ${objectCount} objects tracked in current scene`,
    `Cloud inference: ${latency} ms latency`,
    `Robot battery: ${battery}% remaining`
  ].map((item) => `<li>${item}</li>`).join('');

  latencyEl.textContent = `${latency} ms`;
  objectsEl.textContent = String(objectCount);
  batteryEl.textContent = `${battery}%`;
  confidenceBar.style.width = `${confidence}%`;
  confidenceText.textContent = `${confidence}% confidence in the current scene. Model is balancing speed and precision.`;
  taskLabel.textContent = objectCount >= 4
    ? 'Tracking multiple obstacles and pallets in the corridor.'
    : 'Scanning corridor for pallets and obstacles.';

  targetBox.textContent = `${objectCount} objects detected`;
}

updateClock();
seedLists();
updateAiSimulation();
setInterval(updateClock, 1000);
setInterval(updateAiSimulation, 2500);
