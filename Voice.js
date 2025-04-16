/**
 * A class representing a single voice in a polyphonic synthesizer.
 *
 * Each voice creates:
 * - A sine wave oscillator at the base frequency
 * - A sawtooth oscillator at 2x frequency (with lower amplitude)
 * - A sine wave oscillator at 0.5x frequency
 * - An amplitude envelope using the ADSR model
 *
 * Additionally, all three oscillators pass through a ring modulator.
 */
export default class Voice {
  /**
   * @param {AudioContext} ctx - The audio context.
   * @param {number} freq - The base frequency of the voice in Hz.
   * @param {number} maxAmp - The maximum amplitude (between 0.0 and 1.0).
   * @param {AudioNode} out - The destination node to which this voice connects.
   */
  constructor(ctx, freq, maxAmp, out) {
    // Store parameters
    this.context = ctx;
    this.frequency = freq;
    this.maxAmp = maxAmp;
    this.output = out;

    // ADSR envelope times in seconds
    this.attack = 0.02;
    this.decay = 0.01;
    this.sustain = 0.5;
    this.release = 0.5;
  }

  /**
   * Starts the voice:
   * - Initializes oscillators
   * - Sets up signal routing
   * - Applies the ADSR envelope
   */
  start() {
    const now = this.context.currentTime;

    // Primary sine oscillator
    this.osc = this.context.createOscillator();
    this.osc.frequency.setValueAtTime(this.frequency, now);
    this.osc.onended = this.dispose.bind(this); // Cleanup when stopped

    // Sawtooth oscillator at 2x frequency (harmonic)
    this.osc2 = this.context.createOscillator();
    this.osc2.type = "sawtooth";
    this.osc2.frequency.setValueAtTime(this.frequency * 7 / 3,  now);
    this.osc2scale = this.context.createGain();
    this.osc2scale.gain.value = 0.25;

    // Sine oscillator at 0.5x frequency (subharmonic)
    this.osc3 = this.context.createOscillator();
    this.osc3.type = "triangle";
    this.osc3.frequency.setValueAtTime(this.frequency / 7 / 4, now);
    this.osc3scale = this.context.createGain();
    this.osc3scale.gain.value = 0.5;

    // Ring modulation setup:
    // A low-frequency modulator modifies the gain of the signal path
    this.ringModGain = this.context.createGain();
    this.ringModGain.gain.value = 0;

    this.ringModModulator = this.context.createOscillator();
    this.ringModModulator.frequency.value = this.frequency / 128; // Very low frequency

    // Envelope-controlled output gain
    this.ampEnv = this.context.createGain();
    this.ampEnv.gain.setValueAtTime(0, now); // Start silent

    this.lpFilter = this.context.createBiquadFilter()
    this.lpFilter.type = "lowpass"
    this.lpFilter.frequency.value = this.frequency + 2000;
    this.lpFilter.q = 2;

    // Connect modulator to the gain of the ringModGain node
    this.ringModModulator.connect(this.ringModGain.gain);

    // Connect oscillators to ring modulator
    this.osc.connect(this.ringModGain);
    this.osc2.connect(this.osc2scale);
    this.osc2scale.connect(this.ringModGain);
    this.osc3.connect(this.osc3scale);
    this.osc3scale.connect(this.ringModGain);

    // Route ring modulated signal to amplitude envelope and then to output
    this.ringModGain.connect(this.ampEnv);
    this.ampEnv.connect(this.lpFilter);
    this.lpFilter.connect(this.output)

    // Start all oscillators
    this.ringModModulator.start();
    this.osc.start();
    this.osc2.start();
    this.osc3.start();

    // Apply ADSR envelope: Attack → Decay → Sustain
    this.ampEnv.gain.linearRampToValueAtTime(this.maxAmp, now + this.attack); // Attack phase
    this.ampEnv.gain.linearRampToValueAtTime(
        this.sustain * this.maxAmp,
        now + this.attack + this.decay
    ); // Decay to sustain level
  }

  /**
   * Triggers the Release phase of the ADSR envelope and stops the oscillators.
   */
  stop() {
    const now = this.context.currentTime;

    // Stop scheduled ramps and avoid clicks/pops
    this.ampEnv.gain.cancelScheduledValues(now);
    this.ampEnv.gain.setValueAtTime(this.ampEnv.gain.value, now);

    // Release phase: ramp gain to 0
    this.ampEnv.gain.linearRampToValueAtTime(0, now + this.release);

    // Stop all oscillators slightly after release completes
    const stopTime = now + this.release + 0.01;
    this.osc.stop(stopTime);
    this.osc2.stop(stopTime);
    this.osc3.stop(stopTime);
    this.ringModModulator.stop(stopTime);
  }

  /**
   * Disconnects all audio nodes and nullifies references for cleanup.
   * Automatically called when the main oscillator ends.
   */
  dispose() {
    // Disconnect signal paths
    this.osc.disconnect();
    this.osc2.disconnect();
    this.osc3.disconnect();
    this.osc2scale.disconnect();
    this.osc3scale.disconnect();
    this.ringModGain.disconnect();
    this.ringModModulator.disconnect();
    this.ampEnv.disconnect();

    // Null out references for garbage collection
    this.osc = null;
    this.osc2 = null;
    this.osc3 = null;
    this.osc2scale = null;
    this.osc3scale = null;
    this.ringModGain = null;
    this.ringModModulator = null;
    this.ampEnv = null;
  }
}
