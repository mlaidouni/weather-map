package fr.weathermap.services;

import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.util.*;

/**
 * Génère des polygones de zones de pluie depuis les tuiles RainViewer.
 * Nouvelle version: extraction de contours par assemblage d'arêtes (fusion des zones adjacentes).
 */
@Service
public class RainViewerRadarPolygonService {

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

    public List<List<List<Double>>> fetchRainPolygons(double topLat,
                                                      double leftLon,
                                                      double bottomLat,
                                                      double rightLon) throws IOException, InterruptedException {

        if (bottomLat > topLat) {
            double tmp = bottomLat; bottomLat = topLat; topLat = tmp;
        }
        if (leftLon > rightLon) {
            double tmp = leftLon; leftLon = rightLon; rightLon = tmp;
        }

        RainViewerCatalog.Catalog cat = catalog.fetch();
        if (cat.past.isEmpty()) return List.of();
        RainViewerCatalog.Frame latest = cat.past.get(cat.past.size() - 1);

        int zoom = chooseZoom(topLat, leftLon, bottomLat, rightLon);
        int xMin = lonToTileX(leftLon, zoom);
        int xMax = lonToTileX(rightLon, zoom);
        int yMin = latToTileY(topLat, zoom);
        int yMax = latToTileY(bottomLat, zoom);

        int tiles = (xMax - xMin + 1) * (yMax - yMin + 1);
        if (tiles > MAX_TILES) {
            while (tiles > MAX_TILES && zoom > 3) {
                zoom--;
                xMin = lonToTileX(leftLon, zoom);
                xMax = lonToTileX(rightLon, zoom);
                yMin = latToTileY(topLat, zoom);
                yMax = latToTileY(bottomLat, zoom);
                tiles = (xMax - xMin + 1) * (yMax - yMin + 1);
            }
        }

        int totalWidth = (xMax - xMin + 1) * TILE_SIZE;
        int totalHeight = (yMax - yMin + 1) * TILE_SIZE;
        boolean[][] mask = new boolean[totalHeight][totalWidth];

        for (int xt = xMin; xt <= xMax; xt++) {
            for (int yt = yMin; yt <= yMax; yt++) {
                String url = catalog.buildTileUrl(
                        cat.host, latest, zoom, xt, yt,
                        TILE_SIZE, COLOR_SCHEME, SMOOTH, SNOW, EXT
                );
                BufferedImage img = downloadTile(url);
                if (img == null) continue;
                int offsetX = (xt - xMin) * TILE_SIZE;
                int offsetY = (yt - yMin) * TILE_SIZE;

                for (int py = 0; py < TILE_SIZE; py++) {
                    for (int px = 0; px < TILE_SIZE; px++) {
                        int argb = img.getRGB(px, py);
                        int alpha = (argb >> 24) & 0xFF;
                        if (alpha == 0) continue;
                        mask[offsetY + py][offsetX + px] = true;
                    }
                }
            }
        }

        List<List<List<Double>>> polygons = maskToMergedPolygons(mask, zoom, xMin, yMin);
        return polygons;
    }

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

    // ----- Nouvelle extraction de contours -----

    private static final class Edge {
        int x1,y1,x2,y2;
        boolean used;
        Edge(int x1,int y1,int x2,int y2){this.x1=x1;this.y1=y1;this.x2=x2;this.y2=y2;}
    }

