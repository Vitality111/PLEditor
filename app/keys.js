// Keyboard hints in the words of the user's computer: ⌘ ⌥ ⇧ on a Mac, Ctrl / Alt / Shift elsewhere.
const platform = (typeof navigator !== 'undefined' && (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent)) || '';
export const isMac = /mac|iphone|ipad|ipod/i.test(platform);
const NAMES = isMac ? { mod: '⌘', alt: '⌥', shift: '⇧' } : { mod: 'Ctrl', alt: 'Alt', shift: 'Shift' };
// combo('mod', 'B') → «⌘B» on a Mac, «Ctrl+B» elsewhere.
export const combo = (...keys) => keys.map(k => NAMES[k] || k).join(isMac ? '' : '+');
// The Option key named in a sentence: «⌥ Option» on a Mac, «Alt» elsewhere.
export const altKey = isMac ? '⌥ Option' : 'Alt';
