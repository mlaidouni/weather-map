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
     * Calculate a simple route between two points.
     * Returns only the decoded list of coordinates (lat, lon).
     */
    public List<List<Double>> calculateSimpleRoute(
            double startLat, double startLng,
            double endLat, double endLng
    ) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("locations", Arrays.asList(
                Map.of("lat", startLat, "lon", startLng),
                Map.of("lat", endLat, "lon", endLng)
        ));
        requestBody.put("costing", "auto");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> apiResponse;
        try {
            apiResponse = restTemplate.postForObject(valhallaAPI, entity, Map.class);
        } catch (Exception e) {
            System.err.println("Routing request failed: " + e.getMessage());
            return Collections.emptyList();
        }

        if (apiResponse == null) {
            return Collections.emptyList();
        }

        Map<String, Object> trip = (Map<String, Object>) apiResponse.get("trip");
        if (trip == null) {
            return Collections.emptyList();
        }

        List<Map<String, Object>> legs = (List<Map<String, Object>>) trip.get("legs");
        if (legs == null || legs.isEmpty()) {
            return Collections.emptyList();
        }

        List<List<Double>> allCoordinates = new ArrayList<>();

        try {
            for (Map<String, Object> leg : legs) {
                String shape = (String) leg.get("shape");
                if (shape != null) {
                    List<List<Double>> coords = decodePolyline(shape, 6);
                    if (!coords.isEmpty()) {
                        if (!allCoordinates.isEmpty()) {
                            List<Double> last = allCoordinates.get(allCoordinates.size() - 1);
                            List<Double> first = coords.get(0);
                            if (last.get(0).equals(first.get(0)) && last.get(1).equals(first.get(1))) {
                                coords.remove(0);
                            }
                        }
                        allCoordinates.addAll(coords);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to parse routing data: " + e.getMessage());
            return Collections.emptyList();
        }

        return allCoordinates;
    }

    /**
     * Calculate a route between two points avoiding areas with specified weather conditions
     * Returns simplified route data with only distance, duration and coordinates
     */
    public Map<String, Object> calculateWeatherAwareRoute(
            double startLat, double startLng,
            double endLat, double endLng,
            List<String> avoidWeatherConditions
    ) {
        Map<String, Object> response = new HashMap<>();

        System.out.println("Calculating weather-aware route from (" + startLat + ", " + startLng + ") to (" + endLat + ", " + endLng + ") avoiding: " + avoidWeatherConditions);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("locations", Arrays.asList(
                Map.of("lat", startLat, "lon", startLng),
                Map.of("lat", endLat, "lon", endLng)
        ));

        requestBody.put("costing", "auto");

        // Add avoid polygons if "rain" is in avoidWeatherConditions
        if(avoidWeatherConditions != null && avoidWeatherConditions.contains("rain")) {
            Map<String, Double> expandedArea = AreaUtils.expandedArea(startLat, startLng, endLat, endLng, 1.0);
            List<List<List<Double>>> polygonsLonLat;
            try {
                polygonsLonLat = rainViewerRadarPolygonService.fetchRainPolygons(expandedArea.get("latMax"), expandedArea.get("lonMin"), expandedArea.get("latMin"), expandedArea.get("lonMax"));
            } catch (Exception e) {
                response.put("error", "Failed to fetch rain polygons: " + e.getMessage());
                return response;
            }
            requestBody.put("exclude_polygons", polygonsLonLat);
        }

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        System.out.println("Requesting route from own API with body: " + requestBody);

        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> apiResponse = restTemplate.postForObject(valhallaAPI, entity, Map.class);

        List<Map<String, Object>> simplifiedRoutes = new ArrayList<>();

        try {
            if (apiResponse == null) {
                response.put("routes", simplifiedRoutes);
                response.put("error", "Empty response from routing API");
                return response;
            }

            Map<String, Object> trip = (Map<String, Object>) apiResponse.get("trip");
            if (trip == null) {
                response.put("routes", simplifiedRoutes);
                response.put("error", "Missing trip object in response");
                return response;
            }

            List<Map<String, Object>> legs = (List<Map<String, Object>>) trip.get("legs");
            if (legs == null || legs.isEmpty()) {
                response.put("routes", simplifiedRoutes);
                response.put("error", "No legs in trip");
                return response;
            }

            double totalDistanceMeters = 0.0;
            double totalDurationSeconds = 0.0;
            List<List<Double>> allCoordinates = new ArrayList<>();

            for (Map<String, Object> leg : legs) {
                Map<String, Object> legSummary = (Map<String, Object>) leg.get("summary");
                if (legSummary != null) {
                    // length is in kilometers in sample; convert to meters
                    Object lengthObj = legSummary.get("length");
                    if (lengthObj instanceof Number) {
                        totalDistanceMeters += ((Number) lengthObj).doubleValue() * 1000.0;
                    }
                    Object timeObj = legSummary.get("time");
                    if (timeObj instanceof Number) {
                        totalDurationSeconds += ((Number) timeObj).doubleValue();
                    }
                }

                String shape = (String) leg.get("shape");
                if (shape != null) {
                    List<List<Double>> coords = decodePolyline(shape, 6);
                    if (!coords.isEmpty()) {
                        if (!allCoordinates.isEmpty()) {
                            List<Double> last = allCoordinates.get(allCoordinates.size() - 1);
                            List<Double> first = coords.get(0);
                            if (last.get(0).equals(first.get(0)) && last.get(1).equals(first.get(1))) {
                                coords.remove(0);
                            }
                        }
                        allCoordinates.addAll(coords);
                    }
                }
            }

            Map<String, Object> simplifiedRoute = new HashMap<>();
            simplifiedRoute.put("distance", totalDistanceMeters);
            simplifiedRoute.put("duration", totalDurationSeconds);
            simplifiedRoute.put("coordinates", allCoordinates);

            simplifiedRoutes.add(simplifiedRoute);

            response.put("routes", simplifiedRoutes);

        } catch (Exception e) {
            response.put("routes", simplifiedRoutes);
            response.put("error", "Failed to parse own API routing data: " + e.getMessage());
        }

        return response;
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

            List<Double> pair = new ArrayList<>(2);
            pair.add(lat / (double) factor);
            pair.add(lng / (double) factor);
            latLngList.add(pair);
        }
        return latLngList;
    }

    public static void main(String[] args) {
        RoutingService service = new RoutingService();
        Map<String, Object> route = service.calculateWeatherAwareRoute(
            48.8566, 2.3522, 48.77602916990935, 2.463881751424904, null);

        System.out.println(route);
    }
}