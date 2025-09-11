package fr.weathermap.services;

import org.springframework.stereotype.Service;

import fr.weathermap.utils.DouglasPeucker;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.Instant;
import java.util.*;

/**
 * Génère des polygones de zones de pluie depuis les tuiles RainViewer.
 * Permet de choisir la frame temporelle:
 *  - LATEST_PAST : dernière observation passée (défaut)
 *  - NEAREST_TO_NOW : frame la plus proche de "maintenant" (peut être futur immédiat si nowcast plus proche)
 *  - PAST_INDEX : index dans la liste des frames passées (0 = plus ancienne)
 *  - FUTURE_INDEX : index dans la liste nowcast (0 = plus proche futur)
 *  - CLOSEST_TO_TIMESTAMP : frame (past ou nowcast) la plus proche d'un timestamp UNIX fourni
 *
 * Les polygones sont fusionnés par composante connexe (contour unique).
 */
@Service
public class RainViewerRadarPolygonService {

    // Tolérance de simplification Douglas-Peucker (en degrés)
    public static final double DouglasPeuckerToleranceDegrees = 0.05;

    // Modes de sélection temporelle
    public enum TimeMode {
        OLDEST_PAST,
        LATEST_PAST,
        NEAREST_TO_NOW,
        PAST_INDEX,
        FUTURE_INDEX,
        CLOSEST_TO_TIMESTAMP
    }

    // Résultat enrichi (polygones + timestamp de la frame utilisée + mode effectif)
    public static class RainPolygonsResult {
        public final List<List<List<Double>>> polygons;
        public final long frameTime;      // UNIX seconds
        public final TimeMode modeUsed;
        public RainPolygonsResult(List<List<List<Double>>> polygons, long frameTime, TimeMode modeUsed) {
            this.polygons = polygons;
            this.frameTime = frameTime;
            this.modeUsed = modeUsed;
        }

        public List<List<List<Double>>> getSimplifiedPolygons() {
            List<List<List<Double>>> simplifiedPolygons = new ArrayList<>();
            for (List<List<Double>> polygon : polygons) {
                List<List<Double>> simplified = DouglasPeucker.simplify(polygon, DouglasPeuckerToleranceDegrees);    // Tolérance en degrés
                simplifiedPolygons.add(simplified);
            }
            return simplifiedPolygons;
        }
    }

