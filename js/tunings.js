(function () {
  const presets = [
    { id: "standard", name: "E Standard", notes: ["E2", "A2", "D3", "G3", "B3", "E4"] },
    { id: "eb-standard", name: "Eb Standard", notes: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"] },
    { id: "d-standard", name: "D Standard", notes: ["D2", "G2", "C3", "F3", "A3", "D4"] },
    { id: "drop-d", name: "Drop D", notes: ["D2", "A2", "D3", "G3", "B3", "E4"] },
    { id: "drop-c", name: "Drop C", notes: ["C2", "G2", "C3", "F3", "A3", "D4"] },
    { id: "c-standard", name: "C Standard", notes: ["C2", "F2", "Bb2", "Eb3", "G3", "C4"] },
    { id: "dadgad", name: "DADGAD", notes: ["D2", "A2", "D3", "G3", "A3", "D4"] },
    { id: "open-d", name: "Open D", notes: ["D2", "A2", "D3", "F#3", "A3", "D4"] },
    { id: "open-g", name: "Open G", notes: ["D2", "G2", "D3", "G3", "B3", "D4"] }
  ];

  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flatNames = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };

  function noteToMidi(note) {
    const match = /^([A-G])([#b]?)(-?\d+)$/.exec(String(note));
    if (!match) return null;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
    let accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
    return (Number(match[3]) + 1) * 12 + base + accidental;
  }

  function midiToNote(midi, preferFlats = false) {
    const rounded = Math.round(midi);
    const pitchClass = ((rounded % 12) + 12) % 12;
    const octave = Math.floor(rounded / 12) - 1;
    let name = noteNames[pitchClass];
    if (preferFlats && flatNames[name]) name = flatNames[name];
    return `${name}${octave}`;
  }

  function frequencyFromMidi(midi, referenceA4 = 440) {
    return referenceA4 * Math.pow(2, (midi - 69) / 12);
  }

  function frequencyFromNote(note, referenceA4 = 440) {
    const midi = noteToMidi(note);
    return midi === null ? null : frequencyFromMidi(midi, referenceA4);
  }

  window.GuitarTunings = {
    presets,
    noteNames,
    noteToMidi,
    midiToNote,
    frequencyFromMidi,
    frequencyFromNote
  };
})();
