# Robot Vision Dashboard — Performance Benchmark

## Overview

This benchmark evaluates the browser-based computer vision pipeline used by **Robot Vision Dashboard**.

The goal is to measure real runtime performance under controlled conditions and make the engineering trade-offs visible.

The benchmark focuses on:

* Object detection latency
* Pipeline FPS
* Detection count
* Average confidence
* Tracking performance
* Browser/hardware impact

> **Important:** This document does not claim benchmark results that have not been measured. Results should be generated from actual runs of the application.

---

## 1. System Under Test

The current perception pipeline is:

```text
Video / Webcam
      ↓
Browser Video Element
      ↓
COCO-SSD
(MobileNet v2)
      ↓
Confidence Filtering
      ↓
Centroid Tracking
      ↓
Canvas Overlay
      ↓
Runtime Metrics
```

The current implementation performs inference locally in the browser using TensorFlow.js and COCO-SSD.

The tracker is a lightweight centroid-based algorithm that associates detections of the same class between consecutive frames.

---

## 2. Benchmark Objectives

The benchmark answers four engineering questions:

### Q1. How fast is inference?

Measure the average model inference latency per processed frame.

**Metric:**

```text
Inference latency (ms/frame)
```

Lower is better.

---

### Q2. How fast can the complete pipeline run?

Measure the effective processing rate of the complete browser pipeline.

**Metric:**

```text
Pipeline FPS
```

Higher is better.

---

### Q3. How stable is the detection pipeline?

Measure detection statistics over a fixed video sequence.

**Metrics:**

```text
Average detections/frame
Average confidence
Tracked objects
```

---

### Q4. What is the performance trade-off?

The objective is not simply to maximize FPS.

A useful perception pipeline needs to balance:

```text
Latency
FPS
Detection quality
Tracking stability
Hardware requirements
```

---

# 3. Experimental Methodology

## Test Input

Use the same video for every benchmark run.

Recommended characteristics:

* Fixed resolution
* Fixed frame rate
* 30–60 seconds duration
* Multiple objects
* Objects entering and leaving the scene
* Some object movement
* No changes between benchmark configurations

Example:

```text
benchmark-video.mp4
Resolution: 1280x720
Source FPS: 30
Duration: 60 seconds
```

Replace these values with the actual benchmark video used.

---

## Warm-up

The first model execution should not be used as the representative performance measurement.

For every run:

1. Load the application.
2. Load the model.
3. Start the test video.
4. Allow the pipeline to warm up.
5. Ignore initial model-loading overhead.
6. Collect measurements after the pipeline reaches steady state.

---

## Number of Runs

Run each configuration at least:

```text
3 independent runs
```

Record the average.

For more reliable measurements:

```text
5 runs
```

can be used.

---

# 4. Metrics

## Inference Latency

Average time required by the model to process one frame.

```text
Latency = model inference time per frame
```

Report:

```text
Mean latency
Minimum latency
Maximum latency
```

If percentile measurements are added later, also report:

```text
P95 latency
```

---

## Pipeline FPS

Approximate number of frames processed per second by the complete pipeline.

```text
FPS = processed frames / elapsed time
```

This metric represents the practical throughput of the browser-side perception pipeline.

---

## Detection Count

Average number of detections generated per processed frame.

```text
Average detections/frame
```

This provides context for the computational workload.

---

## Average Confidence

Average confidence score of the detected objects.

The current application uses:

```text
Confidence threshold = 0.55
```

This threshold is intentionally documented as part of the experiment because changing it can affect both displayed detections and downstream tracking behavior.

---

## Tracking

Record:

```text
Average tracked objects
Track continuity observations
Lost/recovered tracks
```

The current tracker is a lightweight centroid-based implementation.

It is intended for demonstrating browser-side tracking rather than production-grade multi-object tracking.

---

# 5. Benchmark Configurations

The benchmark should compare configurations only when they are actually implemented and tested.

### Configuration A — Baseline

```text
Model: COCO-SSD
Base model: MobileNet v2
Confidence threshold: 0.55
Tracking: Centroid tracker
Environment: Browser
```

### Configuration B — Different Detection Threshold

```text
Model: COCO-SSD
Base model: MobileNet v2
Confidence threshold: [VALUE]
Tracking: Centroid tracker
```

Use this configuration to investigate the trade-off between detection filtering and tracking workload.

### Configuration C — Alternative Model

Only include this configuration if an alternative model is actually implemented in the repository.

```text
Model: [MODEL]
Base model: [BACKBONE]
Confidence threshold: [VALUE]
Tracking: [TRACKER]
```

> Do not report a configuration as benchmarked until it has been implemented and measured.

---

# 6. Results

## Summary

| Configuration   | Avg Latency (ms) | Avg FPS | Avg Detections/Frame | Avg Confidence | Avg Tracked Objects |
| --------------- | ---------------: | ------: | -------------------: | -------------: | ------------------: |
| Baseline        |              TBD |     TBD |                  TBD |            TBD |                 TBD |
| Configuration B |              TBD |     TBD |                  TBD |            TBD |                 TBD |
| Configuration C |              TBD |     TBD |                  TBD |            TBD |                 TBD |

---

## Latency

