import { LatLngExpression } from "leaflet";
import { Area } from "./area";

// Types pour représenter les prévisions des zones de pluie en fonction d'un step de l'itinéraire
export type AreaPrevisionRoute = {
	rainingArea: Area[];
    route: LatLngExpression[];
};