(function () {
  const Tuning = window.GuitarTunings;
  const Pitch = window.PitchDetection;
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    tuningSelect: $("#tuning-select"),
    customButton: $("#custom-button"),
    autoMode: $("#auto-mode"),
    manualMode: $("#manual-mode"),
    detectedNote: $("#detected-note"),
    tuningStatus: $("#tuning-status"),
    targetNote: $("#target-note"),
    targetLabel: $("#target-label"),
    signalBadge: $("#signal-badge"),
    meterNeedle: $("#meter-needle"),
    meterTicks: $("#meter-ticks"),
    frequencyValue: $("#frequency-value"),
    centsValue: $("#cents-value"),
    stringValue: $("#string-value"),
    permissionMessage: $("#permission-message"),
    micButton: $("#mic-button"),
    micButtonLabel: $("#mic-button-label"),
    micIndicator: $("#mic-indicator"),
    stringList: $("#string-list"),
    stringModeHint: $("#string-mode-hint"),
    customDialog: $("#custom-dialog"),
    customForm: $("#custom-form"),
    customStringFields: $("#custom-string-fields"),
    settingsDialog: $("#settings-dialog"),
    settingsButton: $("#settings-button"),
    referenceSelect: $("#reference-select")
  };

  const state = {
    presetId: "standard",
    tuningName: "E Standard",
    notes: ["E2", "A2", "D3", "G3", "B3", "E4"],
    mode: "auto",
    selectedString: 0,
    referenceA4: 440,
    audioContext: null,
    stream: null,
    analyser: null,
    source: null,
    buffer: null,
    animationId: null,
    lastProcessTime: 0,
    lastFrequency: null,
    activeStringIndex: -1,
    autoCandidateIndex: -1,
    autoCandidateCount: 0,
    customNotes: ["E2", "A2", "D3", "G3", "B3", "E4"],
    isRunning: false
  };

  const stringNames = ["LOW E", "A", "D", "G", "B", "HIGH E"];
  const AUTO_STRING_CONFIRM_FRAMES = 2;
  const AUTO_STRING_MAX_DISTANCE_CENTS = 260;
  const AUTO_STRING_MIN_CLARITY = 0.70;

  function setMessage(message, isError = false) {
    elements.permissionMessage.textContent = message;
    elements.permissionMessage.classList.toggle("error", isError);
  }

  function buildPresetOptions() {
    elements.tuningSelect.innerHTML = "";
    Tuning.presets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name;
      elements.tuningSelect.append(option);
    });
    const custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "Custom tuning";
    elements.tuningSelect.append(custom);
  }

  function renderTicks() {
    elements.meterTicks.innerHTML = "";
    for (let i = 0; i < 21; i += 1) {
      const tick = document.createElement("span");
      tick.className = "meter-tick";
      elements.meterTicks.append(tick);
    }
  }

  function renderStrings(activeIndex = (state.mode === "manual" ? state.selectedString : state.activeStringIndex)) {
    elements.stringList.innerHTML = "";
    state.notes.forEach((note, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `string-button string-${6 - index}${index === activeIndex ? " active" : ""}`;
      button.setAttribute("aria-label", `String ${6 - index}, target ${note}`);
      button.setAttribute("aria-pressed", String(index === activeIndex));
      button.innerHTML = `<span class="string-number">${6 - index}</span><span class="string-note">${escapeHtml(note.replace(/\d+$/, ""))}</span><span class="string-name">${stringNames[index]}</span>`;
      button.addEventListener("click", () => {
        state.mode = "manual";
        state.activeStringIndex = -1;
        resetAutoStringCandidate();
        state.selectedString = index;
        updateModeUI();
        renderStrings();
        updateTargetText();
        if (state.lastFrequency) updatePitchUI(state.lastFrequency);
      });
      elements.stringList.append(button);
    });
  }

  function highlightString(activeIndex) {
    [...elements.stringList.querySelectorAll(".string-button")].forEach((button, index) => {
      const active = index === activeIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function updateModeUI() {
    const auto = state.mode === "auto";
    elements.autoMode.classList.toggle("active", auto);
    elements.manualMode.classList.toggle("active", !auto);
    elements.autoMode.setAttribute("aria-pressed", String(auto));
    elements.manualMode.setAttribute("aria-pressed", String(!auto));
    if (elements.stringModeHint) {
      elements.stringModeHint.textContent = auto
        ? "Tap a string to switch to manual"
        : "Manual mode · choose a string below";
    }
    updateTargetText();
  }

  function updateTargetText() {
    if (state.mode === "auto") {
      elements.targetLabel.textContent = `${state.tuningName.toUpperCase()} · AUTO`;
      elements.targetNote.textContent = state.lastFrequency ? `TARGET ${state.notes[findNearestString(state.lastFrequency)].toUpperCase()}` : "TARGET —";
    } else {
      elements.targetLabel.textContent = `${state.tuningName.toUpperCase()} · STRING ${6 - state.selectedString}`;
      elements.targetNote.textContent = `TARGET ${state.notes[state.selectedString].toUpperCase()}`;
    }
  }

  function applyPreset(presetId) {
    if (presetId === "custom") {
      state.notes = [...state.customNotes];
      state.presetId = "custom";
      state.tuningName = "Custom tuning";
    } else {
      const preset = Tuning.presets.find((item) => item.id === presetId) || Tuning.presets[0];
      state.notes = [...preset.notes];
      state.presetId = preset.id;
      state.tuningName = preset.name;
    }
    state.lastFrequency = null;
    state.selectedString = 0;
    resetAutoStringDetection(true);
    resetReadout();
    renderStrings();
    updateTargetText();
  }

  function resetReadout() {
    elements.detectedNote.textContent = "--";
    elements.detectedNote.className = "detected-note";
    elements.tuningStatus.textContent = "Start tuning by playing any string";
    elements.tuningStatus.className = "tuning-status";
    elements.signalBadge.textContent = state.isRunning ? "LISTENING" : "WAITING";
    elements.signalBadge.className = "signal-badge";
    elements.meterNeedle.style.left = "50%";
    elements.meterNeedle.className = "meter-needle";
    elements.frequencyValue.innerHTML = "— <small>Hz</small>";
    elements.centsValue.innerHTML = "— <small>cents</small>";
    elements.stringValue.textContent = "—";
    elements.targetNote.textContent = "TARGET —";
  }

  function centsBetween(frequency, targetFrequency) {
    return 1200 * Math.log2(frequency / targetFrequency);
  }

  function findNearestStringMatch(frequency) {
    let bestIndex = -1;
    let bestDistance = Infinity;

    state.notes.forEach((note, index) => {
      const targetFrequency = Tuning.frequencyFromNote(note, state.referenceA4);
      if (!Number.isFinite(targetFrequency) || targetFrequency <= 0) return;

      const distance = Math.abs(centsBetween(frequency, targetFrequency));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return { index: bestIndex, distanceCents: bestDistance };
  }

  function findNearestString(frequency) {
    return findNearestStringMatch(frequency).index;
  }

  function resetAutoStringCandidate() {
    state.autoCandidateIndex = -1;
    state.autoCandidateCount = 0;
  }

  function resetAutoStringDetection(clearActive = false) {
    resetAutoStringCandidate();
    if (clearActive) state.activeStringIndex = -1;
    if (state.mode === "auto") highlightString(state.activeStringIndex);
  }

  function confirmAutoString(frequency, clarity = 1) {
    if (state.mode !== "auto") return;

    if (!Number.isFinite(clarity) || clarity < AUTO_STRING_MIN_CLARITY) {
      resetAutoStringCandidate();
      return;
    }

    const match = findNearestStringMatch(frequency);
    if (
      match.index < 0 ||
      !Number.isFinite(match.distanceCents) ||
      match.distanceCents > AUTO_STRING_MAX_DISTANCE_CENTS
    ) {
      resetAutoStringCandidate();
      return;
    }

    if (match.index === state.autoCandidateIndex) {
      state.autoCandidateCount += 1;
    } else {
      state.autoCandidateIndex = match.index;
      state.autoCandidateCount = 1;
    }

    // Confirm a string only after two consecutive, confident pitch readings.
    if (
      state.autoCandidateCount >= AUTO_STRING_CONFIRM_FRAMES &&
      state.activeStringIndex !== match.index
    ) {
      state.activeStringIndex = match.index;
      highlightString(match.index);
    }
  }

  function updatePitchUI(frequency) {
    if (!Number.isFinite(frequency) || frequency <= 0) return;

    const match = findNearestStringMatch(frequency);
    const stringIndex = state.mode === "auto" ? match.index : state.selectedString;
    if (stringIndex < 0 || stringIndex >= state.notes.length) return;

    const target = state.notes[stringIndex];
    const targetFrequency = Tuning.frequencyFromNote(target, state.referenceA4);
    const midi = 69 + 12 * Math.log2(frequency / state.referenceA4);
    const detected = Tuning.midiToNote(midi);
    const cents = centsBetween(frequency, targetFrequency);
    const clampedCents = Math.max(-50, Math.min(50, cents));
    const status = Math.abs(cents) <= 5 ? "good" : cents < 0 ? "low" : "high";
    const statusText = status === "good" ? "In tune" : status === "low" ? "Too low · tune up" : "Too high · tune down";

    elements.detectedNote.textContent = detected.replace(/(-?\d+)$/, "");
    elements.detectedNote.className = `detected-note ${status} is-visible`;
    elements.tuningStatus.textContent = statusText;
    elements.tuningStatus.className = `tuning-status ${status}`;
    elements.targetNote.textContent = `TARGET ${target.toUpperCase()}`;
    elements.signalBadge.textContent = status === "good" ? "IN TUNE" : status === "low" ? "TOO LOW" : "TOO HIGH";
    elements.signalBadge.className = `signal-badge ${status}`;
    elements.meterNeedle.style.left = `${50 + clampedCents}%`;
    elements.meterNeedle.className = `meter-needle ${status}`;
    elements.frequencyValue.innerHTML = `${frequency.toFixed(1)} <small>Hz</small>`;
    elements.centsValue.innerHTML = `${cents > 0 ? "+" : ""}${cents.toFixed(0)} <small>cents</small>`;
    elements.stringValue.textContent = `${6 - stringIndex} · ${target}`;
    elements.stringValue.style.color = status === "good" ? "var(--green)" : "var(--text)";
  }

  function processAudio(timestamp) {
    if (!state.isRunning || !state.analyser || !state.buffer) return;
    state.animationId = requestAnimationFrame(processAudio);
    if (timestamp - state.lastProcessTime < 75) return;
    state.lastProcessTime = timestamp;

    state.analyser.getFloatTimeDomainData(state.buffer);
    const result = Pitch.detectPitch(state.buffer, state.audioContext.sampleRate, {
      minFrequency: 48,
      maxFrequency: 1000,
      threshold: 0.16,
      rmsThreshold: 0.008
    });

    if (!result) {
      resetAutoStringCandidate();
      return;
    }

    // Light smoothing reduces visual jitter but resets quickly when another string is played.
    let frequency = result.frequency;
    if (state.lastFrequency && Math.abs(1200 * Math.log2(frequency / state.lastFrequency)) < 120) {
      frequency = state.lastFrequency * 0.35 + frequency * 0.65;
    }
    state.lastFrequency = frequency;
    confirmAutoString(frequency, result.clarity);
    updatePitchUI(frequency);
  }

  async function startTuner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage("Microphone access is not available here. Open this app on localhost or an HTTPS website using a supported browser.", true);
      return;
    }

    try {
      setMessage("Requesting microphone permission…");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      state.stream = stream;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("This browser does not support the Web Audio API.");

      const audioContext = new AudioContextClass();
      state.audioContext = audioContext;
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      state.source = source;
      state.analyser = analyser;
      state.buffer = new Float32Array(analyser.fftSize);
      state.isRunning = true;
      state.lastFrequency = null;
      state.lastProcessTime = 0;
      elements.micButton.classList.add("is-running");
      elements.micButtonLabel.textContent = "Stop tuning";
      elements.micIndicator.classList.add("is-on");
      elements.micIndicator.innerHTML = "<i></i> MIC ON";
      setMessage("Microphone is active. Play one string at a time and let the note ring.");
      resetReadout();
      state.animationId = requestAnimationFrame(processAudio);
    } catch (error) {
      console.error("Unable to start tuner:", error);
      let message = "Could not access the microphone. Check browser permissions and try again.";
      if (error && error.name === "NotAllowedError") message = "Microphone permission was denied. Allow microphone access in your browser settings, then try again.";
      if (error && error.name === "NotFoundError") message = "No microphone was found. Connect or enable a microphone and try again.";
      if (error && error.name === "NotReadableError") message = "The microphone is busy in another app. Close that app and try again.";
      setMessage(message, true);
      await stopTuner();
    }
  }

  async function stopTuner() {
    state.isRunning = false;
    if (state.animationId) cancelAnimationFrame(state.animationId);
    state.animationId = null;
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    if (state.source) {
      try { state.source.disconnect(); } catch (_) { /* already disconnected */ }
    }
    if (state.audioContext && state.audioContext.state !== "closed") {
      try { await state.audioContext.close(); } catch (_) { /* browser may already have closed it */ }
    }
    state.stream = null;
    state.source = null;
    state.analyser = null;
    state.audioContext = null;
    state.buffer = null;
    state.lastFrequency = null;
    resetAutoStringDetection(true);
    renderStrings();
    elements.micButton.classList.remove("is-running");
    elements.micButtonLabel.textContent = "Start tuning";
    elements.micIndicator.classList.remove("is-on");
    elements.micIndicator.innerHTML = "<i></i> MIC OFF";
    resetReadout();
    if (!elements.permissionMessage.classList.contains("error")) {
      setMessage("Tuner stopped. Start again when you are ready.");
    }
  }

  function buildCustomFields() {
    elements.customStringFields.innerHTML = "";
    state.customNotes.forEach((note, index) => {
      const row = document.createElement("div");
      row.className = "custom-string-row";
      const label = document.createElement("span");
      label.textContent = `String ${6 - index}`;
      const noteSelect = document.createElement("select");
      noteSelect.dataset.index = String(index);
      noteSelect.setAttribute("aria-label", `String ${6 - index} note`);
      const octaveSelect = document.createElement("select");
      octaveSelect.dataset.index = String(index);
      octaveSelect.setAttribute("aria-label", `String ${6 - index} octave`);

      Tuning.noteNames.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        noteSelect.append(option);
      });
      [1, 2, 3, 4, 5].forEach((octave) => {
        const option = document.createElement("option");
        option.value = String(octave);
        option.textContent = `Octave ${octave}`;
        octaveSelect.append(option);
      });

      const parsed = /^([A-G][#b]?)(-?\d+)$/.exec(note);
      const flatToSharp = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
      noteSelect.value = parsed ? (flatToSharp[parsed[1]] || parsed[1]) : "E";
      octaveSelect.value = parsed ? parsed[2] : "2";
      row.append(label, noteSelect, octaveSelect);
      elements.customStringFields.append(row);
    });
  }

  function saveCustomTuning(event) {
    event.preventDefault();
    const rows = [...elements.customStringFields.querySelectorAll(".custom-string-row")];
    const notes = rows.map((row) => {
      const note = row.querySelector("select:nth-of-type(1)").value;
      const octave = row.querySelector("select:nth-of-type(2)").value;
      return `${note}${octave}`;
    });
    if (notes.some((note) => Tuning.noteToMidi(note) === null)) return;
    state.customNotes = notes;
    elements.customDialog.close();
    elements.tuningSelect.value = "custom";
    applyPreset("custom");
    setMessage("Custom tuning saved. Start the tuner to check your strings.");
  }

  function bindEvents() {
    elements.tuningSelect.addEventListener("change", () => {
      if (elements.tuningSelect.value === "custom") {
        if (state.presetId !== "custom") state.customNotes = [...state.notes];
        buildCustomFields();
        elements.customDialog.showModal();
        return;
      }
      applyPreset(elements.tuningSelect.value);
    });

    elements.customButton.addEventListener("click", () => {
      if (state.presetId !== "custom") state.customNotes = [...state.notes];
      buildCustomFields();
      elements.customDialog.showModal();
    });
    elements.customForm.addEventListener("submit", saveCustomTuning);
    $("#cancel-custom").addEventListener("click", () => {
      elements.customDialog.close();
      elements.tuningSelect.value = state.presetId;
    });
    $("#close-dialog").addEventListener("click", () => {
      elements.customDialog.close();
      elements.tuningSelect.value = state.presetId;
    });
    elements.customDialog.addEventListener("click", (event) => {
      if (event.target === elements.customDialog) {
        elements.customDialog.close();
        elements.tuningSelect.value = state.presetId;
      }
    });

    elements.autoMode.addEventListener("click", () => {
      state.mode = "auto";
      resetAutoStringCandidate();
      updateModeUI();
      renderStrings();
      if (state.lastFrequency) updatePitchUI(state.lastFrequency);
    });
    elements.manualMode.addEventListener("click", () => {
      if (state.activeStringIndex >= 0) {
        state.selectedString = state.activeStringIndex;
      }
      state.mode = "manual";
      state.activeStringIndex = -1;
      resetAutoStringCandidate();
      updateModeUI();
      renderStrings(state.selectedString);
      if (state.lastFrequency) updatePitchUI(state.lastFrequency);
    });
    elements.micButton.addEventListener("click", () => {
      if (state.isRunning) stopTuner();
      else startTuner();
    });

    elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
    $("#close-settings").addEventListener("click", () => elements.settingsDialog.close());
    $("#done-settings").addEventListener("click", () => elements.settingsDialog.close());
    elements.referenceSelect.addEventListener("change", () => {
      state.referenceA4 = Number(elements.referenceSelect.value) || 440;
      if (state.lastFrequency) updatePitchUI(state.lastFrequency);
    });
    elements.settingsDialog.addEventListener("click", (event) => {
      if (event.target === elements.settingsDialog) elements.settingsDialog.close();
    });
    window.addEventListener("pagehide", () => {
      if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    });
  }

  function init() {
    buildPresetOptions();
    renderTicks();
    renderStrings();
    updateModeUI();
    updateTargetText();
    bindEvents();
    setMessage("Allow microphone access to start tuning. Your audio is processed on this device.");
    console.info("Guitar Tuner initialized.");
  }

  init();
})();