| Configuration   | Run 1 | Run 2 | Run 3 | Average |
| --------------- | ----: | ----: | ----: | ------: |
| Baseline        |   TBD |   TBD |   TBD |     TBD |
| Configuration B |   TBD |   TBD |   TBD |     TBD |
| Configuration C |   TBD |   TBD |   TBD |     TBD |

---

## FPS

| Configuration   | Run 1 | Run 2 | Run 3 | Average |
| --------------- | ----: | ----: | ----: | ------: |
| Baseline        |   TBD |   TBD |   TBD |     TBD |
| Configuration B |   TBD |   TBD |   TBD |     TBD |
| Configuration C |   TBD |   TBD |   TBD |     TBD |

---

# 7. Test Environment

Performance results are hardware and browser dependent.

Record the environment used for the benchmark.

```text
Operating System:
CPU:
GPU:
RAM:
Browser:
Browser Version:
TensorFlow.js Version:
COCO-SSD Version:
Video Resolution:
Video FPS:
Video Duration:
```

Example:

```text
Operating System: Windows 11
CPU: [CPU]
GPU: [GPU]
RAM: [RAM]
Browser: Chrome
Browser Version: [VERSION]
TensorFlow.js: [VERSION]
COCO-SSD: [VERSION]
Video Resolution: 1280x720
Video FPS: 30
Video Duration: 60s
```

---

# 8. Engineering Decisions

The benchmark exists to make engineering decisions measurable rather than subjective.

## Browser-side inference

The current system performs inference locally in the browser.

### Reason

This keeps the demo:

* Self-contained
* Easy to run
* Low infrastructure
* Suitable for real-time portfolio demonstration

### Trade-off

Browser performance varies significantly with:

* CPU
* GPU
* Browser implementation
* Device capabilities
* Thermal conditions

Therefore, benchmark results are environment-specific.

---

## MobileNet v2

The current COCO-SSD configuration uses MobileNet v2 as the lightweight base model.

### Reason

The project prioritizes interactive browser performance over maximum detection accuracy.

### Trade-off

A lighter model can reduce computational requirements but may provide different detection characteristics compared with larger models.

The benchmark should therefore report performance together with detection statistics rather than FPS alone.

---

## Confidence threshold

The current threshold is:

```text
0.55
```

### Reason

The threshold reduces weaker predictions and keeps the dashboard focused on stronger detections.

### Trade-off

Increasing the threshold may reduce false or weak detections but can also remove valid objects.

Therefore the threshold should be treated as a benchmark parameter rather than an arbitrary constant.

---

## Centroid tracking

The project adds centroid tracking because COCO-SSD provides detections but does not provide persistent object IDs.

### Reason

A centroid tracker is:

* Lightweight
* Easy to understand
* Suitable for browser execution
* Sufficient for demonstrating temporal association

### Trade-off

It is less robust than production multi-object tracking approaches under:

* Occlusion
* Fast movement
* Object crossing
* Long periods without detection

The implementation is therefore intentionally positioned as a lightweight perception component, not a production tracker.

---

# 9. Interpretation Guidelines

The benchmark should not treat a single metric as the definition of system quality.

For example:

```text
Higher FPS ≠ automatically better system
```

A configuration with higher FPS but significantly worse detection behavior may not be preferable for a perception workload.

Similarly:

```text
Lower latency ≠ automatically better system
```

Latency should be interpreted together with detection and tracking behavior.

The relevant engineering question is:

> What configuration provides an acceptable balance between real-time performance and perception behavior for the intended workload?

---

# 10. Reproducibility Checklist

Before publishing benchmark results, verify:

* [ ] Same input video used for all configurations
* [ ] Same video resolution
* [ ] Same video frame rate
* [ ] Same browser
* [ ] Same hardware
* [ ] Same confidence threshold when comparing models
* [ ] Model warm-up completed
* [ ] At least 3 runs per configuration
* [ ] Runtime metrics recorded
* [ ] Environment documented
* [ ] No simulated telemetry included in perception performance measurements

---

# 11. Current Benchmark Status

At the time of writing:

```text
Runtime performance instrumentation: IMPLEMENTED
Inference latency measurement: IMPLEMENTED
Pipeline FPS measurement: IMPLEMENTED
Detection metrics: IMPLEMENTED
Tracking metrics: IMPLEMENTED
Reproducible benchmark methodology: DOCUMENTED
Comparative benchmark results: PENDING
```

The repository should only publish numerical benchmark results after they have been collected from actual runs.

---

# 12. Future Benchmark Work

Potential extensions include:

1. Compare multiple detection models.
2. Compare different confidence thresholds.
3. Measure P50/P95 inference latency.
4. Measure FPS stability over long runs.
5. Test multiple video resolutions.
6. Compare CPU-only vs GPU/browser acceleration where available.
7. Evaluate tracking continuity on a labeled test sequence.
8. Add automated benchmark data export.
9. Store benchmark results as CSV/JSON.
10. Generate reproducible benchmark charts.

---

## Conclusion

The purpose of this benchmark is to turn the Robot Vision Dashboard from a visual computer-vision demonstration into a measurable engineering experiment.

The current system already exposes runtime performance metrics. This benchmark provides the methodology required to turn those measurements into reproducible evidence.

**No performance number should be considered a benchmark result until it has been measured under the documented test conditions.**
