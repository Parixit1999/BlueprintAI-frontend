# Drawing viewer + evidence highlight

`src/components/DrawingViewer.jsx`. Renders a drawing page and overlays a
highlight box for a given region.

- Fetches `GET /files/:id/render?page=N` → `{url, extents}` where `extents` is
  the model-space `[xmin, ymin, xmax, ymax]` the PNG covers. Renders cached
  per `fileId:page`.
- `highlightBbox` (a region's model-space bbox) is mapped to CSS percentages of
  the image. **Y is flipped** — drawings are y-up (origin bottom-left), images
  are y-down — so `top = (ymax - y2) / (ymax - ymin)`.
- Used in three places: DocumentDetail (click a region), Chat evidence panel
  (click a source), and it works for DXF, PDF (rasterized page), and images.
