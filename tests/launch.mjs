import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

// Chrome for browser tests: CHROME_PATH → installed Chrome on Windows/macOS → Playwright's own Chromium.
const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

export function chromePath() {
  return candidates.find(p => existsSync(p));
}

export function launchBrowser(options = {}) {
  const executablePath = chromePath();
  return chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), ...options });
}

// Folder with the original playables (used only by the import test).
export const playableAdsRoot = process.env.PLAYABLE_ADS_ROOT || '../PlayableAds';
