package fr.weathermap.utils;

import java.util.*;

public class DouglasPeucker {

    // Point = [lat, lon]
    private static double distanceToSegment(List<Double> point, List<Double> lineStart, List<Double> lineEnd) {
        double x = point.get(1), y = point.get(0); // lon = x, lat = y
        double x1 = lineStart.get(1), y1 = lineStart.get(0);
        double x2 = lineEnd.get(1), y2 = lineEnd.get(0);

        double dx = x2 - x1;
        double dy = y2 - y1;

        if (dx == 0 && dy == 0) {
            dx = x - x1;
            dy = y - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }

        double t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);

        if (t < 0) {
            dx = x - x1;
            dy = y - y1;
        } else if (t > 1) {
            dx = x - x2;
            dy = y - y2;
        } else {
            double nx = x1 + t * dx;
            double ny = y1 + t * dy;
            dx = x - nx;
            dy = y - ny;
        }

        return Math.sqrt(dx * dx + dy * dy);
    }

    private static void douglasPeucker(List<List<Double>> points, double epsilon, List<List<Double>> result) {
        if (points.size() < 2) {
            result.addAll(points);
            return;
        }

        double dmax = 0;
        int index = 0;
        List<Double> start = points.get(0);
        List<Double> end = points.get(points.size() - 1);

        for (int i = 1; i < points.size() - 1; i++) {
            double d = distanceToSegment(points.get(i), start, end);
            if (d > dmax) {
                index = i;
                dmax = d;
            }
        }

        if (dmax > epsilon) {
            List<List<Double>> recResults1 = new ArrayList<>();
            List<List<Double>> recResults2 = new ArrayList<>();
            List<List<Double>> firstLine = points.subList(0, index + 1);
            List<List<Double>> lastLine = points.subList(index, points.size());

            douglasPeucker(new ArrayList<>(firstLine), epsilon, recResults1);
            douglasPeucker(new ArrayList<>(lastLine), epsilon, recResults2);

            result.addAll(recResults1.subList(0, recResults1.size() - 1));
            result.addAll(recResults2);
        } else {
            result.add(start);
            result.add(end);
        }
    }

    public static List<List<Double>> simplify(List<List<Double>> points, double epsilon) {
        List<List<Double>> result = new ArrayList<>();
        douglasPeucker(points, epsilon, result);
        return result;
    }
}