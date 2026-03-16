declare module "react-simple-maps" {
  import { ComponentType, ReactNode } from "react";

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    children?: ReactNode;
    [key: string]: unknown;
  }

  export interface GeographiesProps {
    geography: string | Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: (data: { geographies: any[] }) => ReactNode;
    [key: string]: unknown;
  }

  export interface GeographyProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geography: any;
    [key: string]: unknown;
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
    [key: string]: unknown;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const Marker: ComponentType<MarkerProps>;
}
