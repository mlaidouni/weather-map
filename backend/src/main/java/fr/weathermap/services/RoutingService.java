package fr.weathermap.services;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import io.github.cdimascio.dotenv.Dotenv;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RoutingService {

    private final Dotenv dotenv = Dotenv.load();
    private final String routeAPIKey = dotenv.get("OPEN_ROUTE_SERVICE_API_KEY");
    
    /**
     * Calculate a route between two points avoiding areas with specified weather conditions
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> calculateWeatherAwareRoute(
            double startLat, double startLng, 
            double endLat, double endLng, 
            List<String> avoidWeatherConditions) {

        // Use a routing API to get the route
        String url = String.format(Locale.US,
        "https://api.openrouteservice.org/v2/directions/driving-car?api_key=%s&start=%f,%f&end=%f,%f",
                routeAPIKey, startLng, startLat, endLng, endLat);

        System.out.println(url);

        // Call the API and process the response
        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> apiResponse = restTemplate.getForObject(url, Map.class);
        
        // Create our response
        Map<String, Object> response = new HashMap<>();
        
        // Extract data from the API response with proper structure navigation
        try {
            List<Map<String, Object>> features = (List<Map<String, Object>>) apiResponse.get("features");
            if (features != null && !features.isEmpty()) {
                Map<String, Object> feature = features.get(0);
                Map<String, Object> properties = (Map<String, Object>) feature.get("properties");
                List<Map<String, Object>> segments = (List<Map<String, Object>>) properties.get("segments");
                Map<String, Object> segment = segments.get(0);

                response.put("distance", segment.get("distance"));
                response.put("duration", segment.get("duration"));
                
                // Also extract the route geometry for map display
                Map<String, Object> geometry = (Map<String, Object>) feature.get("geometry");
                response.put("coordinates", geometry.get("coordinates"));
            }
        } catch (Exception e) {
            System.err.println("Error parsing API response: " + e.getMessage());
            response.put("error", "Failed to parse routing data");
        }

        return response;
    }
}