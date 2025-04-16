// Import the Voice class, which handles synthesis for individual notes
import Voice from "./Voice.js";

// --------------------------------------
// Scale and Key Definitions
// --------------------------------------

/**
 * @constant {Object} scales
 * @description Maps scale names to arrays of semitone offsets from the root.
 */
const scales = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  "Natural Minor": [0, 2, 3, 5, 7, 8, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Melodic Minor": [0, 2, 3, 5, 7, 9, 11],
  "Major Pentatonic": [0, 2, 4, 7, 9],
  "Minor Pentatonic": [0, 3, 5, 7, 10],
  "Blues": [0, 3, 5, 6, 7, 10],
  "Perfect 5th": [0, 7],
  "Dorian": [0, 2, 3, 5, 7, 9, 10],
  "Phrygian": [0, 1, 3, 5, 7, 8, 10],
  "Lydian": [0, 2, 4, 6, 7, 9, 11],
  "Mixolydian": [0, 2, 4, 5, 7, 9, 10],
  "Locrian": [0, 1, 3, 5, 6, 8, 10],
  "Whole Tone": [0, 2, 4, 6, 8, 10],
  "Chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "Octatonic (Half-Whole)": [0, 1, 3, 4, 6, 7, 9, 10],
  "Octatonic (Whole-Half)": [0, 2, 3, 5, 6, 8, 9, 11],
  "Hungarian Minor": [0, 2, 3, 6, 7, 8, 11],
  "Persian": [0, 1, 4, 5, 6, 8, 11],
  "Arabic": [0, 2, 4, 5, 6, 8, 10],
  "Neapolitan Minor": [0, 1, 3, 5, 7, 8, 11],
  "Neapolitan Major": [0, 1, 3, 5, 7, 9, 11],
  "Enigmatic": [0, 1, 4, 6, 8, 10, 11],
  "Double Harmonic": [0, 1, 4, 5, 7, 8, 11],
  "Pelog": [0, 1, 3, 7, 8],
  "Yo Scale": [0, 2, 3, 7, 9],
  "Hirajoshi": [0, 2, 3, 7, 8],
  "Iwato": [0, 1, 5, 6, 10]
};

/**
 * @constant {Object} key
 * @description Maps key names to their corresponding MIDI root note numbers.
 */
const key = {
  C: 0,
  "C#/D\u266D": 1,
  D: 2,
  "D#/E\u266D": 3,
  E: 4,
  F: 5,
  "F#/G\u266D": 6,
  G: 7,
  "G#/A\u266D": 8,
  A: 9,
  "A#/B\u266D": 10,
  B: 11
};

// --------------------------------------
// UI Population for Key and Scale Dropdowns
// --------------------------------------

const keyDropdown = document.getElementById("keySelect");
const scaleDropdown = document.getElementById("scaleSelect");

// Populate the key dropdown
for (let k in key) {
  keyDropdown.innerHTML += `<optio value='${k}'>${k}</optio>`;
}

// Populate the scale dropdown
for (let s in scales) {
  scaleDropdown.innerHTML += `<option value='${s}'>${scales}</option>`;
}

// --------------------------------------
// Key and Scale Selection Handling
// --------------------------------------

let currentKey;
let currentScale;

/**
 * @function updateKeyScale
 * @description Updates the current key and scale based on dropdown selection.
 */
const updateKeyScale = function () {
  currentKey = key[keyDropdown.value];
  console.log(scaleDropdown.value);
  currentScale = scales[scaleDropdown.value].map(d => (d + currentKey) % 12);
  console.log(currentScale);
};

// Initialize with default selections
updateKeyScale();

keyDropdown.addEventListener("change", updateKeyScale);
scaleDropdown.addEventListener("change", updateKeyScale);

// --------------------------------------
// Audio Context and Synth Setup
// --------------------------------------

/**
 * @constant {AudioContext} mySynthCtx
 * @description The main WebAudio AudioContext for the synthesizer.
 */
const mySynthCtx = new AudioContext();

/**
 * @constant {Object} activeVoices
 * @description Stores currently active voices, indexed by MIDI note number.
 */
const activeVoices = {};

/**
 * @constant {GainNode} masterGain
 * @description Master gain control for the synth.
 */
const masterGain = mySynthCtx.createGain();
masterGain.gain.value = 0.125; // Set master volume

// Connect master gain to the audio output
masterGain.connect(mySynthCtx.destination);

/**
 * @function mtof
 * @description Converts a MIDI note number to its corresponding frequency in Hz.
 * @param {number} midi - The MIDI note number (e.g., 60 for C4).
 * @returns {number} The frequency in Hz.
 */
const mtof = function (midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

/**
 * @function startNote
 * @description Starts a note by creating and storing a new Voice instance.
 * @param {number} note - The MIDI note number.
 * @param {number} velocity - The velocity of the note (0–127).
 */
const startNote = function (note, velocity) {
  if (!activeVoices[note]) {
    let normVelocity = velocity / 127;
    normVelocity = Math.pow(normVelocity, 3); // Optional expressive curve
    let freq = mtof(note);
    let someVoice = new Voice(mySynthCtx, freq, normVelocity, masterGain);
    activeVoices[note] = someVoice;
    activeVoices[note].start();
  }
};

/**
 * @function stopNote
 * @description Stops a currently playing note and removes it from activeVoices.
 * @param {number} note - The MIDI note number.
 */
const stopNote = function (note) {
  if (activeVoices[note]) {
    activeVoices[note].stop();

  }
};

// --------------------------------------
// MIDI Handling
// --------------------------------------

/**
 * @function midiParser
 * @description Parses incoming MIDI events and triggers synth behavior.
 * @param {MIDIMessageEvent} midiEvent - The incoming MIDI event.
 */
const midiParser = function (midiEvent) {
  let command = midiEvent.data[0] & 0xF0;
  let channel = midiEvent.data[0] & 0x0F;

  switch (command) {
    case 0x90: // Note on
      if (midiEvent.data[2] > 0) {
        startNote(midiEvent.data[1], midiEvent.data[2]);
      } else {
        stopNote(midiEvent.data[1]); // Note off if velocity is 0
      }
      break;

    case 0x80: // Note off
      stopNote(midiEvent.data[1]);
      break;
  }
};

/**
 * @function onMIDISuccess
 * @description Called when MIDI access is successfully obtained.
 * @param {MIDIAccess} midiAccess - The MIDI access object.
 */
const onMIDISuccess = function (midiAccess) {
  for (let input of midiAccess.inputs.values()) {
    input.onmidimessage = midiParser;
  }
};

// Request MIDI access and connect handler
navigator.requestMIDIAccess().then(onMIDISuccess);

// Resume AudioContext on button click (required by browser security)
document.querySelector("button").addEventListener("click", () => mySynthCtx.resume());
