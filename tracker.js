/**
 * Lightweight class-aware tracker for consecutive video frames.
 * Combines bounding-box IoU and centroid distance, retaining short missed tracks.
 * This baseline is not a Kalman-filter or appearance-based tracking algorithm.
 */
export class CentroidTracker {
  constructor({ maxDistance = 90, maxDisappeared = 5, iouWeight = 0.4 } = {}) {
    this.maxDistance = maxDistance;
    this.maxDisappeared = maxDisappeared;
    this.iouWeight = iouWeight;
    this.nextId = 1;
    this.tracks = [];
  }
  static centroid(box) {
    return { x: box[0] + box[2] / 2, y: box[1] + box[3] / 2 };
  }
  static intersectionOverUnion(a, b) {
    const left = Math.max(a[0], b[0]), top = Math.max(a[1], b[1]);
    const right = Math.min(a[0] + a[2], b[0] + b[2]);
    const bottom = Math.min(a[1] + a[3], b[1] + b[3]);
    const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
    const union = a[2] * a[3] + b[2] * b[3] - intersection;
    return union > 0 ? intersection / union : 0;
  }
  update(predictions = []) {
    const detections = predictions.map((prediction) => ({
      ...prediction, centroid: CentroidTracker.centroid(prediction.bbox), trackId: null,
    }));
    const pairs = [];
    detections.forEach((detection, detectionIndex) => {
      this.tracks.forEach((track, trackIndex) => {
        if (track.className !== detection.class) return;
        const distance = Math.hypot(detection.centroid.x - track.x, detection.centroid.y - track.y);
        const iou = CentroidTracker.intersectionOverUnion(detection.bbox, track.bbox);
        if (distance > this.maxDistance && iou === 0) return;
        const normalizedDistance = Math.min(distance / this.maxDistance, 1);
        const cost = (1 - this.iouWeight) * normalizedDistance + this.iouWeight * (1 - iou);
        pairs.push({ detectionIndex, trackIndex, cost });
      });
    });
    pairs.sort((a, b) => a.cost - b.cost);
    const usedDetections = new Set(), usedTracks = new Set();
    pairs.forEach(({ detectionIndex, trackIndex }) => {
      if (usedDetections.has(detectionIndex) || usedTracks.has(trackIndex)) return;
      const detection = detections[detectionIndex], track = this.tracks[trackIndex];
      detection.trackId = track.id;
      track.x = detection.centroid.x; track.y = detection.centroid.y;
      track.bbox = [...detection.bbox]; track.missedFrames = 0;
      usedDetections.add(detectionIndex); usedTracks.add(trackIndex);
    });
    this.tracks.forEach((track, index) => {
      if (!usedTracks.has(index)) track.missedFrames += 1;
    });
    this.tracks = this.tracks.filter((track) => track.missedFrames <= this.maxDisappeared);
    detections.forEach((detection) => {
      if (detection.trackId !== null) return;
      detection.trackId = this.nextId++;
      this.tracks.push({
        id: detection.trackId, className: detection.class,
        x: detection.centroid.x, y: detection.centroid.y,
        bbox: [...detection.bbox], missedFrames: 0,
      });
    });
    return detections;
  }
  reset() {
    this.tracks = [];
    this.nextId = 1;
  }
}
