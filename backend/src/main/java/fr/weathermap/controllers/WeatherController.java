package fr.weathermap.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/weather")
public class WeatherController {
    
    @GetMapping("/current")
    public Map<String, Object> getCurrentWeather(
            @RequestParam(required = false, defaultValue = "48.86") double lat,
            @RequestParam(required = false, defaultValue = "2.33") double lng) {
        
        Map<String, Object> weather = new HashMap<>();
        weather.put("location", Map.of("lat", lat, "lng", lng));
        weather.put("temperature", 22.5);
        weather.put("condition", "Sunny");
        weather.put("windSpeed", 5.2);
        weather.put("humidity", 63);
        weather.put("timestamp", System.currentTimeMillis());
        
        return weather;
    }
}