// Global type declarations for Leaflet and external libraries

// Tianditu API Key (from config.js)
declare const TIANDITU_KEY: string;

// Extended types for the application
interface Window {
  console: Console & {
    warn: (...args: unknown[]) => void;
  };
  Papa: {
    parse: (file: unknown, config: unknown) => void;
  };
}
