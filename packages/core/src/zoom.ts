// Pan and pinch zoom for the full-screen original. The view is a translation
// and a scale applied to the pages (transform-origin at the top left); these
// functions keep the pages covering the screen so they can't be flung away.
// Written by hand because the Android WebView has no browser pinch zoom (A10).

export interface ZoomView {
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
// What a double tap zooms to from the fitted view.
export const TAP_SCALE = 2.5;

export const FITTED: ZoomView = { scale: 1, x: 0, y: 0 };

// Content smaller than the viewport is centred on that axis; larger content
// may move only until its edge meets the viewport's edge.
export function clampView(view: ZoomView, content: Size, viewport: Size): ZoomView {
  const scale = clampScale(view.scale);
  return {
    scale,
    x: clampAxis(view.x, content.width * scale, viewport.width),
    y: clampAxis(view.y, content.height * scale, viewport.height),
  };
}

// Scales so the content point under `focus` (a viewport point: the fingers'
// midpoint or the cursor) stays under it.
export function zoomAround(
  view: ZoomView,
  scale: number,
  focus: Point,
  content: Size,
  viewport: Size,
): ZoomView {
  const next = clampScale(scale);
  const ratio = next / view.scale;
  return clampView(
    {
      scale: next,
      x: focus.x - (focus.x - view.x) * ratio,
      y: focus.y - (focus.y - view.y) * ratio,
    },
    content,
    viewport,
  );
}

export function panBy(
  view: ZoomView,
  dx: number,
  dy: number,
  content: Size,
  viewport: Size,
): ZoomView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, content, viewport);
}

// A double tap zooms in on the tapped spot, or back out to the fitted width.
export function toggleZoom(view: ZoomView, focus: Point, content: Size, viewport: Size): ZoomView {
  if (view.scale > MIN_SCALE + 0.01) {
    return zoomAround(view, MIN_SCALE, focus, content, viewport);
  }
  return zoomAround(view, TAP_SCALE, focus, content, viewport);
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function clampAxis(offset: number, scaled: number, available: number): number {
  if (scaled <= available) {
    return (available - scaled) / 2;
  }
  return Math.min(0, Math.max(available - scaled, offset));
}
