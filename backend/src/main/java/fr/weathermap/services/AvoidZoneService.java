package fr.weathermap.services;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AvoidZoneService {

    double SEUIL_RAIN = 0.0; // mm/h
    private int ROWS = 15;
    private int COLS = 15;
    
    @Autowired
    private WeatherService weatherService;

    private double MARGE = 30.0; // marge en km

    public Map<String, Object> zone_total(
        List<List<Double>> coordinates
    ){
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
    public Map<String, Object> smallZones(List<List<Double>> coordinates) {

        // On récupère la bounding box totale
        Map<String, Object> totalBox = zone_total(coordinates);

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

    @SuppressWarnings("unchecked")
    public Map<String, Object> smallZonesWithRain(List<List<Double>> coordinates) {

        // Récupère toutes les petites zones
        Map<String, Object> smallZonesMap = smallZones(coordinates);

        Map<String, Double> boundingBox = (Map<String, Double>) smallZonesMap.get("boundingBox");
        List<Map<String, Double>> zones = (List<Map<String, Double>>) smallZonesMap.get("zones");

        List<Map<String, Object>> zonesWithWeather = new ArrayList<>();

        // Préparer listes de centres
        List<Double> latCenters = new ArrayList<>();
        List<Double> lonCenters = new ArrayList<>();
        List<Map<String, Double>> zoneBatch = new ArrayList<>();

        for (Map<String, Double> zone : zones) {
            double cellLatMin = zone.get("latMin");
            double cellLatMax = zone.get("latMax");
            double cellLonMin = zone.get("lonMin");
            double cellLonMax = zone.get("lonMax");

            double centerLat = (cellLatMin + cellLatMax) / 2.0;
            double centerLon = (cellLonMin + cellLonMax) / 2.0;

            latCenters.add(centerLat);
            lonCenters.add(centerLon);
            zoneBatch.add(zone);

            // Dès qu’on a 5 points → appel API
            if (latCenters.size() == 5) {
                processBatch(latCenters, lonCenters, zoneBatch, zonesWithWeather);
                latCenters.clear();
                lonCenters.clear();
                zoneBatch.clear();
            }
        }

        // Traiter le dernier batch (<5)
        if (!latCenters.isEmpty()) {
            processBatch(latCenters, lonCenters, zoneBatch, zonesWithWeather);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("boundingBox", boundingBox);
        response.put("zones", zonesWithWeather);

        return response;
    }

    // Traite un batch de 1 à 5 zones
    private void processBatch(List<Double> latCenters, List<Double> lonCenters,
                            List<Map<String, Double>> zoneBatch,
                            List<Map<String, Object>> zonesWithWeather) {

        List<Map<String, Object>> weatherList = weatherService.getCurrentWeather(latCenters, lonCenters);

        for (int i = 0; i < zoneBatch.size(); i++) {
            Map<String, Double> zone = zoneBatch.get(i);
            double centerLat = latCenters.get(i);
            double centerLon = lonCenters.get(i);

            Map<String, Object> weather = weatherList.get(i);

            boolean isRaining = false;
            if (weather != null && weather.containsKey("rain")) {
                Double precipitation = Double.valueOf(weather.get("rain").toString());
                isRaining = precipitation > SEUIL_RAIN;
            }

            Map<String, Object> zoneWithWeather = new HashMap<>(zone);
            zoneWithWeather.put("centerLat", centerLat);
            zoneWithWeather.put("centerLon", centerLon);
            zoneWithWeather.put("isRaining", isRaining);

            zonesWithWeather.add(zoneWithWeather);
        }
    }

    @SuppressWarnings("unchecked")
    public List<List<List<Double>>> rainingPolygonsLonLat(List<List<Double>> coordinates) {
        // Récupérer toutes les petites zones avec pluie
        Map<String, Object> zonesMap = smallZonesWithRain(coordinates);
        List<Map<String, Object>> zones = (List<Map<String, Object>>) zonesMap.get("zones");

        // Filtrer uniquement celles où il pleut
        List<Map<String, Object>> rainingZones = zones.stream()
            .filter(z -> Boolean.TRUE.equals(z.get("isRaining")))
            .toList();

        List<List<List<Double>>> polygons = new ArrayList<>();
        List<Map<String, Object>> toProcess = new ArrayList<>(rainingZones);

        while (!toProcess.isEmpty()) {
            Map<String, Object> current = toProcess.remove(0);

            // bounding box initiale
            double latMin = (double) current.get("latMin");
            double latMax = (double) current.get("latMax");
            double lonMin = (double) current.get("lonMin");
            double lonMax = (double) current.get("lonMax");

            boolean merged;
            do {
                merged = false;
                for (int i = 0; i < toProcess.size(); i++) {
                    Map<String, Object> other = toProcess.get(i);
                    double oLatMin = (double) other.get("latMin");
                    double oLatMax = (double) other.get("latMax");
                    double oLonMin = (double) other.get("lonMin");
                    double oLonMax = (double) other.get("lonMax");

                    // Vérifie si les zones se touchent ou se chevauchent
                    boolean overlapLat = !(oLatMax < latMin || oLatMin > latMax);
                    boolean overlapLon = !(oLonMax < lonMin || oLonMin > lonMax);

                    if (overlapLat && overlapLon) {
                        latMin = Math.min(latMin, oLatMin);
                        latMax = Math.max(latMax, oLatMax);
                        lonMin = Math.min(lonMin, oLonMin);
                        lonMax = Math.max(lonMax, oLonMax);
                        toProcess.remove(i);
                        merged = true;
                        break;
                    }
                }
            } while (merged);

            // Construire le polygone rectangulaire en ordre horaire
            List<List<Double>> polygon = new ArrayList<>();
            polygon.add(List.of(lonMin, latMin)); // bas-gauche
            polygon.add(List.of(lonMin, latMax)); // haut-gauche
            polygon.add(List.of(lonMax, latMax)); // haut-droit
            polygon.add(List.of(lonMax, latMin)); // bas-droit

            polygons.add(polygon);
        }

        return polygons;
    }

    public List<List<List<Double>>> reverseLonLat(List<List<List<Double>>> polygons) {
        List<List<List<Double>>> reversed = new ArrayList<>();
        for (List<List<Double>> polygon : polygons) {
            List<List<Double>> revPoly = new ArrayList<>();
            for (List<Double> point : polygon) {
                revPoly.add(List.of(point.get(1), point.get(0))); // Inverse lat/lon
            }
            reversed.add(revPoly);
        }
        return reversed;
    }
}
