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

    public Map<String, Object> calculateWeatherAwareRouteStatic(
            double startLat, double startLng,
            double endLat, double endLng,
            List<String> avoidWeatherConditions) {

        Map<String, Object> result = new HashMap<>();
        boolean useRain = (avoidWeatherConditions != null && avoidWeatherConditions.contains("rain"));

        List<RainViewerRadarPolygonService.RainPolygonsResult> frames = List.of();
        List<List<List<Double>>> polygons = List.of();

        if (useRain) {
            try {
                // Petite zone élargie (1 km)
                Map<String, Double> expanded = AreaUtils.expandedArea(startLat, startLng, endLat, endLng);
                frames = rainViewerRadarPolygonService.fetchAllRainPolygons(
                        expanded.get("latMax"), expanded.get("lonMin"),
                        expanded.get("latMin"), expanded.get("lonMax"));
                if (!frames.isEmpty()) {
                    // On prend uniquement la première frame (simulation "état actuel")
                    polygons = frames.get(0).getSimplifiedPolygons();
                } else {
                    useRain = false;
                }
            } catch (Exception e) {
                useRain = false;
            }
        }

        Map<String, Object> segment = buildRouteSegment(startLat, startLng, endLat, endLng, useRain ? polygons : null);
        if (segment == null) {
            result.put("error", "Routing failed");
            result.put("duration", 0);
            result.put("distance", 0);
            result.put("steps", List.of());
            return result;
        }

        double duration = toDouble(segment.get("segment_duration"));
        double distance = toDouble(segment.get("segment_distance"));

        Map<String, Object> step = new HashMap<>();
        // Conserver la cohérence avec la version dynamique (conversion éventuelle
        // lon/lat selon utilitaires)
        step.put("rain_polygons", useRain ? AreaUtils.reverseLonLat(polygons) : List.of());
        step.put("route", AreaUtils.reverseLonLat2((List<List<Double>>) segment.get("segment_route")));

        result.put("duration", duration);
        result.put("distance", distance);
        result.put("steps", List.of(step));
        return result;
    }

    /**
     * Nouveau format:
     * {
     * "duration": <seconds>,
     * "distance": <meters>,
     * "steps": [
     * {
     * "rain_polygons": [ [ [lon,lat], ... ], ... ],
     * "route": [ [lon,lat], ... ]
     * },
     * ...
     * ]
     * }
     */
    public Map<String, Object> calculateWeatherAwareRouteDynamic(
            double startLat, double startLng,
            double endLat, double endLng,
            List<String> avoidWeatherConditions) {
        Map<String, Object> result = new HashMap<>();

        boolean dynamicRain = (avoidWeatherConditions != null && avoidWeatherConditions.contains("rain"));

        List<RainViewerRadarPolygonService.RainPolygonsResult> frames = List.of();
        if (dynamicRain) {
            try {
                Map<String, Double> expanded = AreaUtils.expandedArea(startLat, startLng, endLat, endLng);
                frames = rainViewerRadarPolygonService.fetchAllRainPolygons(
                        expanded.get("latMax"), expanded.get("lonMin"),
                        expanded.get("latMin"), expanded.get("lonMax"));
            } catch (Exception e) {
                dynamicRain = false;
            }
        }

        if (!dynamicRain || frames.isEmpty()) {
            Map<String, Object> singleStep = buildRouteSegment(startLat, startLng, endLat, endLng, null);
            if (singleStep == null) {
                // Pas de frames => steps vide mais format conservé
                result.put("error", "Routing failed");
                result.put("duration", 0);
                result.put("distance", 0);
                result.put("steps", List.of());
                return result;
            }
            double duration = toDouble(singleStep.get("segment_duration"));
            double distance = toDouble(singleStep.get("segment_distance"));
            Map<String, Object> stepOut = new HashMap<>();
            stepOut.put("rain_polygons", List.of());
            stepOut.put("route", singleStep.get("segment_route"));
            result.put("duration", duration);
            result.put("distance", distance);
            result.put("steps", List.of(stepOut));
            return result;
        }

        List<Map<String, Object>> steps = new ArrayList<>();
        double totalDuration = 0.0;
        double totalDistance = 0.0;
        double currentStartLat = startLat;
        double currentStartLng = startLng;
        double globalTimeCovered = 0.0;

        for (int i = 0; i < frames.size(); i++) {
            RainViewerRadarPolygonService.RainPolygonsResult frame = frames.get(i);
            List<List<List<Double>>> simplifiedPolygons = frame.getSimplifiedPolygons();

            double frameThreshold = (i + 1) * 600.0;
            double remainingWindow = frameThreshold - globalTimeCovered;

            Map<String, Object> segment = buildRouteSegment(
                    currentStartLat, currentStartLng,
                    endLat, endLng,
                    simplifiedPolygons);

            if (segment == null) {
                // Échec: renvoyer toutes les frames sous forme de steps avec route vide
                List<Map<String, Object>> errorSteps = new ArrayList<>();
                for (RainViewerRadarPolygonService.RainPolygonsResult f : frames) {
                    Map<String, Object> st = new HashMap<>();
                    st.put("rain_polygons", AreaUtils.reverseLonLat(f.getSimplifiedPolygons()));
                    st.put("route", List.of());
                    errorSteps.add(st);
                }
                result.put("error", "Routing failed");
                result.put("duration", 0);
                result.put("distance", 0);
                result.put("steps", errorSteps);
                return result;
            }

            @SuppressWarnings("unchecked")
            List<List<Double>> fullShapeLatLon = (List<List<Double>>) segment.get("segment_shape_latlon");
            double segmentTotalDuration = toDouble(segment.get("segment_duration"));
            double segmentTotalDistance = toDouble(segment.get("segment_distance"));
            boolean isLastFrame = (i == frames.size() - 1);

            if (isLastFrame || segmentTotalDuration <= remainingWindow) {
                List<List<Double>> stepRouteLonLat = toLonLat(fullShapeLatLon);
                globalTimeCovered += segmentTotalDuration;
                totalDuration += segmentTotalDuration;
                totalDistance += segmentTotalDistance;

                Map<String, Object> outStep = new HashMap<>();
                outStep.put("rain_polygons", AreaUtils.reverseLonLat(simplifiedPolygons));
                outStep.put("route", AreaUtils.reverseLonLat2(stepRouteLonLat));
                steps.add(outStep);

                if (!isLastFrame && !fullShapeLatLon.isEmpty()) {
                    List<Double> last = fullShapeLatLon.get(fullShapeLatLon.size() - 1);
                    currentStartLat = last.get(0);
                    currentStartLng = last.get(1);
                }
                break;
            }

            double targetTime = remainingWindow - 0.1;
            if (targetTime < 0) targetTime = remainingWindow * 0.5;

            SplitResult split = splitShapeByTime(fullShapeLatLon, segmentTotalDuration, segmentTotalDistance, targetTime);
            if (split == null || split.shapeIndex <= 0) {
                List<List<Double>> stepRouteLonLat = toLonLat(fullShapeLatLon);
                globalTimeCovered += segmentTotalDuration;
                totalDuration += segmentTotalDuration;
                totalDistance += segmentTotalDistance;

                Map<String, Object> outStep = new HashMap<>();
                outStep.put("rain_polygons", AreaUtils.reverseLonLat(simplifiedPolygons));
                outStep.put("route", AreaUtils.reverseLonLat2(stepRouteLonLat));
                steps.add(outStep);
                break;
            }

            List<List<Double>> partialShape = new ArrayList<>(fullShapeLatLon.subList(0, split.shapeIndex + 1));
            if (split.interpolatedPoint != null) partialShape.add(split.interpolatedPoint);

            List<List<Double>> stepRouteLonLat = toLonLat(partialShape);

            globalTimeCovered += split.timeUsed;
            totalDuration += split.timeUsed;
            totalDistance += split.distanceUsed;

            Map<String, Object> outStep = new HashMap<>();
            outStep.put("rain_polygons", AreaUtils.reverseLonLat(simplifiedPolygons));
            outStep.put("route", AreaUtils.reverseLonLat2(stepRouteLonLat));
            steps.add(outStep);

            List<Double> newStart = (split.interpolatedPoint != null)
                    ? split.interpolatedPoint
                    : fullShapeLatLon.get(split.shapeIndex);
            currentStartLat = newStart.get(0);
            currentStartLng = newStart.get(1);
        }

        result.put("duration", totalDuration);
        result.put("distance", totalDistance);
        result.put("steps", steps);
        return result;
    }

    private static class SplitResult {
        int shapeIndex; // index du point précédent la coupure
        List<Double> interpolatedPoint; // point ajouté (lat,lon) si coupure au milieu d'un segment
        double timeUsed; // secondes utilisées jusqu'à la coupure
        double distanceUsed; // mètres utilisés jusqu'à la coupure
    }

    private SplitResult splitShapeByTime(List<List<Double>> shapeLatLon,
            double totalDurationSec,
            double totalDistanceMeters,
            double targetTimeSec) {
        if (shapeLatLon == null || shapeLatLon.size() < 2)
            return null;
        if (targetTimeSec <= 0 || targetTimeSec >= totalDurationSec)
            return null;

        // Distances cumulées
        double[] segDist = new double[shapeLatLon.size() - 1];
        double cum = 0.0;
        for (int i = 0; i < segDist.length; i++) {
            List<Double> a = shapeLatLon.get(i);
            List<Double> b = shapeLatLon.get(i + 1);
            segDist[i] = haversineMeters(a.get(0), a.get(1), b.get(0), b.get(1));
            cum += segDist[i];
        }
        if (cum <= 0)
            return null;

        // Approche proportionnelle temps <-> distance
        double targetDistance = (targetTimeSec / totalDurationSec) * totalDistanceMeters;
        if (targetDistance <= 0)
            return null;
        if (targetDistance >= totalDistanceMeters)
            return null;

        double accDist = 0.0;
        for (int i = 0; i < segDist.length; i++) {
            double nextAcc = accDist + segDist[i];
            if (nextAcc > targetDistance) {
                // Coupure dans ce segment
                double remain = targetDistance - accDist;
                double ratio = (segDist[i] == 0) ? 0 : (remain / segDist[i]);
                List<Double> A = shapeLatLon.get(i);
                List<Double> B = shapeLatLon.get(i + 1);
                // Interpolation linéaire (approx suffisante)
                double lat = A.get(0) + (B.get(0) - A.get(0)) * ratio;
                double lon = A.get(1) + (B.get(1) - A.get(1)) * ratio;

                double timeUsed = targetTimeSec;
                SplitResult sr = new SplitResult();
                sr.shapeIndex = i; // i = point précédent
                sr.interpolatedPoint = List.of(lat, lon);
                sr.distanceUsed = targetDistance;
                sr.timeUsed = timeUsed;
                return sr;
            }
            accDist = nextAcc;
        }
        return null;
    }

    private static double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Construit un segment de route entre deux points avec (ou sans) polygones
    // d’exclusion
    // Retourne:
    // segment_duration (sec), segment_distance (m),
    // segment_shape_latlon (List<[lat,lon]>),
    // segment_route (List<[lon,lat]>), segment_maneuvers (liste brute maneuvers)
    private Map<String, Object> buildRouteSegment(double sLat, double sLon,
            double eLat, double eLon,
            List<List<List<Double>>> excludePolygons) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("locations", Arrays.asList(
                Map.of("lat", sLat, "lon", sLon),
                Map.of("lat", eLat, "lon", eLon)));
        body.put("costing", "auto");
        if (excludePolygons != null) {
            body.put("exclude_polygons", excludePolygons); // lon/lat attendu par Valhalla
        }

        RestTemplate rt = new RestTemplate();
        Map<String, Object> api = null;
        try {
            api = rt.postForObject(valhallaAPI, new HttpEntity<>(body, headers), Map.class);
        } catch (Exception e) {
            System.err.println("Routing API error: " + e.getMessage());
        }
        if (api == null)
            return null;

        Map<String, Object> trip = cast(api.get("trip"));
        if (trip == null)
            return null;

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> legs = (List<Map<String, Object>>) trip.get("legs");
        if (legs == null || legs.isEmpty())
            return null;

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
        if (o instanceof Number)
            return ((Number) o).doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o));
        } catch (Exception e) {
            return 0.0;
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> cast(Object o) {
        return (o instanceof Map) ? (Map<String, Object>) o : null;
    }

    // Convertit [ [lat,lon], ... ] -> [ [lon,lat], ... ]
    private static List<List<Double>> toLonLat(List<List<Double>> latLon) {
        List<List<Double>> out = new ArrayList<>(latLon.size());
        for (List<Double> p : latLon) {
            if (p.size() >= 2)
                out.add(List.of(p.get(1), p.get(0)));
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