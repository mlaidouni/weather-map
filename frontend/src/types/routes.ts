import { LatLngExpression } from "leaflet";

export interface RouteData {
  id: string;
  coordinates: LatLngExpression[];
  distance: number;
  duration: number;
}
