# Robot Vision Dashboard Benchmark

## Overview

This benchmark evaluates the browser-based Robot Vision System demo built with TensorFlow.js, COCO-SSD, lightweight centroid tracking, and simulated robot telemetry. The goal is to measure how the live perception pipeline behaves under realistic usage conditions for a portfolio or demo environment.

This project is intentionally structured as a demonstrator:

- Real detection is performed in the browser with COCO-SSD.
- Real frame processing, latency, and FPS are measured at runtime.
- Robot telemetry is simulated rather than connected to a live robot or cloud service.

## Benchmark Objectives

The benchmark focuses on five core performance signals:

1. Model inference latency
2. Pipeline FPS
3. Detection count stability
4. Tracking continuity across frames
5. Dashboard responsiveness under live processing

## Scope

The assessment covers the following components:

- Webcam input or local video playback
- COCO-SSD inference using the MobileNet v2 base model
- Confidence filtering at 0.55
- Centroid-based track association across consecutive frames
- Live metric updates shown in the dashboard
- Simulated robot status updates for battery, odometry, and network state

## Test Environment

### Recommended Setup

- Modern desktop browser: Chrome, Edge, or Chromium-based browser
- Local HTTP server running from the project root
- Webcam or a short local MP4/WebM test clip
- CPU/GPU hardware available to the host browser
- Room lighting suitable for object visibility

### Suggested Local Run

```bash
python -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

## Benchmark Method

### 1. Baseline readiness

- Start the local server.
- Open the dashboard.
- Verify the app loads without console errors.
- Confirm the model status changes from idle to ready after initialization.

### 2. Camera benchmark

- Start the camera feed.
- Allow browser permission for webcam access.
- Let the pipeline run for 30 to 60 seconds.
- Record data from the live dashboard under normal motion and low-motion conditions.

### 3. Video benchmark

- Load a short local clip with clear object movement.
- Repeat the run for 30 to 60 seconds.
- Prefer a clip with consistent lighting and several detectable objects.

### 4. Stress and edge checks

- Increase scene complexity with multiple objects.
- Add partial occlusion or motion blur.
- Confirm the tracker remains stable and the UI still responds.

## Metrics to Capture

| Metric | Description | Typical target range |
|---|---|---|
| Inference latency | Time spent running detection per processed frame | 50–250 ms depending on browser and hardware |
| Pipeline FPS | Number of processed frames per second | 5–15 FPS for real-time browser inference |
| Objects detected | Count of predictions passing confidence threshold | Varies with scene |
| Tracked objects | Number of active centroid-based tracks | Varies with scene |
| Average confidence | Mean confidence for current detections | 0–100% |
| UI responsiveness | Dashboard updates without lag or freezes | Real-time updates |

## Pass Criteria

The system is considered benchmark-healthy when all of the following are true:

- Model loads successfully without browser crash.
- Inference latency remains within a usable interactive range for the device.
- FPS updates continuously during live processing.
- Detection overlays render on the correct video frame.
- Tracking IDs remain consistent for objects that stay in frame.
- Dashboard cards update without stale values.
- The app can be stopped and restarted cleanly.

## Interpretation Guidelines

### Good performance

- Stable detection overlay
- Smooth metric updates
- Acceptable frame cadence for a browser demo
- Low rate of missed or flickering tracks

### Warning signs

- Inference latency spikes beyond the expected range
- FPS dropping to near zero for extended periods
- Object counts oscillating wildly when the scene is static
- Track IDs jumping between objects or disappearing too often

### Non-goals

This benchmark does not claim production-grade robotics performance. It does not measure:

- Real robot motion control
- Real cloud inference latency
- ROS or industrial telemetry pipelines
- Production tracker accuracy on large-scale multi-object scenes
- End-to-end autonomous robot decision-making

## Benchmark Template

Use this table to document a test run:

| Test ID | Input type | Duration | Avg latency | Avg FPS | Detected objects | Tracked objects | Avg confidence | Observations |
|---|---|---:|---:|---:|---:|---:|---:|---|
| B1 | Webcam | 30s |  |  |  |  |  |  |
| B2 | Local video | 30s |  |  |  |  |  |  |
| B3 | Multi-object scene | 30s |  |  |  |  |  |  |

## Recommended Reporting

For simple reporting, include:

- Device/browser used
- Input source used
- Duration of run
- Average latency
- Average FPS
- Peak detection count
- Observed tracking stability
- Notes on visual quality or frame drift

## Summary

This benchmark validates the project’s intended claim: the dashboard demonstrates real-time browser-side computer vision and lightweight tracking in a portfolio-friendly environment. It is designed to demonstrate feasibility and system behavior, not to replace a full industrial robot perception evaluation.
