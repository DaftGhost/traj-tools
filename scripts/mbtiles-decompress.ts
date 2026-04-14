import { gunzipSync } from 'node:zlib';
import { isGzipCompressed } from '../src/mbtiles/shared';

export function maybeDecompress(data: Uint8Array): Buffer {
  if (isGzipCompressed(data)) {
    return Buffer.from(gunzipSync(data));
  }
  return Buffer.from(data);
}
