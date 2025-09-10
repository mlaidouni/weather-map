import { LatLngExpression } from "leaflet";

export interface Area {
  coordinates: LatLngExpression[];
  isRaining?: boolean;
}