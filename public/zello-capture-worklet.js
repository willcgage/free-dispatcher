/**
 * Zello capture worklet (spec §7.6). Buffers mono float audio at 16 kHz into
 * 320-sample (20 ms) frames and posts each frame to the main thread as Int16
 * PCM, ready for the Opus encoder.
 */
class ZelloCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 320; // 20 ms @ 16 kHz
    this.buffer = new Float32Array(this.frameSize);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i];
      if (this.offset === this.frameSize) {
        const pcm = new Int16Array(this.frameSize);
        for (let j = 0; j < this.frameSize; j++) {
          const s = Math.max(-1, Math.min(1, this.buffer[j]));
          pcm[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(pcm, [pcm.buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("zello-capture", ZelloCaptureProcessor);
