import type { Point } from './geometry';
import type { InputPoint } from './brush/sampler';
import { ViewTransform } from './view';

export interface InputHandlers {
  view: ViewTransform;
  viewChanged(): void;
  /**
   * Coordonnées écran (px CSS, relatives à l'élément). Renvoie true si l'outil veut suivre
   * le glissement (strokeMove / strokeEnd), false pour un outil à un seul clic ou un refus.
   */
  strokeStart(p: InputPoint, pointerType: string): boolean;
  strokeMove(points: InputPoint[]): void;
  strokeEnd(): void;
  strokeCancel(): void;
  hover(p: Point | null): void;
  undo(): void;
  redo(): void;
  /** Touches propres à l'outil (Entrée, Échap…). Renvoie true si la touche est utilisée. */
  key(e: KeyboardEvent): boolean;
}

type Mode = 'idle' | 'stroke' | 'pan' | 'rotate' | 'gesture' | 'wait';

/** Une pression trop courte au 2e doigt : c'était un geste, on annule le trait commencé. */
const GESTURE_GRACE_MS = 250;

function pressureOf(e: PointerEvent): number {
  if (e.pointerType === 'pen') return e.pressure;
  if (e.pointerType === 'touch') return e.pressure > 0 && e.pressure < 1 ? e.pressure : 1;
  return 1;
}

const NON_TEXT_INPUTS = new Set(['range', 'color', 'checkbox', 'radio', 'button', 'submit', 'reset']);

/** Champ où le clavier sert à écrire : les raccourcis ne doivent pas s'y déclencher. */
function isTextField(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  return t instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(t.type);
}

/**
 * Souris : clic gauche = dessin, molette = défilement, Ctrl+molette = zoom,
 * clic milieu ou Espace+glisser = déplacer, Maj+Espace+glisser = pivoter.
 * Tactile : 1 doigt = dessin, 2 doigts = déplacer / zoomer / pivoter.
 * Stylet : prioritaire, les doigts sont ignorés pendant qu'il dessine.
 */
