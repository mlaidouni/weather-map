package fr.weathermap.services;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import io.github.cdimascio.dotenv.Dotenv;

import java.util.*;

@Service
public class RoutingService {

    private final Dotenv dotenv = Dotenv.load();
    private final String routeAPIKey = dotenv.get("OPEN_ROUTE_SERVICE_API_KEY");
    
    /**
     * Calculate a route between two points avoiding areas with specified weather conditions
     * Returns simplified route data with only distance, duration and coordinates
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> calculateWeatherAwareRoute(
            double startLat, double startLng, 
            double endLat, double endLng, 
            List<String> avoidWeatherConditions) {

        // Build the request URL and headers
        String url = "https://api.openrouteservice.org/v2/directions/driving-car/json";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", routeAPIKey);
        
        // Build the request body
        Map<String, Object> requestBody = new HashMap<>();
        // Coordinates are provided in [longitude, latitude] format
        List<List<Double>> coordinates = new ArrayList<>();
        coordinates.add(Arrays.asList(startLng, startLat));
        coordinates.add(Arrays.asList(endLng, endLat));
        requestBody.put("coordinates", coordinates);
        
        // Add alternative routes configuration
        Map<String, Object> alternativeRoutes = new HashMap<>();
        alternativeRoutes.put("target_count", 3);  // Request 3 alternative routes
        alternativeRoutes.put("weight_factor", 2.4);
        requestBody.put("alternative_routes", alternativeRoutes);
        
        // TODO: Add avoid_polygons based on weather conditions
        // This would require a method to convert weather conditions to avoid areas
        
        // Make POST request
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> apiResponse = restTemplate.postForObject(url, entity, Map.class);
        
        // Create our simplified response with only essential route data
        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> simplifiedRoutes = new ArrayList<>();
        
        try {
            // Extract all routes from the response
            List<Map<String, Object>> routes = (List<Map<String, Object>>) apiResponse.get("routes");
            
            if (routes != null && !routes.isEmpty()) {
                for (Map<String, Object> route : routes) {
                    Map<String, Object> simplifiedRoute = new HashMap<>();
                    
                    // Extract summary data - just distance and duration
                    Map<String, Object> summary = (Map<String, Object>) route.get("summary");
                    simplifiedRoute.put("distance", summary.get("distance"));
                    simplifiedRoute.put("duration", summary.get("duration"));
                    
                    // Extract route geometry (coordinates)
                    // simplifiedRoute.put("geometry", route.get("geometry"));

                    String encodedGeometry = route.get("geometry").toString();
                    List<List<Double>> coordinates_list = decodePolylineToLatLngList(encodedGeometry);
                    simplifiedRoute.put("coordinates", coordinates_list);

                    simplifiedRoutes.add(simplifiedRoute);
                }
            }
            
            response.put("routes", simplifiedRoutes);
            
        } catch (Exception e) {
            System.err.println("Error parsing API response: " + e.getMessage());
            e.printStackTrace();
            response.put("error", "Failed to parse routing data: " + e.getMessage());
        }

        return response;
    }

    private List<List<Double>> decodePolylineToLatLngList(String encoded) {
        List<List<Double>> latLngList = new ArrayList<>();
        int index = 0, len = encoded.length();
        int lat = 0, lng = 0;

        while (index < len) {
            int b, shift = 0, result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            List<Double> latLng = new ArrayList<>();
            latLng.add(lat / 1e5);
            latLng.add(lng / 1e5);
            latLngList.add(latLng);
        }

        return latLngList;
    }

    public static void main(String[] args) {
        RoutingService service = new RoutingService();
        Map<String, Object> route = service.calculateWeatherAwareRoute(
                48.8566, 2.3522,  // Paris
                48.77602916990935, 2.463881751424904, // Créteil
                Arrays.asList("rain", "snow"));
        System.out.println(route);
    }
}