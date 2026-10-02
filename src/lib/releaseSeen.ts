/**
 * releaseSeen — has this phone opened What's new since the last update?
 * Drives the dot on the profile photo and the menu item.
 */

import { CURRENT_VERSION } from '../changelog';

const KEY = 'snookerbee:last-seen-version';

export function hasUnseenRelease(): boolean {
  try {
    return localStorage.getItem(KEY) !== CURRENT_VERSION;
  } catch {
    return false;
  }
}

export function markReleaseSeen(): void {
  try {
    localStorage.setItem(KEY, CURRENT_VERSION);
  } catch {
    /* private mode: the dot just stays */
  }
}
