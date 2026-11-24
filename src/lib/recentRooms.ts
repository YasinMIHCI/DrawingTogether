import { load, save } from './storage';

export interface RecentRoom {
  code: string;
  at: number;
  width: number;
  height: number;
}

const KEY = 'dt.recentRooms';

export function recentRooms(): RecentRoom[] {
  return load<{ list: RecentRoom[] }>(KEY, { list: [] }).list;
}

export function rememberRoom(r: RecentRoom): void {
  const list = [r, ...recentRooms().filter((x) => x.code !== r.code)].slice(0, 8);
  save(KEY, { list });
}

export function forgetRoom(code: string): void {
  save(KEY, { list: recentRooms().filter((x) => x.code !== code) });
}
