import { describe, expect, it } from 'vitest';
import { isTouchDevice, resolveUi } from '../src/lib/device';

const phone = { coarse: true, width: 412, height: 915 };
const tablet = { coarse: true, width: 820, height: 1180 };
const laptop = { coarse: false, width: 1440, height: 900 };
const touchMonitor = { coarse: true, width: 1920, height: 1080 };

describe('device', () => {
  it('detects touch devices', () => {
    expect(isTouchDevice(phone)).toBe(true);
    expect(isTouchDevice(tablet)).toBe(true);
    expect(isTouchDevice(laptop)).toBe(false);
    expect(isTouchDevice(touchMonitor)).toBe(false);
  });
  it('defaults to Krita on desktop and mobile on touch', () => {
    expect(resolveUi('auto', laptop)).toBe('krita');
    expect(resolveUi('auto', phone)).toBe('mobile');
  });
  it('honours the user choice', () => {
    expect(resolveUi('paint', phone)).toBe('paint');
    expect(resolveUi('mobile', laptop)).toBe('mobile');
  });
});
