// Currency, numbers and region detection.

import { REGIONS } from '../data/catalog.js';

/** Guess the player's region from the browser: South African browsers get Rand and load-shedding. */
export function detectRegion() {
  const langs = navigator.languages || [navigator.language || 'en-US'];
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
  if (tz === 'Africa/Johannesburg' || langs.some((l) => /-ZA$/i.test(l))) return 'za';
  if (langs.some((l) => /-GB$/i.test(l)) || tz === 'Europe/London') return 'gb';
  if (langs.some((l) => /-AU$/i.test(l)) || tz.startsWith('Australia/')) return 'au';
  if (tz.startsWith('Europe/')) return 'eu';
  return 'us';
}

/** Live USD exchange rate for the region's currency. Falls back to the built-in rate offline. */
export async function fetchFx(currency) {
  if (currency === 'USD') return 1;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctl.signal });
    clearTimeout(timer);
    const data = await res.json();
    const rate = data?.rates?.[currency];
    return rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export function makeMoney(state) {
  const reg = REGIONS.find((r) => r.id === state.region);
  const fmt = (digits) => new Intl.NumberFormat(reg.locale, { style: 'currency', currency: reg.currency, maximumFractionDigits: digits, minimumFractionDigits: digits });
  const whole = fmt(0); const cents = fmt(2);
  return (usd, { precise = false } = {}) => {
    const local = usd * state.fx;
    return (precise || Math.abs(local) < 100 ? cents : whole).format(local);
  };
}

export function num(n, digits = 1) {
  if (!Number.isFinite(n)) return '–';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(digits)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function hashrate(value, unit) {
  return `${num(value, value < 10 ? 2 : 1)} ${unit}`;
}

export function kw(watts) {
  return watts >= 1000 ? `${(watts / 1000).toFixed(watts >= 10000 ? 0 : 1)} kW` : `${Math.round(watts)} W`;
}

export function gameDate(day) {
  const start = new Date(2026, 0, 1);
  const d = new Date(start.getTime() + Math.floor(day) * 86400000);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