export function attachInput(el: HTMLElement, h: InputHandlers): () => void {
  const pointers = new Map<number, { p: Point; type: string }>();
  let mode: Mode = 'idle';
  let strokeId = -1;
  let strokeType = '';
  let strokeStartTime = 0;
  let last: Point = { x: 0, y: 0 };
  let space = false;
  let gesture: { start: ViewTransform; ids: [number, number]; s0: Point; s1: Point } | null = null;
  let rect = el.getBoundingClientRect();

  const local = (e: { clientX: number; clientY: number }): Point => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  const updateCursor = () => {
    el.style.cursor = mode === 'pan' || mode === 'rotate' ? 'grabbing' : space ? 'grab' : 'crosshair';
  };

  function startGesture(): void {
    const [a, b] = [...pointers.entries()].filter(([, v]) => v.type === 'touch');
    if (!a || !b) return;
    gesture = { start: h.view.clone(), ids: [a[0], b[0]], s0: a[1].p, s1: b[1].p };
    mode = 'gesture';
  }

  function onDown(e: PointerEvent): void {
    rect = el.getBoundingClientRect();
    const p = local(e);
    pointers.set(e.pointerId, { p, type: e.pointerType });
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();

    if (e.pointerType === 'touch') {
      if (mode === 'stroke' && strokeType === 'pen') return; // paume pendant le stylet
      const touches = [...pointers.values()].filter((v) => v.type === 'touch').length;
      if (touches === 2) {
        if (mode === 'stroke') {
          if (performance.now() - strokeStartTime < GESTURE_GRACE_MS) h.strokeCancel();
          else h.strokeEnd();
        }
        startGesture();
        return;
      }
      if (touches > 2 || mode !== 'idle') return;
    } else if (e.pointerType === 'pen' && mode === 'stroke' && strokeType === 'touch') {
      h.strokeCancel();
      mode = 'idle';
    }
    if (mode !== 'idle') return;

    if (e.pointerType === 'mouse' && (e.button === 1 || (e.button === 0 && space))) {
      mode = e.button === 0 && e.shiftKey ? 'rotate' : 'pan';
      last = p;
      updateCursor();
      return;
    }
    if (e.button !== 0) return;
    if (h.strokeStart({ ...p, pressure: pressureOf(e), shift: e.shiftKey, alt: e.altKey }, e.pointerType)) {
      mode = 'stroke';
      strokeId = e.pointerId;
      strokeType = e.pointerType;
      strokeStartTime = performance.now();
    } else {
      mode = 'wait';
    }
  }

  function onMove(e: PointerEvent): void {
    const p = local(e);
    if (e.pointerType !== 'touch') h.hover(mode === 'idle' || mode === 'stroke' ? p : null);
    const ptr = pointers.get(e.pointerId);
    if (!ptr) return;
    ptr.p = p;

    if (mode === 'stroke' && e.pointerId === strokeId) {
      const events = e.getCoalescedEvents?.() ?? [];
      const list = events.length ? events : [e];
      h.strokeMove(list.map((ev) => ({ ...local(ev), pressure: pressureOf(ev), shift: e.shiftKey, alt: e.altKey })));
    } else if (mode === 'pan') {
      h.view.panBy(p.x - last.x, p.y - last.y);
      last = p;
      h.viewChanged();
    } else if (mode === 'rotate') {
      const c = { x: rect.width / 2, y: rect.height / 2 };
      const delta = Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(last.y - c.y, last.x - c.x);
      h.view.rotateAt(delta, c);
      last = p;
      h.viewChanged();
    } else if (mode === 'gesture' && gesture) {
      const a = pointers.get(gesture.ids[0]);
      const b = pointers.get(gesture.ids[1]);
      if (a && b) {
        h.view.applyGesture(gesture.start, gesture.s0, gesture.s1, a.p, b.p);
        h.viewChanged();
      }
    }
  }

  function onUp(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode === 'stroke' && e.pointerId === strokeId) {
      if (e.type === 'pointercancel') h.strokeCancel();
      else h.strokeEnd();
      mode = 'idle';
    } else if (mode === 'pan' || mode === 'rotate') {
      mode = 'idle';
    } else if (mode === 'gesture') {
      gesture = null;
      mode = 'wait';
    }
    // Après un geste, on attend que tous les doigts soient levés avant de redessiner.
    if (pointers.size === 0) mode = 'idle';
    updateCursor();
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    rect = el.getBoundingClientRect();
    const p = local(e);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
    if (e.ctrlKey || e.metaKey) {
      h.view.zoomAt(Math.exp((-e.deltaY * unit) / 300), p);
    } else if (e.shiftKey && !e.deltaX) {
      h.view.panBy(-e.deltaY * unit, 0);
    } else {
      h.view.panBy(-e.deltaX * unit, -e.deltaY * unit);
    }
    h.viewChanged();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (isTextField(e.target)) return;
    if (h.key(e)) {
      e.preventDefault();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!space) {
        space = true;
        updateCursor();
      }
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) h.redo();
      else h.undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      h.redo();
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      space = false;
      updateCursor();
    }
  }

  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') h.hover(null);
  };
  const prevent = (e: Event) => e.preventDefault();
  // iOS Safari : empêche le zoom de la page par pincement
  const opts = { passive: false } as const;

  el.addEventListener('pointerdown', onDown, opts);
  el.addEventListener('pointermove', onMove, opts);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('wheel', onWheel, opts);
  el.addEventListener('contextmenu', prevent);
  el.addEventListener('gesturestart', prevent, opts);
  el.addEventListener('touchstart', prevent, opts);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  updateCursor();

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('contextmenu', prevent);
    el.removeEventListener('gesturestart', prevent);
    el.removeEventListener('touchstart', prevent);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
