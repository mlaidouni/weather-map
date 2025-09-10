package fr.weathermap.services;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AvoidZoneService {

    private int ROWS = 10;
    private int COLS = 10;

    @Autowired
    private RoutingService routingService;

    private double MARGE = 50.0; // marge en km

    @SuppressWarnings("unchecked")
    public Map<String, Object> zone_total(
        double startLat, double startLng, 
        double endLat, double endLng
    ){

        Map<String, Object> routeResponse = routingService.calculateWeatherAwareRoute(
            startLat, startLng, endLat, endLng, new ArrayList<>()
        );

        List<Map<String, Object>> routes = (List<Map<String, Object>>) routeResponse.get("routes");
        if (routes == null || routes.isEmpty()) {
            throw new RuntimeException("No route returned by the API");
        }

        //On récupère la liste des coordonnées de la première route (tu peux adapter pour plusieurs routes)
        List<List<Double>> coordinates = (List<List<Double>>) routes.get(0).get("coordinates");

        // On initialise latMin/max et lonMin/max avec le premier point
        double latMin = coordinates.get(0).get(0);
        double latMax = coordinates.get(0).get(0);
        double lonMin = coordinates.get(0).get(1);
        double lonMax = coordinates.get(0).get(1);
        

        // On parcourt tous les points pour trouver les min/max
        for (List<Double> point : coordinates) {
            double lat = point.get(0);
            double lon = point.get(1);

            if (lat < latMin) latMin = lat;
            if (lat > latMax) latMax = lat;
            if (lon < lonMin) lonMin = lon;
            if (lon > lonMax) lonMax = lon;
        }


        
        // Latitude centrale pour conversion de longitude
        double latCenter = (latMin + latMax) / 2.0;

        // Conversion marge en degrés
        double latOffset = MARGE / 111.0;
        double lonOffset = MARGE / (111.0 * Math.cos(Math.toRadians(latCenter)));

        // Élargissement de la bounding box
        latMin -= latOffset;
        latMax += latOffset;
        lonMin -= lonOffset;
        lonMax += lonOffset;

        Map<String, Object> response = new HashMap<>();
        response.put("boundingBox", Map.of(
                "latMin", latMin,
                "latMax", latMax,
                "lonMin", lonMin,
                "lonMax", lonMax
        ));

    return response;
}

    @SuppressWarnings("unchecked")
    // Nouvelle fonction pour découper en petites zones
    public Map<String, Object> smallZones(double startLat, double startLng, double endLat, double endLng) {

        // On récupère la bounding box totale
        Map<String, Object> totalBox = zone_total(startLat, startLng, endLat, endLng);
        
        Map<String, Double> box = (Map<String, Double>) totalBox.get("boundingBox");

        double latMin = box.get("latMin");
        double latMax = box.get("latMax");
        double lonMin = box.get("lonMin");
        double lonMax = box.get("lonMax");

        double latStep = (latMax - latMin) / ROWS;
        double lonStep = (lonMax - lonMin) / COLS;

        List<Map<String, Double>> zones = new ArrayList<>();

        for (int i = 0; i < ROWS; i++) {
            for (int j = 0; j < COLS; j++) {
                double cellLatMin = latMin + i * latStep;
                double cellLatMax = cellLatMin + latStep;
                double cellLonMin = lonMin + j * lonStep;
                double cellLonMax = cellLonMin + lonStep;

                Map<String, Double> cell = new HashMap<>();
                cell.put("latMin", cellLatMin);
                cell.put("latMax", cellLatMax);
                cell.put("lonMin", cellLonMin);
                cell.put("lonMax", cellLonMax);

                zones.add(cell);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("boundingBox", box);
        response.put("zones", zones);

        return response;
    }
}