    private List<List<List<Double>>> maskToMergedPolygons(boolean[][] mask,
                                                          int zoom,
                                                          int xTileMin,
                                                          int yTileMin) {
        int h = mask.length;
        if (h == 0) return List.of();
        int w = mask[0].length;

        // 1. Génération des arêtes frontières (chaque arête extérieure une seule fois et orientée)
        List<Edge> edges = new ArrayList<>();
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (!mask[y][x]) continue;
                // top
                if (y == 0 || !mask[y-1][x]) edges.add(new Edge(x, y, x+1, y));
                // right
                if (x == w-1 || !mask[y][x+1]) edges.add(new Edge(x+1, y, x+1, y+1));
                // bottom
                if (y == h-1 || !mask[y+1][x]) edges.add(new Edge(x+1, y+1, x, y+1));
                // left
                if (x == 0 || !mask[y][x-1]) edges.add(new Edge(x, y+1, x, y));
            }
        }
        if (edges.isEmpty()) return List.of();

        // 2. Index des arêtes par point de départ
        Map<Long, List<Edge>> startMap = new HashMap<>();
        for (Edge e : edges) {
            long key = key(e.x1, e.y1);
            startMap.computeIfAbsent(key, k -> new ArrayList<>()).add(e);
        }

        List<List<List<Double>>> polys = new ArrayList<>();

        // 3. Assemblage des arêtes en boucles
        for (Edge e : edges) {
            if (e.used) continue;
            List<int[]> ring = new ArrayList<>();
            Edge cur = e;
            ring.add(new int[]{cur.x1, cur.y1});
            while (true) {
                cur.used = true;
                ring.add(new int[]{cur.x2, cur.y2});
                if (cur.x2 == e.x1 && cur.y2 == e.y1) {
                    break; // boucle fermée
                }
                long k = key(cur.x2, cur.y2);
                List<Edge> nextList = startMap.get(k);
                Edge nextEdge = null;
                if (nextList != null) {
                    for (Edge cand : nextList) {
                        if (!cand.used) {
                            nextEdge = cand;
                            break;
                        }
                    }
                }
                if (nextEdge == null) {
                    // Rupture inattendue: abandonner ce ring
                    ring.clear();
                    break;
                }
                cur = nextEdge;
            }
            if (ring.isEmpty()) continue;

            // 4. Nettoyage: supprimer dernier point répété si égal au premier
            if (ring.size() > 1) {
                int[] first = ring.get(0);
                int[] last = ring.get(ring.size()-1);
                if (first[0] == last[0] && first[1] == last[1]) {
                    ring.remove(ring.size()-1);
                }
            }
            // 5. Simplification collinéarité
            ring = simplifyOrthogonal(ring);

            // 6. Conversion en lon/lat
            List<List<Double>> poly = new ArrayList<>(ring.size());
            for (int[] p : ring) {
                // p est un sommet sur la grille d'arêtes (pixels). Interprété directement comme pixel global
                int pxGlobal = p[0];
                int pyGlobal = p[1];
                poly.add(pixelCornerToLonLat(pxGlobal, pyGlobal, zoom, xTileMin, yTileMin));
            }
            if (poly.size() >= 3) polys.add(poly);
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
            if (dx1 == 0 && dx2 == 0) continue; // même verticale
            if (dy1 == 0 && dy2 == 0) continue; // même horizontale
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

    // (Ancien) Méthode rectangle conservée si besoin futur
    // private static class Rect { int x1,y1,x2,y2; Rect(int a,int b,int c,int d){x1=a;y1=b;x2=c;y2=d;} }

    // Utilitaires tuiles
    private int lonToTileX(double lon, int z) {
        return (int)Math.floor((lon + 180.0) / 360.0 * (1 << z));
    }
    private int latToTileY(double lat, int z) {
        double rad = Math.toRadians(lat);
        return (int)Math.floor(
                (1 - Math.log(Math.tan(rad) + 1/Math.cos(rad)) / Math.PI) / 2 * (1 << z)
        );
    }

    public static void main(String[] args) {
        RainViewerRadarPolygonService service = new RainViewerRadarPolygonService();
        try {
            double topLat = 48.9;
            double leftLon = 2.1;
            double bottomLat = 48.6;
            double rightLon = 2.55;
            List<List<List<Double>>> polys = service.fetchRainPolygons(
                    topLat, leftLon, bottomLat, rightLon
            );
            System.out.println("Polygones fusionnés: " + polys.size());
            if (!polys.isEmpty()) {
                System.out.println("Premier: " + polys.get(0));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}