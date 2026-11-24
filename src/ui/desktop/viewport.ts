export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Signale à la page la zone libre pour la toile (entre les panneaux). */
export function viewport(node: HTMLElement, report: (r: Insets | null) => void) {
  // Mesure par rapport au conteneur de l'éditeur (plein écran, ou sous l'en-tête d'un jeu)
  const update = () => {
    const r = node.getBoundingClientRect();
    const root = (node.closest('.editor-root') as HTMLElement | null)?.getBoundingClientRect() ?? {
      top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight,
    };
    report({ top: r.top - root.top, left: r.left - root.left, right: root.right - r.right, bottom: root.bottom - r.bottom });
  };
  const ro = new ResizeObserver(update);
  ro.observe(node);
  window.addEventListener('resize', update);
  update();
  return {
    destroy() {
      ro.disconnect();
      window.removeEventListener('resize', update);
      report(null);
    },
  };
}
