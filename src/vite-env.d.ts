/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TIANDITU_API_KEY: string;
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
