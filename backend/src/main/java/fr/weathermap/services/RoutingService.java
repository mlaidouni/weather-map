package fr.weathermap.services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import fr.weathermap.utils.AreaUtils;

import java.util.*;

@Service
public class RoutingService {

    @Autowired
    private RainViewerRadarPolygonService rainViewerRadarPolygonService;

    private final String valhallaAPI = "http://37.187.49.205:8002/route";

    /**
     * Nouveau format:
     * {
     *   "duration": <seconds>,
     *   "distance": <meters>,
     *   "steps": [
     *      {
     *        "rain_polygons": [ [ [lon,lat], ... ], ... ],
     *        "route": [ [lon,lat], ... ]
     *      },
     *      ...
     *   ]
     * }
     */
    public Map<String, Object> calculateWeatherAwareRoute(
            double startLat, double startLng,
            double endLat, double endLng,
            List<String> avoidWeatherConditions
    ) {
        Map<String, Object> result = new HashMap<>();

        boolean dynamicRain = (avoidWeatherConditions != null && avoidWeatherConditions.contains("rain"));

        // Récupération des frames pluie (si demandé)
        List<RainViewerRadarPolygonService.RainPolygonsResult> frames = List.of();
        if (dynamicRain) {
            try {
                // Bounding box élargie (1 km) pour récupérer suffisamment de tuiles
                Map<String, Double> expanded = AreaUtils.expandedArea(startLat, startLng, endLat, endLng, 1.0);
                frames = rainViewerRadarPolygonService.fetchAllRainPolygons(
                        expanded.get("latMax"), expanded.get("lonMin"),
                        expanded.get("latMin"), expanded.get("lonMax")
                );
            } catch (Exception e) {
                // En cas d'échec on désactive le mode dynamique (fallback)
                dynamicRain = false;
            }
        }

        if (!dynamicRain || frames.isEmpty()) {
            // Fallback: une seule route complète (sans segmentation temporelle)
            Map<String, Object> singleStep = buildRouteSegment(startLat, startLng, endLat, endLng, null);
            if (singleStep == null) {
                result.put("error", "Routing failed");
                result.put("duration", 0);
                result.put("distance", 0);
                result.put("steps", List.of());
                return result;
            }
            double duration = ((Number) singleStep.get("segment_duration")).doubleValue();
            double distance = ((Number) singleStep.get("segment_distance")).doubleValue();
            // Adapter au format final
            Map<String, Object> stepOut = new HashMap<>();
            stepOut.put("rain_polygons", List.of());
            stepOut.put("route", singleStep.get("segment_route"));
            result.put("duration", duration);
            result.put("distance", distance);
            result.put("steps", List.of(stepOut));
            return result;
        }

        // Mode dynamique
        List<Map<String, Object>> steps = new ArrayList<>();
        double totalDuration = 0.0;
        double totalDistance = 0.0;

        double currentStartLat = startLat;
        double currentStartLng = startLng;

        double globalTimeCovered = 0.0; // cumul en secondes sur le trajet simulé

        for (int i = 0; i < frames.size(); i++) {
            RainViewerRadarPolygonService.RainPolygonsResult frame = frames.get(i);

            // Seuil temporel associé à cette frame (i+1)*10min
            double frameThreshold = (i + 1) * 600.0; // 600s = 10 min
            double remainingWindow = frameThreshold - globalTimeCovered;

            // Route actuelle depuis point courant vers destination avec polygones de cette frame
            Map<String, Object> segment = buildRouteSegment(currentStartLat, currentStartLng, endLat, endLng, frame.polygons);
            if (segment == null) {
                // Si échec routage: arrêter proprement
                break;
            }

            @SuppressWarnings("unchecked")
            List<List<Double>> fullShapeLatLon = (List<List<Double>>) segment.get("segment_shape_latlon");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> maneuvers = (List<Map<String, Object>>) segment.get("segment_maneuvers");

            double segmentTotalDuration = ((Number) segment.get("segment_duration")).doubleValue();
            double segmentTotalDistance = ((Number) segment.get("segment_distance")).doubleValue();

            boolean isLastFrame = (i == frames.size() - 1);

            int splitShapeIndex = -1;
            double usedDurationInSegment = 0.0;
            double usedDistanceInSegment = 0.0;

            if (!isLastFrame && segmentTotalDuration > remainingWindow) {
                // Chercher le dernier maneuver dont le cumul est STRICTEMENT < remainingWindow
                double acc = 0.0;
                double accDist = 0.0;
                for (Map<String, Object> m : maneuvers) {
                    double mt = toDouble(m.get("time"));     // secondes
                    double ml = toDouble(m.get("length")) * 1000.0; // km -> m
                    double nextAcc = acc + mt;
                    if (nextAcc < remainingWindow) {
                        // on peut inclure ce maneuver
                        Integer endIdx = (Integer) m.get("end_shape_index");
                        if (endIdx != null) {
                            splitShapeIndex = endIdx;
                        }
                        acc = nextAcc;
                        accDist += ml;
                    } else {
                        break;
                    }
                }

                // Aucun maneuver entièrement sous la limite => pas de split possible, on prend tout et on terminera (évite boucle infinie)
                if (splitShapeIndex == -1) {
                    isLastFrame = true;
                } else {
                    usedDurationInSegment = acc;
                    usedDistanceInSegment = accDist;
                }
            }

            List<List<Double>> stepRouteLonLat;

            if (splitShapeIndex == -1 || isLastFrame) {
                // On prend tout le reste comme dernier step
                stepRouteLonLat = toLonLat(fullShapeLatLon);
                usedDurationInSegment = segmentTotalDuration;
                usedDistanceInSegment = segmentTotalDistance;
                globalTimeCovered += usedDurationInSegment;
                totalDuration += usedDurationInSegment;
                totalDistance += usedDistanceInSegment;

                Map<String, Object> outStep = new HashMap<>();
                outStep.put("rain_polygons", AreaUtils.reverseLonLat(frame.polygons));
                outStep.put("route", AreaUtils.reverseLonLat2(stepRouteLonLat));
                steps.add(outStep);
                break;
            } else {
                // Sous-sélection jusqu’au split (inclus)
                if (splitShapeIndex >= fullShapeLatLon.size()) {
                    splitShapeIndex = fullShapeLatLon.size() - 1;
                }
                stepRouteLonLat = toLonLat(fullShapeLatLon.subList(0, splitShapeIndex + 1));

                globalTimeCovered += usedDurationInSegment;
                totalDuration += usedDurationInSegment;
                totalDistance += usedDistanceInSegment;

                Map<String, Object> outStep = new HashMap<>();
                outStep.put("rain_polygons", AreaUtils.reverseLonLat(frame.polygons));
                outStep.put("route", AreaUtils.reverseLonLat2(stepRouteLonLat));
                steps.add(outStep);

                // Nouveau point de départ = point de split
                List<Double> newStartLatLon = fullShapeLatLon.get(splitShapeIndex);
                currentStartLat = newStartLatLon.get(0);
                currentStartLng = newStartLatLon.get(1);
            }
        }

        // Remplissage résultat
        result.put("duration", totalDuration);
        result.put("distance", totalDistance);
        result.put("steps", steps);

        return result;
    }

