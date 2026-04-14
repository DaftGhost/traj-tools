declare module 'leaflet.vectorgrid' {
  export type VectorGridStyleOptions = {
    fill?: boolean;
    fillColor?: string;
    fillOpacity?: number;
    color?: string;
    opacity?: number;
    weight?: number;
    stroke?: boolean;
    dashArray?: string | [number, number];
    dashOffset?: string | [number, number];
    lineCap?: string;
    lineJoin?: string;
    pointerEvents?: string;
    shadowBlur?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    interactive?: boolean;
  };

  export const VectorGrid: unknown;
  export const VectorGridProtobuf: unknown;
  export const VectorGridSlicer: unknown;
}
