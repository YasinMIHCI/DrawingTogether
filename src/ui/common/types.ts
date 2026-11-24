/** Actions sur les fichiers, fournies par la page de dessin. */
export interface FileActions {
  newDoc(): void;
  open(): void;
  save(): void;
  importImage(): void;
  exportImage(type: 'png' | 'jpeg'): void;
  /** Publier le dessin dans le fil / un salon / une discussion (dessin libre seulement). */
  share?(): void;
  /** Actions indisponibles ici (ex. dans une toile partagée : nouveau dessin, ouvrir un projet). */
  disabled?: ('newDoc' | 'open' | 'importImage' | 'save')[];
}
