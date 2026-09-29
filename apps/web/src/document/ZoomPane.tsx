import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from 'react';
import {
  clampView,
  FITTED,
  panBy,
  toggleZoom,
  zoomAround,
  type Point,
  type Size,
  type ZoomView,
} from '@moneta/core/zoom';

// Pinch, drag, double tap, wheel and trackpad zoom over the pages. It takes
// every gesture itself (touch-action: none): the Android WebView has no pinch
// zoom of its own, and one model for both keeps them the same (A10).

export interface ZoomControls {
  zoomBy: (factor: number) => void;
  panBy: (dx: number, dy: number) => void;
}

// Taps closer together than this, in time and space, are a double tap.
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 30;
// A pointer that moves less than this is still a tap, not a drag.
const TAP_SLOP = 10;

interface Tap {
  at: number;
  point: Point;
}

export function ZoomPane({
  children,
  startAt,
  label,
  ref,
}: {
  children: ReactNode;
  // The data-page key of the page to open at.
  startAt: string | null;
  label: string;
  ref?: Ref<ZoomControls>;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ZoomView>(FITTED);
  const sizes = useRef<{ content: Size; viewport: Size }>({
    content: { width: 0, height: 0 },
    viewport: { width: 0, height: 0 },
  });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ start: Point; moved: boolean } | null>(null);
  const lastTap = useRef<Tap | null>(null);
  // Until the user moves the pages, keep the page they tapped at the top
  // while the rest of the pages load and change the column's height.
  const settled = useRef(false);

  const update = useCallback(function update(change: (view: ZoomView) => ZoomView) {
    setView(function next(current) {
      return change(current);
    });
  }, []);

  const showStart = useCallback(
    function showStart() {
      const content = contentRef.current;
      if (settled.current || content === null) {
        return;
      }
      let top = 0;
      if (startAt !== null) {
        const page = content.querySelector<HTMLElement>(`[data-page="${startAt}"]`);
        top = page?.offsetTop ?? 0;
      }
      const { content: contentSize, viewport } = sizes.current;
      setView(clampView({ scale: 1, x: 0, y: -top }, contentSize, viewport));
    },
    [startAt],
  );

  useLayoutEffect(
    function measure() {
      const pane = paneRef.current;
      const content = contentRef.current;
      if (pane === null || content === null) {
        return;
      }
      const observer = new ResizeObserver(function onResize() {
        // Layout sizes: the transform doesn't change them.
        sizes.current = {
          content: { width: content.offsetWidth, height: content.offsetHeight },
          viewport: { width: pane.clientWidth, height: pane.clientHeight },
        };
        if (settled.current) {
          setView(function keepInside(current) {
            return clampView(current, sizes.current.content, sizes.current.viewport);
          });
        } else {
          showStart();
        }
      });
      observer.observe(pane);
      observer.observe(content);
      return function stop() {
        observer.disconnect();
      };
    },
    [showStart],
  );

  const zoomBy = useCallback(
    function zoomBy(factor: number, focus?: Point) {
      settled.current = true;
      const { content, viewport } = sizes.current;
      const center = focus ?? { x: viewport.width / 2, y: viewport.height / 2 };
      update(function zoom(current) {
        return zoomAround(current, current.scale * factor, center, content, viewport);
      });
    },
    [update],
  );

  const pan = useCallback(
    function pan(dx: number, dy: number) {
      settled.current = true;
      const { content, viewport } = sizes.current;
      update(function move(current) {
        return panBy(current, dx, dy, content, viewport);
      });
    },
    [update],
  );

  useImperativeHandle(
    ref,
    function controls() {
      return { zoomBy, panBy: pan };
    },
    [zoomBy, pan],
  );

  // Wheel listeners must be non-passive to stop the page behind from moving,
  // which React's onWheel can't be.
  useEffect(
    function listenForWheel() {
      const pane = paneRef.current;
      if (pane === null) {
        return;
      }
      const target: HTMLElement = pane;
      function onWheel(event: WheelEvent) {
        event.preventDefault();
        // A trackpad pinch arrives as a wheel event with ctrlKey set.
        if (event.ctrlKey) {
          zoomBy(Math.exp(-event.deltaY * 0.01), localPoint(target, event));
        } else {
          pan(-event.deltaX, -event.deltaY);
        }
      }
      pane.addEventListener('wheel', onWheel, { passive: false });
      return function stop() {
        pane.removeEventListener('wheel', onWheel);
      };
    },
    [zoomBy, pan],
  );

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const pane = paneRef.current;
    if (pane === null) {
      return;
    }
    pane.setPointerCapture(event.pointerId);
    const point = localPoint(pane, event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      gesture.current = { start: point, moved: false };
    } else if (gesture.current !== null) {
      // A second finger makes it a pinch, never a tap.
      gesture.current.moved = true;
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pane = paneRef.current;
    const previous = pointers.current.get(event.pointerId);
    if (pane === null || previous === undefined) {
      return;
    }
    const point = localPoint(pane, event);
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, point);
    const after = [...pointers.current.values()];

    const current = gesture.current;
    if (current !== null && distance(current.start, point) > TAP_SLOP) {
      current.moved = true;
    }
    settled.current = true;
    const { content, viewport } = sizes.current;

    const [a0, b0] = before;
    const [a1, b1] = after;
    if (a0 && b0 && a1 && b1) {
      // Pinch: scale by the change in finger distance around their midpoint,
      // and follow the midpoint as it moves.
      const from = midpoint(a0, b0);
      const to = midpoint(a1, b1);
      const factor = distance(a1, b1) / Math.max(1, distance(a0, b0));
      update(function pinch(view) {
        const zoomed = zoomAround(view, view.scale * factor, from, content, viewport);
        return panBy(zoomed, to.x - from.x, to.y - from.y, content, viewport);
      });
    } else {
      update(function drag(view) {
        return panBy(view, point.x - previous.x, point.y - previous.y, content, viewport);
      });
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const pane = paneRef.current;
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (pointers.current.size > 0 || pane === null || current === null) {
      return;
    }
    gesture.current = null;
    if (current.moved || event.type === 'pointercancel') {
      return;
    }
    const point = localPoint(pane, event);
    const now = event.timeStamp;
    const previous = lastTap.current;
    if (
      previous !== null &&
      now - previous.at < DOUBLE_TAP_MS &&
      distance(previous.point, point) < DOUBLE_TAP_SLOP
    ) {
      lastTap.current = null;
      settled.current = true;
      const { content, viewport } = sizes.current;
      update(function toggle(view) {
        return toggleZoom(view, point, content, viewport);
      });
    } else {
      lastTap.current = { at: now, point };
    }
  }

  return (
    <div
      ref={paneRef}
      className="zoom"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={contentRef}
        className="zoom__content"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

function localPoint(element: HTMLElement, event: { clientX: number; clientY: number }): Point {
  const box = element.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
