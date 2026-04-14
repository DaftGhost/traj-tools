import * as L from 'leaflet';

const g = globalThis as typeof globalThis & { L: typeof L };
g.L = L;

let pluginLoadPromise: Promise<void> | null = null;
let pluginLoadSucceeded = false;
const pluginUrl = new URL(
  '../../node_modules/leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.min.js',
  import.meta.url
).href;

async function loadPlugin(): Promise<void> {
  if (pluginLoadSucceeded) return;
  if (pluginLoadPromise) {
    await pluginLoadPromise;
    return;
  }
  pluginLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = pluginUrl;
    script.onload = () => {
      pluginLoadSucceeded = true;
      resolve();
    };
    script.onerror = () => {
      pluginLoadPromise = null;
      reject(new Error('Failed to load leaflet.vectorgrid plugin'));
    };
    document.head.appendChild(script);
  });
  await pluginLoadPromise;
}

export async function VectorGridProtobuf(
  url: string,
  options?: Record<string, unknown>
): Promise<L.Layer> {
  await loadPlugin();
  const LWithVG = L as unknown as typeof L & {
    VectorGrid: {
      Protobuf: new (url: string, options?: Record<string, unknown>) => L.Layer;
    };
  };
  return new LWithVG.VectorGrid.Protobuf(url, options);
}
