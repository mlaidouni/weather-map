package fr.weathermap.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import fr.weathermap.services.RainViewerRadarPolygonService;
import fr.weathermap.utils.AreaUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final RestTemplate restTemplate;

    @Autowired
    private RainViewerRadarPolygonService rainService;

    public WeatherController(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @GetMapping("/current")
    public Map<String, Object> getCurrentWeather(
            @RequestParam(defaultValue = "48.86") double lat,
            @RequestParam(defaultValue = "2.33") double lng) {

        String url = "https://api.open-meteo.com/v1/forecast"
                + "?latitude=" + lat
                + "&longitude=" + lng
                + "&current=temperature_2m,relative_humidity_2m,wind_speed_10m";

        // Réponse brute
        Map response = restTemplate.getForObject(url, Map.class);

        // On prépare un JSON simplifié
        Map<String, Object> filtered = new HashMap<>();
        filtered.put("latitude", lat);
        filtered.put("longitude", lng);

        if (response != null && response.containsKey("current") && response.containsKey("current_units")) {
            Map current = (Map) response.get("current");
            Map current_units = (Map) response.get("current_units");

            filtered.put("temperature", current.get("temperature_2m"));
            filtered.put("temperature_unit", current_units.get("temperature_2m"));
            filtered.put("humidity", current.get("relative_humidity_2m"));
            filtered.put("humidity_unit", current_units.get("relative_humidity_2m"));
            filtered.put("windSpeed", current.get("wind_speed_10m"));
            filtered.put("windSpeed_unit", current_units.get("wind_speed_10m"));   

        } else {
            filtered.put("error", "Impossible de lire la réponse de l'API");
        }

        return filtered;
    }

    /**
     * Vérifie s'il pleut à un point donné par ses coordonnées.
     * 
     * @param lat Latitude du point
     * @param lon Longitude du point
     * @return Une réponse JSON contenant {isRaining: true/false}
     */
    @GetMapping("/rain/check")
    public ResponseEntity<?> isRainingAtPoint(
            @RequestParam double lat,
            @RequestParam double lon) {
        
        Map<String, Object> response = new HashMap<>();
        response.put("latitude", lat);
        response.put("longitude", lon);
        
        try {
            boolean isRaining = rainService.isRainingAt(lat, lon);
            response.put("isRaining", isRaining);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("error", "Failed to check rain status: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    @GetMapping("/rain/zone")
    public Map<String, Object> getRainZone(
        @RequestParam double startLat,
        @RequestParam double startLng,
        @RequestParam double endLat,
        @RequestParam double endLng
    ) {
        Map<String, Object> response = new HashMap<>();
        Map<String, Double> expandedArea = AreaUtils.expandedArea(startLat, startLng, endLat, endLng, 30.0);
        List<List<List<Double>>> polygonsLonLat;
        try {
            polygonsLonLat = rainService.fetchRainPolygons(expandedArea.get("latMax"), expandedArea.get("lonMin"), expandedArea.get("latMin"), expandedArea.get("lonMax"));
        } catch (Exception e) {
            response.put("error", "Failed to fetch rain polygons: " + e.getMessage());
            return response;
        }
        response.put("polygons", AreaUtils.reverseLonLat(polygonsLonLat));
        return response;
    }
}

