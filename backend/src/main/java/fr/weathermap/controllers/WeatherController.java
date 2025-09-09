package fr.weathermap.controllers;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final RestTemplate restTemplate;

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
}
