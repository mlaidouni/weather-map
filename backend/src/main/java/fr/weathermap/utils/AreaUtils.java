package fr.weathermap.utils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class AreaUtils {

    public static Map<String, Double> expandedArea(
            double startLat, double startLng,
            double endLat, double endLng,
            double marginKm) {
        double latCenter = (startLat + endLat) / 2.0;

        // Conversion marge en degrés
        double latOffset = marginKm / 111.0;
        double lonOffset = marginKm / (111.0 * Math.cos(Math.toRadians(latCenter)));

        // Bounding box centrée sur start et end
        double latMin = Math.min(startLat, endLat) - latOffset;
        double latMax = Math.max(startLat, endLat) + latOffset;
        double lonMin = Math.min(startLng, endLng) - lonOffset;
        double lonMax = Math.max(startLng, endLng) + lonOffset;

        Map<String, Double> response = new HashMap<>();
        response.put("latMin", latMin);
        response.put("latMax", latMax);
        response.put("lonMin", lonMin);
        response.put("lonMax", lonMax);

        // pour prendre le coin en haut à gauche, il faut choisir (latMax, lonMin)

        return response;
    }

    public static List<List<List<Double>>> reverseLonLat(List<List<List<Double>>> polygons) {
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