    private final RainViewerCatalog catalog = new RainViewerCatalog();
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)
            .build();

    private static final int MAX_TILES = 180;
    private static final int TILE_SIZE = 256;
    private static final int COLOR_SCHEME = 2;      // Universal Blue
    private static final int SMOOTH = 1;
    private static final int SNOW = 1;
    private static final String EXT = "png";

    /* ==================== API PUBLIQUE ==================== */

    // Compatibilité: ancienne méthode -> dernière observation passée
    public List<List<List<Double>>> fetchRainPolygons(double topLat,
                                                      double leftLon,
                                                      double bottomLat,
                                                      double rightLon,
                                                      TimeMode mode,
                                                      boolean simplify) throws IOException, InterruptedException {
        RainPolygonsResult result = fetchRainPolygons(topLat, leftLon, bottomLat, rightLon, mode, -1, null);
        return simplify ? result.getSimplifiedPolygons() : result.polygons;
    }

    // Retour enrichi avec choix mode
    public RainPolygonsResult fetchRainPolygons(double topLat,
                                                double leftLon,
                                                double bottomLat,
                                                double rightLon,
                                                TimeMode mode,
                                                int index,
                                                Long targetTimestamp) throws IOException, InterruptedException {

        normalizeBBoxRef(topLat, leftLon, bottomLat, rightLon);
        double nTopLat = normTopLat;
        double nLeftLon = normLeftLon;
        double nBottomLat = normBottomLat;
        double nRightLon = normRightLon;

        RainViewerCatalog.Catalog cat = catalog.fetch();
        RainViewerCatalog.Frame frame = selectFrame(cat, mode, index, targetTimestamp);
        if (frame == null) {
            return new RainPolygonsResult(List.of(), 0L, mode);
        }

        int zoom = chooseZoom(nTopLat, nLeftLon, nBottomLat, nRightLon);
        int xMin = lonToTileX(nLeftLon, zoom);
        int xMax = lonToTileX(nRightLon, zoom);
        int yMin = latToTileY(nTopLat, zoom);
        int yMax = latToTileY(nBottomLat, zoom);

        int tiles = (xMax - xMin + 1) * (yMax - yMin + 1);
        if (tiles > MAX_TILES) {
            while (tiles > MAX_TILES && zoom > 3) {
                zoom--;
                xMin = lonToTileX(nLeftLon, zoom);
                xMax = lonToTileX(nRightLon, zoom);
                yMin = latToTileY(nTopLat, zoom);
                yMax = latToTileY(nBottomLat, zoom);
                tiles = (xMax - xMin + 1) * (yMax - yMin + 1);
            }
        }

        int totalWidth = (xMax - xMin + 1) * TILE_SIZE;
        int totalHeight = (yMax - yMin + 1) * TILE_SIZE;
        boolean[][] mask = new boolean[totalHeight][totalWidth];

        for (int xt = xMin; xt <= xMax; xt++) {
            for (int yt = yMin; yt <= yMax; yt++) {
                String url = catalog.buildTileUrl(
                        cat.host, frame, zoom, xt, yt,
                        TILE_SIZE, COLOR_SCHEME, SMOOTH, SNOW, EXT
                );
                BufferedImage img = downloadTile(url);
                if (img == null) continue;
                int offsetX = (xt - xMin) * TILE_SIZE;
                int offsetY = (yt - yMin) * TILE_SIZE;

                for (int py = 0; py < TILE_SIZE; py++) {
                    for (int px = 0; px < TILE_SIZE; px++) {
                        int argb = img.getRGB(px, py);
                        int alpha = (argb >>> 24) & 0xFF;
                        if (alpha == 0) continue;
                        mask[offsetY + py][offsetX + px] = true;
                    }
                }
            }
        }

        List<List<List<Double>>> polygons = maskToMergedPolygons(mask, zoom, xMin, yMin);
        return new RainPolygonsResult(polygons, frame.time, mode);
    }

    // Vérifier pluie à un point pour un mode/temps donné
    public boolean isRainingAt(double lat, double lon,
                               TimeMode mode,
                               int index,
                               Long targetTimestamp) throws IOException, InterruptedException {
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
        RainViewerCatalog.Catalog cat = catalog.fetch();
        RainViewerCatalog.Frame frame = selectFrame(cat, mode, index, targetTimestamp);
        if (frame == null) return false;
        int zoom = 9;

        double n = Math.pow(2, zoom);
        double xFloat = (lon + 180.0) / 360.0 * n;
        int tileX = (int)Math.floor(xFloat);
        double xFrac = xFloat - tileX;

        double latRad = Math.toRadians(lat);
        double yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
        int tileY = (int)Math.floor(yFloat);
        double yFrac = yFloat - tileY;

        if (tileX < 0 || tileX >= n || tileY < 0 || tileY >= n) return false;

        String url = catalog.buildTileUrl(
                cat.host, frame, zoom, tileX, tileY,
                TILE_SIZE, COLOR_SCHEME, SMOOTH, SNOW, EXT
        );
        BufferedImage img = downloadTile(url);
        if (img == null) return false;

        int px = (int)Math.floor(xFrac * TILE_SIZE);
        int py = (int)Math.floor(yFrac * TILE_SIZE);
        if (px < 0) px = 0; if (px >= TILE_SIZE) px = TILE_SIZE - 1;
        if (py < 0) py = 0; if (py >= TILE_SIZE) py = TILE_SIZE - 1;

        int argb = img.getRGB(px, py);
        int alpha = (argb >>> 24) & 0xFF;
        return alpha > 0;
    }

    // Surcharge simple (comportement historique)
    public boolean isRainingAt(double lat, double lon) throws IOException, InterruptedException {
        return isRainingAt(lat, lon, TimeMode.OLDEST_PAST, -1, null);
    }

    /**
     * Récupère tous les polygones de pluie disponibles (passé et prévisions) pour une zone donnée.
     * Retourne une liste chronologique de RainPolygonsResult.
     * 
     * @param topLat Latitude nord de la zone
     * @param leftLon Longitude ouest de la zone
     * @param bottomLat Latitude sud de la zone
     * @param rightLon Longitude est de la zone
     * @return Liste des RainPolygonsResult ordonnés chronologiquement
     */
    public List<RainPolygonsResult> fetchAllRainPolygons(double topLat,
                                                       double leftLon,
                                                       double bottomLat,
                                                       double rightLon) throws IOException, InterruptedException {
        
        List<RainPolygonsResult> results = new ArrayList<>();
        RainViewerCatalog.Catalog cat = catalog.fetch();
        
        // Traitement des frames passées
        for (int i = 0; i < cat.past.size(); i++) {
            RainPolygonsResult result = fetchRainPolygons(
                topLat, leftLon, bottomLat, rightLon, 
                TimeMode.PAST_INDEX, i, null
            );
            results.add(result);
        }
        
        // Traitement des prévisions (nowcast)
        for (int i = 0; i < cat.nowcast.size(); i++) {
            RainPolygonsResult result = fetchRainPolygons(
                topLat, leftLon, bottomLat, rightLon,
                TimeMode.FUTURE_INDEX, i, null
            );
            results.add(result);
        }
        
        // Tri chronologique par timestamp
        results.sort(Comparator.comparingLong(r -> r.frameTime));
        
        return results;
    }

    /* ==================== SÉLECTION DE FRAME ==================== */

    private RainViewerCatalog.Frame selectFrame(RainViewerCatalog.Catalog cat,
                                                TimeMode mode,
                                                int index,
                                                Long targetTimestamp) {
        if (cat == null || cat.past.isEmpty()) return null;

        switch (mode) {
            case OLDEST_PAST:
                return cat.past.get(0); // Returns the oldest observation
            case LATEST_PAST:
                return cat.past.get(cat.past.size() - 1);

            case NEAREST_TO_NOW: {
                RainViewerCatalog.Frame lastPast = cat.past.get(cat.past.size() - 1);
                if (cat.nowcast.isEmpty()) return lastPast;
                RainViewerCatalog.Frame firstFuture = cat.nowcast.get(0);
                long now = System.currentTimeMillis() / 1000;
                long dPast = Math.abs(now - lastPast.time);
                long dFuture = Math.abs(firstFuture.time - now);
                return dPast <= dFuture ? lastPast : firstFuture;
            }

            case PAST_INDEX: {
                if (index < 0) index = 0;
                if (index >= cat.past.size()) index = cat.past.size() - 1;
                return cat.past.get(index);
            }

            case FUTURE_INDEX: {
                if (cat.nowcast == null || cat.nowcast.isEmpty()) return null;
                if (index < 0) index = 0;
                if (index >= cat.nowcast.size()) index = cat.nowcast.size() - 1;
                return cat.nowcast.get(index);
            }

            case CLOSEST_TO_TIMESTAMP: {
                long target = (targetTimestamp != null) ? targetTimestamp : (System.currentTimeMillis() / 1000);
                RainViewerCatalog.Frame best = null;
                long bestDiff = Long.MAX_VALUE;
                // Parcourir past
                for (RainViewerCatalog.Frame f : cat.past) {
                    long d = Math.abs(f.time - target);
                    if (d < bestDiff) {
                        bestDiff = d; best = f;
                    }
                }
                // Parcourir nowcast
                if (cat.nowcast != null) {
                    for (RainViewerCatalog.Frame f : cat.nowcast) {
                        long d = Math.abs(f.time - target);
                        if (d < bestDiff) {
                            bestDiff = d; best = f;
                        }
                    }
                }
                return best;
            }

            default:
                return cat.past.get(cat.past.size() - 1);
        }
    }

    /* ==================== NORMALISATION BBOX ==================== */

    private double normTopLat, normLeftLon, normBottomLat, normRightLon;
    private void normalizeBBoxRef(double topLat, double leftLon, double bottomLat, double rightLon) {
        double tTop = topLat;
        double tBottom = bottomLat;
        if (tBottom > tTop) { double tmp = tBottom; tBottom = tTop; tTop = tmp; }
        double tLeft = leftLon;
        double tRight = rightLon;
        if (tLeft > tRight) { double tmp = tLeft; tLeft = tRight; tRight = tmp; }
        normTopLat = tTop;
        normBottomLat = tBottom;
        normLeftLon = tLeft;
        normRightLon = tRight;
    }

    /* ==================== TÉLÉCHARGEMENT TUILES ==================== */

    private BufferedImage downloadTile(String url) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() == 200) {
                return ImageIO.read(new java.io.ByteArrayInputStream(resp.body()));
            }
        } catch (IOException | InterruptedException ignored) {}
        return null;
    }

    /* ==================== ZOOM ==================== */

    private int chooseZoom(double topLat, double leftLon, double bottomLat, double rightLon) {
        double lonSpan = Math.abs(rightLon - leftLon);
        int z = 9;
        while (z > 3) {
            double tilesX = lonSpan / (360.0 / (1 << z));
            if (tilesX <= 12) break;
            z--;
        }
        return z;
    }

    /* ==================== EXTRACTION CONTOURS ==================== */

    private static final class Edge {
        int x1,y1,x2,y2; boolean used;
        Edge(int x1,int y1,int x2,int y2){this.x1=x1;this.y1=y1;this.x2=x2;this.y2=y2;}
    }

    private List<List<List<Double>>> maskToMergedPolygons(boolean[][] mask,
                                                          int zoom,
                                                          int xTileMin,
                                                          int yTileMin) {
        int h = mask.length;
        if (h == 0) return List.of();
        int w = mask[0].length;

        List<Edge> edges = new ArrayList<>();
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (!mask[y][x]) continue;
                if (y == 0 || !mask[y-1][x]) edges.add(new Edge(x, y, x+1, y));
                if (x == w-1 || !mask[y][x+1]) edges.add(new Edge(x+1, y, x+1, y+1));
                if (y == h-1 || !mask[y+1][x]) edges.add(new Edge(x+1, y+1, x, y+1));
                if (x == 0 || !mask[y][x-1]) edges.add(new Edge(x, y+1, x, y));
            }
        }
        if (edges.isEmpty()) return List.of();

        Map<Long, List<Edge>> startMap = new HashMap<>();
        for (Edge e : edges) {
            long key = key(e.x1, e.y1);
            startMap.computeIfAbsent(key, k -> new ArrayList<>()).add(e);
        }

        List<List<List<Double>>> polys = new ArrayList<>();
        for (Edge e : edges) {
            if (e.used) continue;
            List<int[]> ring = new ArrayList<>();
            Edge cur = e;
            ring.add(new int[]{cur.x1, cur.y1});
            while (true) {
                cur.used = true;
                ring.add(new int[]{cur.x2, cur.y2});
                if (cur.x2 == e.x1 && cur.y2 == e.y1) break;
                long k = key(cur.x2, cur.y2);
                List<Edge> nextList = startMap.get(k);
                Edge nextEdge = null;
                if (nextList != null) {
                    for (Edge cand : nextList) {
                        if (!cand.used) { nextEdge = cand; break; }
                    }
                }
                if (nextEdge == null) { ring.clear(); break; }
                cur = nextEdge;
            }
            if (ring.isEmpty()) continue;
            if (ring.size() > 1) {
                int[] first = ring.get(0);
                int[] last = ring.get(ring.size()-1);
                if (first[0] == last[0] && first[1] == last[1]) ring.remove(ring.size()-1);
            }
            ring = simplifyOrthogonal(ring);
            if (ring.size() < 3) continue;

            List<List<Double>> poly = new ArrayList<>(ring.size());
            for (int[] p : ring) {
                poly.add(pixelCornerToLonLat(p[0], p[1], zoom, xTileMin, yTileMin));
            }
            polys.add(poly);
        }
        return polys;
    }

    private static List<int[]> simplifyOrthogonal(List<int[]> pts) {
        if (pts.size() < 4) return pts;
        List<int[]> out = new ArrayList<>();
        for (int i = 0; i < pts.size(); i++) {
            int[] prev = pts.get((i - 1 + pts.size()) % pts.size());
            int[] cur = pts.get(i);
            int[] next = pts.get((i + 1) % pts.size());
            int dx1 = cur[0] - prev[0];
            int dy1 = cur[1] - prev[1];
            int dx2 = next[0] - cur[0];
            int dy2 = next[1] - cur[1];
            if (dx1 == 0 && dx2 == 0) continue;
            if (dy1 == 0 && dy2 == 0) continue;
            out.add(cur);
        }
        return out;
    }

    private static long key(int x, int y) {
        return (((long)x) << 32) ^ (y & 0xffffffffL);
    }

    private List<Double> pixelCornerToLonLat(int pxGlobalEdge, int pyGlobalEdge,
                                             int z, int xTileMin, int yTileMin) {
        double mapSize = TILE_SIZE * Math.pow(2, z);
        double globalX = xTileMin * TILE_SIZE + pxGlobalEdge;
        double globalY = yTileMin * TILE_SIZE + pyGlobalEdge;
        double lon = globalX / mapSize * 360.0 - 180.0;
        double n = Math.PI - 2.0 * Math.PI * globalY / mapSize;
        double lat = Math.toDegrees(Math.atan(Math.sinh(n)));
        return List.of(lon, lat);
    }

    /* ==================== UTILITAIRES XYZ ==================== */

    private int lonToTileX(double lon, int z) {
        return (int)Math.floor((lon + 180.0) / 360.0 * (1 << z));
    }
    private int latToTileY(double lat, int z) {
        double rad = Math.toRadians(lat);
        return (int)Math.floor(
                (1 - Math.log(Math.tan(rad) + 1/Math.cos(rad)) / Math.PI) / 2 * (1 << z)
        );
    }

    /* ==================== DEMO MAIN ==================== */

    public static void main(String[] args) {
        RainViewerRadarPolygonService svc = new RainViewerRadarPolygonService();
        try {
            RainPolygonsResult res1 = svc.fetchRainPolygons(
                    48.9, 2.1, 48.6, 2.55,
                    TimeMode.LATEST_PAST, -1, null
            );
            System.out.println("LATEST_PAST polygons=" + res1.polygons.size() +
                    " time=" + Instant.ofEpochSecond(res1.frameTime));

            RainPolygonsResult res2 = svc.fetchRainPolygons(
                    48.9, 2.1, 48.6, 2.55,
                    TimeMode.NEAREST_TO_NOW, -1, null
            );
            System.out.println("NEAREST_TO_NOW polygons=" + res2.polygons.size() +
                    " time=" + Instant.ofEpochSecond(res2.frameTime));

            RainPolygonsResult res3 = svc.fetchRainPolygons(
                    48.9, 2.1, 48.6, 2.55,
                    TimeMode.FUTURE_INDEX, 0, null
            );
            System.out.println("FUTURE_INDEX(0) polygons=" + res3.polygons.size() +
                    " time=" + Instant.ofEpochSecond(res3.frameTime));

            long target = Instant.now().minusSeconds(900).getEpochSecond();
            RainPolygonsResult res4 = svc.fetchRainPolygons(
                    48.9, 2.1, 48.6, 2.55,
                    TimeMode.CLOSEST_TO_TIMESTAMP, -1, target
            );
            System.out.println("CLOSEST_TO_TIMESTAMP polygons=" + res4.polygons.size() +
                    " target=" + target + " frame=" + res4.frameTime);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}