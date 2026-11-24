/** Une action annulable. */
export interface Command {
  readonly label: string;
  /** Mémoire approximative occupée (octets), pour limiter l'historique. */
  readonly bytes: number;
  undo(): void;
  redo(): void;
  /** Fusionne `next` dans cette commande (ex. glisser un curseur d'opacité). */
  merge?(next: Command): boolean;
  /** Calques et zones de pixels modifiés (pour la synchronisation en réseau). */
  affected?(): { layer: import('./layers').Layer; rect: import('./geometry').Rect }[];
}

export interface HistoryOptions {
  maxBytes: number;
  maxSteps: number;
}

export class History {
  private done: Command[] = [];
  private undone: Command[] = [];
  /** Augmente à chaque changement (sert à la sauvegarde automatique). */
  version = 0;
  /** Appelé après chaque action enregistrée, annulée ou rétablie. */
  onApply: ((cmd: Command) => void) | null = null;

  constructor(private readonly options: HistoryOptions) {}

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  get size(): number {
    return this.done.length;
  }

  get usedBytes(): number {
    let n = 0;
    for (const c of this.done) n += c.bytes;
    for (const c of this.undone) n += c.bytes;
    return n;
  }

  /** Enregistre une commande déjà exécutée. */
  push(cmd: Command): void {
    this.version++;
    this.undone = [];
    const top = this.done[this.done.length - 1];
    if (top?.merge?.(cmd)) {
      this.onApply?.(cmd);
      return;
    }
    this.done.push(cmd);
    this.trim();
    this.onApply?.(cmd);
  }

  undo(): boolean {
    const cmd = this.done.pop();
    if (!cmd) return false;
    cmd.undo();
    this.undone.push(cmd);
    this.version++;
    this.onApply?.(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.undone.pop();
    if (!cmd) return false;
    cmd.redo();
    this.done.push(cmd);
    this.version++;
    this.onApply?.(cmd);
    return true;
  }

  clear(): void {
    this.done = [];
    this.undone = [];
  }

  /** Oublie les plus anciennes actions au-delà des limites (garde toujours la dernière). */
  private trim(): void {
    let bytes = this.usedBytes;
    while (this.done.length > 1 && (bytes > this.options.maxBytes || this.done.length > this.options.maxSteps)) {
      bytes -= this.done.shift()!.bytes;
    }
  }
}
