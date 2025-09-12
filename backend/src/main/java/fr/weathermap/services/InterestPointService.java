package fr.weathermap.services;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;


@Service
public class InterestPointService {

    private static final int MAX_RESULTS = 10;

    public enum PointOfInterestType {
        RESTAURANT("amenity", "restaurant"),
        MUSEUM("tourism", "museum"),
        TOILETS("amenity", "toilets"),
        ATTRACTION("tourism", "attraction"),
        HOTEL("tourism", "hotel"),
        SUPERMARKET("shop", "supermarket");

        private final String key;
        private final String value;

        PointOfInterestType(String key, String value) {
            this.key = key;
            this.value = value;
        }

        public String getKey() { return key; }
        public String getValue() { return value; }
    }

    private static final List<PointOfInterestType> INTEREST_POINTS = List.of(
            PointOfInterestType.RESTAURANT,
            PointOfInterestType.TOILETS,
            PointOfInterestType.SUPERMARKET
    );

    private String buildUrl(double latitude, double longitude, PointOfInterestType type, int radius) {
        return "https://overpass-api.de/api/interpreter?data="
                + "[out:json];node(around:" + radius + "," + latitude + "," + longitude + ")[\""
                + type.getKey() + "\"=\"" + type.getValue() + "\"];out;";
    }

    private List<Map<String, Object>> fetchPois(double latitude, double longitude, PointOfInterestType type, int radius) {
        List<Map<String, Object>> pois = new ArrayList<>();
        try {
            String url = buildUrl(latitude, longitude, type, radius);

            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000); // 5s timeout connexion
            conn.setReadTimeout(10000);   // 10s timeout lecture

            BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = in.readLine()) != null) response.append(line);
            in.close();

            JSONObject json = new JSONObject(response.toString());
            JSONArray elements = json.getJSONArray("elements");

            for (int i = 0; i < elements.length() && pois.size() < MAX_RESULTS; i++) {
                JSONObject elem = elements.getJSONObject(i);
                Map<String, Object> poi = new HashMap<>();
                poi.put("id", elem.optLong("id"));
                poi.put("lat", elem.optDouble("lat"));
                poi.put("lon", elem.optDouble("lon"));
                poi.put("type", type.getValue());

                if (elem.has("tags")) {
                    JSONObject tags = elem.getJSONObject("tags");
                    poi.put("name", tags.optString("name", "Inconnu"));
                } else {
                    poi.put("name", "Inconnu");
                }

                pois.add(poi);
            }

        } catch (Exception e) {
            // On logge juste l'erreur et on continue
            System.err.println("Erreur fetch " + type.getValue() + " pour " + latitude + "," + longitude + " : " + e.getMessage());
        }

        return pois;
    }

    public Map<String, List<Map<String, Object>>> getAllSuggestions(List<Double> latitudes, List<Double> longitudes, int radius) {
        if (latitudes.size() != longitudes.size())
            throw new IllegalArgumentException("Les listes de latitudes et longitudes doivent avoir la même taille");

        Map<String, List<Map<String, Object>>> allResults = new HashMap<>();
        for (PointOfInterestType type : INTEREST_POINTS) {
            allResults.put(type.getValue(), new ArrayList<>());
        }

        for (int i = 0; i < latitudes.size(); i++) {
            double lat = latitudes.get(i);
            double lon = longitudes.get(i);

            for (PointOfInterestType type : INTEREST_POINTS) {
                List<Map<String, Object>> pois = fetchPois(lat, lon, type, radius);
                allResults.get(type.getValue()).addAll(pois);
            }
        }

        return allResults;
    }
}
