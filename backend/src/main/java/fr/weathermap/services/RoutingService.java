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

    /**
     * Calculate a route between two points avoiding areas with specified weather conditions
     * Returns route data split into time-based segments with corresponding rain polygons
     */
    public Map<String, Object> calculateWeatherAwareRouteBis(
            double startLat, double startLng,
            double endLat, double endLng,
            List<String> avoidWeatherConditions
    ) {
        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> steps = new ArrayList<>();
        
        System.out.println("Calculating weather-aware route from (" + startLat + ", " + startLng + ") to (" + endLat + ", " + endLng + ") avoiding: " + avoidWeatherConditions);
    
        // Step 1: Get all rain polygons across time (past and forecast)
        Map<String, Double> expandedArea = AreaUtils.expandedArea(startLat, startLng, endLat, endLng, 1.0);
        List<RainViewerRadarPolygonService.RainPolygonsResult> timeSequencedPolygons;
        try {
            timeSequencedPolygons = rainViewerRadarPolygonService.fetchAllRainPolygons(
                expandedArea.get("latMax"), 
                expandedArea.get("lonMin"), 
                expandedArea.get("latMin"), 
                expandedArea.get("lonMax")
            );
        } catch (Exception e) {
            response.put("error", "Failed to fetch time-sequenced rain polygons: " + e.getMessage());
            return response;
        }
        
        if (timeSequencedPolygons.isEmpty()) {
            response.put("error", "No rain data available");
            return response;
        }
        
        // Sort polygons by timestamp (should already be sorted, but to be sure)
        timeSequencedPolygons.sort(Comparator.comparingLong(r -> r.frameTime));
        
        // Use the oldest rain data timestamp as our simulated "current time"
        // rather than using the actual system time
        long simulatedCurrentTime = timeSequencedPolygons.get(0).frameTime;
        
        System.out.println("Using simulated current time: " + new java.util.Date(simulatedCurrentTime * 1000L));
        
        // We'll track our position and elapsed time as we build the route
        double currentLat = startLat;
        double currentLng = startLng;
        double cumulativeTimeSeconds = 0;
        
        // Define our segment duration (10 minutes)
        final double SEGMENT_DURATION_SECONDS = 10 * 60;
        
        // Track remaining destination
        double remainingLat = endLat;
        double remainingLng = endLng;
        
        // Loop until we reach our destination
        boolean reachedDestination = false;
        int segmentCount = 0;
        int maxSegments = 100; // Safety limit to prevent infinite loops
        
        while (!reachedDestination && segmentCount < maxSegments) {
            segmentCount++;
            
            // Calculate the timestamp for this segment using our simulated current time
            long segmentTimestamp = simulatedCurrentTime + (long)cumulativeTimeSeconds;
            
            // Find the appropriate rain polygon data for this time
            RainViewerRadarPolygonService.RainPolygonsResult rainForSegment = 
                findRainPolygonsForTimestamp(timeSequencedPolygons, segmentTimestamp);
            
            // If we couldn't find rain data, use the last available one
            if (rainForSegment == null && !timeSequencedPolygons.isEmpty()) {
                rainForSegment = timeSequencedPolygons.get(timeSequencedPolygons.size() - 1);
            }
            
            // Create a request to calculate the route for this segment
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("locations", Arrays.asList(
                    Map.of("lat", currentLat, "lon", currentLng),
                    Map.of("lat", remainingLat, "lon", remainingLng)
            ));
            requestBody.put("costing", "auto");
            
            // Add avoid polygons if needed
            if (avoidWeatherConditions != null && 
                avoidWeatherConditions.contains("rain") && 
                rainForSegment != null && 
                !rainForSegment.polygons.isEmpty()) {
                
                requestBody.put("exclude_polygons", AreaUtils.reverseLonLat(rainForSegment.polygons));
            }
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            RestTemplate restTemplate = new RestTemplate();
            
            Map<String, Object> apiResponse;
            try {
                apiResponse = restTemplate.postForObject(valhallaAPI, entity, Map.class);
            } catch (Exception e) {
                response.put("error", "Failed to fetch route for segment " + segmentCount + ": " + e.getMessage());
                return response;
            }
            
            if (apiResponse == null) {
                response.put("error", "Empty response from routing API for segment " + segmentCount);
                return response;
            }
            
            Map<String, Object> trip = (Map<String, Object>) apiResponse.get("trip");
            if (trip == null) {
                response.put("error", "Missing trip object in response for segment " + segmentCount);
                return response;
            }
            
            List<Map<String, Object>> legs = (List<Map<String, Object>>) trip.get("legs");
            if (legs == null || legs.isEmpty()) {
                response.put("error", "No legs in trip for segment " + segmentCount);
                return response;
            }
            
            // Process the route to extract coordinates and time
            List<List<Double>> allCoordinates = new ArrayList<>();
            double segmentTime = 0;
            double segmentDistance = 0;
            
            // Extract maneuvers to get detailed timing
            List<Map<String, Object>> allManeuvers = new ArrayList<>();
            for (Map<String, Object> leg : legs) {
                List<Map<String, Object>> maneuvers = (List<Map<String, Object>>) leg.get("maneuvers");
                if (maneuvers != null) {
                    allManeuvers.addAll(maneuvers);
                }
                
                Map<String, Object> summary = (Map<String, Object>) leg.get("summary");
                if (summary != null) {
                    Number time = (Number) summary.get("time");
                    if (time != null) {
                        segmentTime += time.doubleValue();
                    }
                    Number length = (Number) summary.get("length");
                    if (length != null) {
                        segmentDistance += length.doubleValue() * 1000; // km to m
                    }
                }
            }
            
            // Decode the route geometry for the whole trip
            for (Map<String, Object> leg : legs) {
                String shape = (String) leg.get("shape");
                if (shape != null) {
                    List<List<Double>> decodedCoordinates = decodePolyline(shape, 6);
                    allCoordinates.addAll(decodedCoordinates);
                }
            }
            
            if (allCoordinates.isEmpty()) {
                response.put("error", "No coordinates found for segment " + segmentCount);
                return response;
            }
            
            // Find where to split this segment if it's longer than our target segment duration
            List<List<Double>> segmentCoordinates;
            List<List<Double>> remainingCoordinates = new ArrayList<>();
            
            if (segmentTime > SEGMENT_DURATION_SECONDS) {
                // We need to split this route
                double targetTime = SEGMENT_DURATION_SECONDS;
                double accumulatedTime = 0;
                int splitIndex = -1;
                
                // Try to find a good split point using maneuvers
                if (!allManeuvers.isEmpty()) {
                    for (int i = 0; i < allManeuvers.size(); i++) {
                        Map<String, Object> maneuver = allManeuvers.get(i);
                        Number time = (Number) maneuver.get("time");
                        
                        if (time != null) {
                            if (accumulatedTime + time.doubleValue() >= targetTime) {
                                // This maneuver crosses our target time
                                Number endShapeIndex = (Number) maneuver.get("end_shape_index");
                                if (endShapeIndex != null) {
                                    splitIndex = endShapeIndex.intValue();
                                    break;
                                }
                            }
                            accumulatedTime += time.doubleValue();
                        }
                    }
                }
                
                // If we couldn't find a good split using maneuvers, estimate by proportional distance
                if (splitIndex == -1) {
                    splitIndex = (int) Math.ceil(allCoordinates.size() * (SEGMENT_DURATION_SECONDS / segmentTime));
                    
                    // Ensure valid bounds
                    if (splitIndex <= 0) splitIndex = 1;
                    if (splitIndex >= allCoordinates.size()) splitIndex = allCoordinates.size() - 1;
                }
                
                // Split the coordinates
                segmentCoordinates = allCoordinates.subList(0, splitIndex + 1);
                remainingCoordinates = allCoordinates.subList(splitIndex, allCoordinates.size());
                
                // Adjust the segment time
                segmentTime = SEGMENT_DURATION_SECONDS;
            } else {
                // The whole route fits within our segment time
                segmentCoordinates = allCoordinates;
                reachedDestination = true;
            }
            
            // Create our step object
            Map<String, Object> step = new HashMap<>();
            step.put("route", segmentCoordinates);
            step.put("timestamp", segmentTimestamp);
            
            if (rainForSegment != null && rainForSegment.polygons != null) {
                step.put("rain_polygons", AreaUtils.reverseLonLat(rainForSegment.polygons));
            } else {
                step.put("rain_polygons", new ArrayList<>());
            }
            
            steps.add(step);
            
            // Update for next segment
            if (!reachedDestination && !remainingCoordinates.isEmpty()) {
                // Set our new current position to the end of the current segment
                List<Double> newPosition = segmentCoordinates.get(segmentCoordinates.size() - 1);
                currentLat = newPosition.get(0);
                currentLng = newPosition.get(1);
                
                // Update our cumulative time
                cumulativeTimeSeconds += segmentTime;
            }
        }
        
        // Include metadata to make it clear we're using simulated time
        response.put("steps", steps);
        response.put("simulatedStartTime", simulatedCurrentTime);
        response.put("simulationNote", "Route simulation starts from the earliest available weather data timestamp");
        
        return response;
    }

    /**
     * Find the best rain polygons data for a specific timestamp
     */
    private RainViewerRadarPolygonService.RainPolygonsResult findRainPolygonsForTimestamp(
            List<RainViewerRadarPolygonService.RainPolygonsResult> allPolygons, 
            long timestamp) {
        
        if (allPolygons == null || allPolygons.isEmpty()) {
            return null;
        }
        
        // Find the closest timestamp
        RainViewerRadarPolygonService.RainPolygonsResult closest = null;
        long minDifference = Long.MAX_VALUE;
        
        for (RainViewerRadarPolygonService.RainPolygonsResult result : allPolygons) {
            long diff = Math.abs(result.frameTime - timestamp);
            if (diff < minDifference) {
                minDifference = diff;
                closest = result;
            }
        }
        
        return closest;
    }

    public static void main(String[] args) {
        RoutingService service = new RoutingService();
        RainViewerRadarPolygonService rainService = new RainViewerRadarPolygonService();
        System.out.println("result : " + service.calculateWeatherAwareRouteBis(48.8566, 2.3522, 48.864716, 2.349014, Arrays.asList("rain")));
    }
}