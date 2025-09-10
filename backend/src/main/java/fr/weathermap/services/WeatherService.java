package fr.weathermap.services;


import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.client.RestTemplate;

@Service
public class WeatherService {
    

    private final RestTemplate restTemplate;

    public WeatherService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    
    @SuppressWarnings({ "rawtypes", "unchecked" })
    public List<Map<String, Object>> getCurrentWeather(
            @RequestParam(defaultValue = "48.86") List<Double> lat,
            @RequestParam(defaultValue = "2.33") List<Double> lng) {

        String allLat = String.join(",", lat.stream().map(Object::toString).toArray(String[]::new));
        String allLng = String.join(",", lng.stream().map(Object::toString).toArray(String[]::new));
        String url = "https://api.open-meteo.com/v1/forecast"
                + "?latitude=" + allLat
                + "&longitude=" + allLng
                + "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,rain";

        // Ici la réponse est un tableau JSON → donc List
        List<Map> responseList = restTemplate.getForObject(url, List.class);

        List<Map<String, Object>> results = new ArrayList<>();

        if (responseList != null) {
            for (Map resp : responseList) {
                Map<String, Object> filtered = new HashMap<>();
                filtered.put("latitude", resp.get("latitude"));
                filtered.put("longitude", resp.get("longitude"));

                if (resp.containsKey("current") && resp.containsKey("current_units")) {
                    Map current = (Map) resp.get("current");
                    Map current_units = (Map) resp.get("current_units");

                    filtered.put("temperature", current.get("temperature_2m"));
                    filtered.put("temperature_unit", current_units.get("temperature_2m"));
                    filtered.put("humidity", current.get("relative_humidity_2m"));
                    filtered.put("humidity_unit", current_units.get("relative_humidity_2m"));
                    filtered.put("windSpeed", current.get("wind_speed_10m"));
                    filtered.put("windSpeed_unit", current_units.get("wind_speed_10m"));
                    filtered.put("rain", current.get("rain"));
                    filtered.put("rain_unit", current_units.get("rain"));
                } else {
                    filtered.put("error", "Impossible de lire la réponse de l'API");
                }

                results.add(filtered);
            }
        }
        return results;
    }


    public static void main(String[] args) {
        // Just for testing
        WeatherService ws = new WeatherService(new RestTemplate());
        List<Double> lat = new ArrayList<>();
        lat.add(48.86);
        lat.add(47.87);
        List<Double> lon = new ArrayList<>();
        lon.add(2.33);
        lon.add(2.22);
        List<Map<String, Object>> weather = ws.getCurrentWeather(lat, lon);
        System.out.println(weather);
        System.out.println(weather.get(0).get("rain"));
        System.out.println(weather.get(1).get("rain"));
    }
}
