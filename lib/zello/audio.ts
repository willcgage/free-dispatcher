/**
 * Zello audio frame helpers (spec §7.6).
 *
 * Each binary audio packet is prefixed with a 9-byte header:
 *   [type uint8 = 0x01][stream_id uint32 BE][packet_index uint32 BE]
 * followed by the Opus payload.
 */

/** Build the 9-byte Zello binary audio header. */
export function build9ByteHeader(streamId: number, packetIndex: number): Uint8Array {
  const header = new Uint8Array(9);
  const view = new DataView(header.buffer);
  view.setUint8(0, 0x01); // packet type: audio
  view.setUint32(1, streamId >>> 0, false); // big-endian
  view.setUint32(5, packetIndex >>> 0, false); // big-endian
  return header;
}

/**
 * Build the base64 Opus codec header Zello's start_stream expects:
 *   [sampleRate uint16 LE][framesPerPacket uint8][frameDurationMs uint8]
 * (e.g. 16000 Hz, 1 frame/packet, 20 ms). The exact bytes are finalized during
 * on-device testing against the live Zello stream.
 */
export function buildOpusCodecHeader(
  sampleRate: number,
  framesPerPacket = 1,
  frameDurationMs = 20,
): string {
  const buf = new Uint8Array(4);
  buf[0] = sampleRate & 0xff;
  buf[1] = (sampleRate >> 8) & 0xff;
  buf[2] = framesPerPacket;
  buf[3] = frameDurationMs;
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return typeof btoa !== "undefined"
    ? btoa(bin)
    : Buffer.from(buf).toString("base64");
}

/** Parse a received binary packet's header; returns the Opus payload slice. */
export function stripHeader(data: ArrayBuffer): {
  streamId: number;
  packetIndex: number;
  payload: Uint8Array;
} {
  const view = new DataView(data);
  return {
    streamId: view.getUint32(1, false),
    packetIndex: view.getUint32(5, false),
    payload: new Uint8Array(data, 9),
  };
}
