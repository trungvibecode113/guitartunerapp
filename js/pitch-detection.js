(function () {
  /**
   * YIN fundamental-frequency detector.
   * Input: Float32Array from AnalyserNode.getFloatTimeDomainData().
   * Returns frequency in Hz, or null when no stable pitch is found.
   */
  function detectPitch(buffer, sampleRate, options = {}) {
    const minFrequency = options.minFrequency ?? 48;
    const maxFrequency = options.maxFrequency ?? 430;
    const threshold = options.threshold ?? 0.15;
    const length = buffer.length;
    const halfLength = Math.floor(length / 2);

    let sumSquares = 0;
    for (let i = 0; i < length; i += 1) sumSquares += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSquares / length);
    if (rms < (options.rmsThreshold ?? 0.008)) return null;

    const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
    const maxTau = Math.min(halfLength - 1, Math.floor(sampleRate / minFrequency));
    if (maxTau <= minTau) return null;

    const difference = new Float32Array(maxTau + 1);
    const normalized = new Float32Array(maxTau + 1);
    normalized[0] = 1;
    let runningSum = 0;

    for (let tau = 1; tau <= maxTau; tau += 1) {
      let delta = 0;
      const limit = halfLength - tau;
      for (let i = 0; i < limit; i += 1) {
        const differenceValue = buffer[i] - buffer[i + tau];
        delta += differenceValue * differenceValue;
      }
      difference[tau] = delta;
      runningSum += delta;
      normalized[tau] = runningSum === 0 ? 1 : (delta * tau) / runningSum;
    }

    let selectedTau = -1;
    for (let tau = minTau; tau <= maxTau; tau += 1) {
      if (normalized[tau] < threshold) {
        while (tau + 1 <= maxTau && normalized[tau + 1] < normalized[tau]) tau += 1;
        selectedTau = tau;
        break;
      }
    }

    if (selectedTau === -1) {
      let bestValue = Infinity;
      for (let tau = minTau; tau <= maxTau; tau += 1) {
        if (normalized[tau] < bestValue) {
          bestValue = normalized[tau];
          selectedTau = tau;
        }
      }
      if (bestValue > 0.28) return null;
    }

    // Parabolic interpolation gives a more precise estimate between samples.
    const left = normalized[selectedTau - 1] ?? normalized[selectedTau];
    const center = normalized[selectedTau];
    const right = normalized[selectedTau + 1] ?? normalized[selectedTau];
    const denominator = 2 * (2 * center - right - left);
    const adjustment = denominator === 0 ? 0 : (right - left) / denominator;
    const refinedTau = selectedTau + Math.max(-1, Math.min(1, adjustment));
    const frequency = sampleRate / refinedTau;

    if (!Number.isFinite(frequency) || frequency < minFrequency || frequency > maxFrequency) return null;
    return { frequency, rms, clarity: 1 - normalized[selectedTau] };
  }

  window.PitchDetection = { detectPitch };
})();
