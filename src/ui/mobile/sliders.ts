/** Taille du pinceau sur une échelle logarithmique (1 à 300 px) : plus de précision pour les petites tailles. */
const MAX_SIZE = 300;
export const sizeToPos = (v: number) => Math.log(Math.max(1, v)) / Math.log(MAX_SIZE);
export const posToSize = (p: number) => Math.round(Math.exp(p * Math.log(MAX_SIZE)) * 10) / 10;
export const formatSize = (v: number) => v.toFixed(1);
export const CHECKER = 'repeating-conic-gradient(#d0d0d0 0% 25%, #ffffff 0% 50%) 0 0 / 10px 10px';
