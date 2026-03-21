/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_SIMPLIFY_RETAIN_RATIO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.csv' {
  const content: string;
  export default content;
}

declare module '*.geojson' {
  const content: GeoJSON.FeatureCollection;
  export default content;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
