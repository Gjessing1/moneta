import { describe, expect, it } from 'vitest';
import { clampView, FITTED, MAX_SCALE, panBy, toggleZoom, zoomAround } from './zoom.js';

// A phone screen showing two pages stacked at the screen's width.
const VIEWPORT = { width: 400, height: 800 };
const CONTENT = { width: 400, height: 1200 };

describe('clampView', () => {
  it('keeps the pages covering the screen', () => {
    expect(clampView({ scale: 1, x: 50, y: 100 }, CONTENT, VIEWPORT)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
    expect(clampView({ scale: 1, x: 0, y: -900 }, CONTENT, VIEWPORT)).toEqual({
      scale: 1,
      x: 0,
      y: -400,
    });
  });

  it('centres content smaller than the screen', () => {
    const short = { width: 300, height: 200 };
    expect(clampView(FITTED, short, VIEWPORT)).toEqual({ scale: 1, x: 50, y: 300 });
  });

  it('never zooms out past the fitted width or in past the limit', () => {
    expect(clampView({ scale: 0.3, x: 0, y: 0 }, CONTENT, VIEWPORT).scale).toBe(1);
    expect(clampView({ scale: 40, x: 0, y: 0 }, CONTENT, VIEWPORT).scale).toBe(MAX_SCALE);
  });
});

describe('zoomAround', () => {
  it('keeps the point under the fingers in place', () => {
    const view = zoomAround(FITTED, 2, { x: 200, y: 300 }, CONTENT, VIEWPORT);
    expect(view).toEqual({ scale: 2, x: -200, y: -300 });
    // The content point (100, 150) was under (200, 300) before, and still is.
    expect(100 * view.scale + view.x).toBe(0);
    expect(200 * view.scale + view.x).toBe(200);
  });

  it('comes back to the fitted view when pinched closed', () => {
    const zoomed = zoomAround(FITTED, 3, { x: 100, y: 100 }, CONTENT, VIEWPORT);
    expect(zoomAround(zoomed, 1, { x: 300, y: 600 }, CONTENT, VIEWPORT).scale).toBe(1);
  });
});

describe('panBy', () => {
  it('scrolls through the pages but stops at the last one', () => {
    expect(panBy(FITTED, -30, -250, CONTENT, VIEWPORT)).toEqual({ scale: 1, x: 0, y: -250 });
    expect(panBy(FITTED, 0, -5000, CONTENT, VIEWPORT).y).toBe(-400);
  });
});

describe('toggleZoom', () => {
  it('zooms in on a double tap and back out on the next', () => {
    const zoomed = toggleZoom(FITTED, { x: 200, y: 400 }, CONTENT, VIEWPORT);
    expect(zoomed.scale).toBe(2.5);
    expect(toggleZoom(zoomed, { x: 200, y: 400 }, CONTENT, VIEWPORT).scale).toBe(1);
  });
});
