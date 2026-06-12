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
