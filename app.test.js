import { describe, it, expect, beforeEach, vi } from 'vitest';

function loadAppDom() {
  document.body.innerHTML = `
    <div class="app-shell">
      <header class="hero-card">
        <div class="hero-badge">
          <span id="systemStatus">Ready</span>
          <strong id="clock">--:--:--</strong>
          <small id="modeLabel">Awaiting video input</small>
        </div>
      </header>

      <section class="control-bar panel">
        <div class="controls">
          <button id="cameraButton" type="button">Start camera</button>
          <label class="file-button" for="videoInput">Load video</label>
          <input id="videoInput" type="file" accept="video/*" hidden />
          <button id="stopButton" type="button" class="secondary" disabled>Stop</button>
        </div>
      </section>

      <main class="dashboard-grid">
        <section class="panel camera-panel">
          <div class="camera-stage" id="cameraStage">
            <video id="video" autoplay muted playsinline></video>
            <canvas id="overlay"></canvas>
            <div id="emptyState" class="empty-state">
              <div class="empty-icon">◉</div>
              <strong>Start a camera or load a video</strong>
              <span>The detection overlay will appear here.</span>
            </div>
            <div class="camera-overlay">
              <span class="chip">Model: COCO-SSD</span>
              <span class="chip">Tracking: Centroid</span>
              <span id="inputChip" class="chip">Input: None</span>
            </div>
          </div>
          <div class="camera-footer">
            <div>
              <strong>Current task</strong>
              <p id="taskLabel">Waiting for perception input.</p>
            </div>
            <button id="snapshotButton" type="button" class="secondary" disabled>Capture snapshot</button>
          </div>
        </section>

        <section class="panel insights-panel">
          <div class="panel-header">
            <span id="feedStatus" class="status-pill neutral">Offline</span>
            <span id="modelStatus" class="status-pill neutral">Model idle</span>
          </div>

          <ul id="detectionsList" class="detection-list">
            <li>No detections yet.</li>
          </ul>

          <div class="mini-card">
            <div class="progress-track"><div id="confidenceBar" class="progress-fill"></div></div>
            <p id="confidenceText">Run the pipeline to calculate confidence.</p>
          </div>

          <div class="mini-card">
            <ul class="health-list">
              <li>Battery: <span id="battery">92%</span></li>
              <li>Wheel odometry: <span id="odometry">12.4 m</span></li>
              <li>Network link: <span id="network">Ready</span></li>
            </ul>
          </div>
        </section>

        <section class="panel action-panel">
          <div class="panel-header">
            <span id="queueStatus" class="status-pill ready">Ready</span>
          </div>
          <ul id="commandLog" class="log-list">
            <li>System initialized.</li>
            <li>Waiting for camera or video input.</li>
          </ul>
        </section>
      </main>
    </div>

    <div id="latency">-- ms</div>
    <div id="objects">0</div>
    <div id="tracked">0</div>
    <div id="fps">0</div>
  `;

  const video = document.getElementById('video');
  Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
  Object.defineProperty(video, 'readyState', { value: 2, configurable: true });
  video.play = vi.fn().mockResolvedValue(undefined);
  video.pause = vi.fn();

  const overlay = document.getElementById('overlay');
  overlay.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    strokeRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 30 })),
    fillRect: vi.fn(),
    fillText: vi.fn(),
  }));

  return { video, overlay };
}

describe('robot vision dashboard logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    loadAppDom();
  });

  it('creates tracking ids for new detections', async () => {
    const { updateTracks } = await import('./app.js');

    const predictions = [
      { class: 'person', bbox: [10, 20, 60, 100], score: 0.9 },
      { class: 'car', bbox: [100, 30, 80, 50], score: 0.8 },
    ];

    const tracked = updateTracks(predictions);

    expect(tracked).toHaveLength(2);
    expect(tracked[0].trackId).toBeDefined();
    expect(tracked[1].trackId).toBeDefined();
    expect(tracked[0].trackId).not.toBe(tracked[1].trackId);
  });

  it('keeps a stable track when the centroid remains close', async () => {
    const { updateTracks } = await import('./app.js');

    const initial = [{ class: 'person', bbox: [10, 20, 60, 100], score: 0.9 }];
    const next = [{ class: 'person', bbox: [20, 25, 60, 100], score: 0.88 }];

    const firstPass = updateTracks(initial);
    const secondPass = updateTracks(next);

    expect(firstPass[0].trackId).toBe(secondPass[0].trackId);
  });

  it('updates telemetry text when the pipeline runs', async () => {
    const { updateTelemetry } = await import('./app.js');
    const odometryEl = document.getElementById('odometry');
    const batteryEl = document.getElementById('battery');
    const networkEl = document.getElementById('network');

    updateTelemetry({ running: true });

    expect(odometryEl.textContent).toContain('m');
    expect(batteryEl.textContent).toContain('%');
    expect(networkEl.textContent).toBe('Connected');
  });
});
