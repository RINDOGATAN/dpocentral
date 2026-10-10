// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A streaming ZIP writer (PKWARE APPNOTE 6.3): each entry is compressed with
 * DEFLATE as its bytes arrive and written out at once, with its CRC-32 and
 * sizes in a data descriptor after the data (general purpose bit 3), so no
 * entry and no archive is ever held in memory whole. Used by the programme
 * export (src/server/services/portability/export.ts), which can run to tens
 * of thousands of records.
 *
 * UTF-8 file names (bit 11). Limits: no ZIP64, so each entry and the whole
 * archive stay under 4 GiB and under 65,535 entries; the writer throws rather
 * than write a damaged archive past them. Node only (node:zlib).
 */

import { createDeflateRaw } from "node:zlib";
import { Readable } from "node:stream";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** Continue a CRC-32 over more bytes (start with 0xffffffff, finish with ^ 0xffffffff). */
function crcUpdate(crc: number, bytes: Uint8Array): number {
  let c = crc;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return c >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const LIMIT = 0xffffffff;
const FLAGS = 0x0800 | 0x0008; // UTF-8 names, sizes in a data descriptor
const DEFLATE = 8;

export type ZipChunk = Uint8Array | string;
export type ZipSource = ZipChunk | Iterable<ZipChunk> | AsyncIterable<ZipChunk>;

async function* chunksOf(source: ZipSource): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  if (typeof source === "string") {
    yield encoder.encode(source);
    return;
  }
  if (source instanceof Uint8Array) {
    yield source;
    return;
  }
  for await (const c of source as AsyncIterable<ZipChunk>) {
    const bytes = typeof c === "string" ? encoder.encode(c) : c;
    if (bytes.length > 0) yield bytes;
  }
}

export class ZipStreamWriter {
  private offset = 0;
  private central: Uint8Array[] = [];
  private entries = 0;
  private readonly modified: Date;

  constructor(modified: Date = new Date()) {
    this.modified = modified;
  }

  private track(bytes: Uint8Array): Uint8Array {
    this.offset += bytes.length;
    if (this.offset > LIMIT) throw new Error("The archive would exceed 4 GiB (no ZIP64 support).");
    return bytes;
  }

  /**
   * Write one entry. `onData` sees every uncompressed byte (for a digest).
   * Yields the archive's bytes for this entry.
   */
  async *entry(
    name: string,
    source: ZipSource,
    onData?: (bytes: Uint8Array) => void,
  ): AsyncGenerator<Uint8Array> {
    if (this.entries >= 0xffff) throw new Error("Too many entries for a ZIP without ZIP64.");
    const nameBytes = new TextEncoder().encode(name);
    const { time, date } = dosDateTime(this.modified);
    const start = this.offset;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, FLAGS, true);
    lv.setUint16(8, DEFLATE, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    // CRC and sizes are 0 here: they follow the data, in the descriptor.
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    yield this.track(local);

    let crc = 0xffffffff;
    let size = 0;
    let compressed = 0;
    const counted = async function* () {
      for await (const bytes of chunksOf(source)) {
        crc = crcUpdate(crc, bytes);
        size += bytes.length;
        if (size > LIMIT) throw new Error(`The file ${name} would exceed 4 GiB (no ZIP64 support).`);
        onData?.(bytes);
        yield bytes;
      }
    };
    const input = Readable.from(counted());
    const deflater = createDeflateRaw({ level: 6 });
    input.on("error", (err) => deflater.destroy(err));
    input.pipe(deflater);
    for await (const out of deflater as AsyncIterable<Buffer>) {
      compressed += out.length;
      yield this.track(new Uint8Array(out.buffer, out.byteOffset, out.length));
    }
    crc = (crc ^ 0xffffffff) >>> 0;

    const descriptor = new Uint8Array(16);
    const dv = new DataView(descriptor.buffer);
    dv.setUint32(0, 0x08074b50, true);
    dv.setUint32(4, crc, true);
    dv.setUint32(8, compressed, true);
    dv.setUint32(12, size, true);
    yield this.track(descriptor);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, FLAGS, true);
    cv.setUint16(10, DEFLATE, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, start, true);
    central.set(nameBytes, 46);
    this.central.push(central);
    this.entries++;
  }

  /** The central directory and its end record: the archive's last bytes. */
  *finish(): Generator<Uint8Array> {
    const dirStart = this.offset;
    let dirSize = 0;
    for (const c of this.central) {
      dirSize += c.length;
      yield this.track(c);
    }
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, this.entries, true);
    ev.setUint16(10, this.entries, true);
    ev.setUint32(12, dirSize, true);
    ev.setUint32(16, dirStart, true);
    yield this.track(end);
  }
}

/** An async generator of bytes as a web ReadableStream (a Response body). */
export function toReadableStream(gen: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await gen.return(undefined);
    },
  });
}