    // Construit un segment de route entre deux points avec (ou sans) polygones d’exclusion
    // Retourne:
    //  segment_duration (sec), segment_distance (m),
    //  segment_shape_latlon (List<[lat,lon]>),
    //  segment_route (List<[lon,lat]>), segment_maneuvers (liste brute maneuvers)
    private Map<String, Object> buildRouteSegment(double sLat, double sLon,
                                                  double eLat, double eLon,
                                                  List<List<List<Double>>> excludePolygons) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("locations", Arrays.asList(
                Map.of("lat", sLat, "lon", sLon),
                Map.of("lat", eLat, "lon", eLon)
        ));
        body.put("costing", "auto");
        if (excludePolygons != null) {
            body.put("exclude_polygons", excludePolygons); // lon/lat attendu par Valhalla
        }

        RestTemplate rt = new RestTemplate();
        Map<String, Object> api = rt.postForObject(valhallaAPI, new HttpEntity<>(body, headers), Map.class);
        if (api == null) return null;

        Map<String, Object> trip = cast(api.get("trip"));
        if (trip == null) return null;

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> legs = (List<Map<String, Object>>) trip.get("legs");
        if (legs == null || legs.isEmpty()) return null;

        Map<String, Object> leg = legs.get(0);
        Map<String, Object> summary = cast(leg.get("summary"));
        double segDuration = toDouble(summary != null ? summary.get("time") : 0.0);
        double segDistanceMeters = toDouble(summary != null ? summary.get("length") : 0.0) * 1000.0; // km -> m

        String shape = (String) leg.get("shape");
        List<List<Double>> shapeLatLon = (shape != null) ? decodePolyline(shape, 6) : List.of();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> maneuvers = (List<Map<String, Object>>) leg.get("maneuvers");

        Map<String, Object> out = new HashMap<>();
        out.put("segment_duration", segDuration);
        out.put("segment_distance", segDistanceMeters);
        out.put("segment_shape_latlon", shapeLatLon);
        out.put("segment_route", toLonLat(shapeLatLon));
        out.put("segment_maneuvers", maneuvers != null ? maneuvers : List.of());
        return out;
    }

    private static double toDouble(Object o) {
        if (o instanceof Number) return ((Number) o).doubleValue();
        try { return Double.parseDouble(String.valueOf(o)); } catch (Exception e) { return 0.0; }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> cast(Object o) {
        return (o instanceof Map) ? (Map<String, Object>) o : null;
    }

    // Convertit [ [lat,lon], ... ] -> [ [lon,lat], ... ]
    private static List<List<Double>> toLonLat(List<List<Double>> latLon) {
        List<List<Double>> out = new ArrayList<>(latLon.size());
        for (List<Double> p : latLon) {
            if (p.size() >= 2) out.add(List.of(p.get(1), p.get(0)));
        }
        return out;
    }

    private List<List<Double>> decodePolyline(String encoded, int precision) {
        List<List<Double>> latLngList = new ArrayList<>();
        int index = 0, len = encoded.length();
        long lat = 0, lng = 0;
        int factor = (int) Math.pow(10, precision);

        while (index < len) {
            int b, shift = 0, result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            long dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            long dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            latLngList.add(List.of(lat / (double) factor, lng / (double) factor));
        }
        return latLngList;
    }
}