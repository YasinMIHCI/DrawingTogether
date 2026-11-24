export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Signale à la page la zone libre pour la toile (entre les panneaux). */
export function viewport(node: HTMLElement, report: (r: Insets | null) => void) {
  const update = () => {
    const r = node.getBoundingClientRect();
    report({ top: r.top, left: r.left, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom });
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
