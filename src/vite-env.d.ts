/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
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
