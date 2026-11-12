// Top-down 2D floor plan: the main management view.

import { byId } from '../data/catalog.js';
import { QUALITY } from '../data/progression.js';

const COLORS = {
  mining: '#5ee7ff', off: '#3a4558', broken: '#f87171', empty: '#16213a', warn: '#fbbf24', golden: '#ffd166',
};

export class FloorPlan {
  constructor(canvas, { onSelect } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.hits = [];
    this.selected = null;
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (canvas.width / r.width);
      const y = (e.clientY - r.top) * (canvas.height / r.height);
      const hit = this.hits.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
      if (hit && this.onSelect) this.onSelect(hit.pick);
    });
  }

  draw(state, room, time) {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(c.clientWidth * dpr); const H = Math.round(c.clientHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = this.ctx;
    // Scale tiles with the screen so small rooms don't look empty on big monitors.
    const s = dpr * Math.min(1.7, Math.max(0.8, c.clientWidth / 820));
    this.hits = [];
    ctx.clearRect(0, 0, W, H);

    // Floor
    const pad = 18 * s;
    const fx = pad; const fy = pad; const fw = W - pad * 2; const fh = H - pad * 2;
    const dark = room.offline;
    ctx.fillStyle = dark ? '#0a0b10' : '#0d1526';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = '#1b2a45'; ctx.lineWidth = 1;
    const step = 32 * s;
    ctx.beginPath();
    for (let x = fx; x <= fx + fw; x += step) { ctx.moveTo(x, fy); ctx.lineTo(x, fy + fh); }
    for (let y = fy; y <= fy + fh; y += step) { ctx.moveTo(fx, y); ctx.lineTo(fx + fw, y); }
    ctx.stroke();
    ctx.strokeStyle = '#3a5276'; ctx.lineWidth = 3 * s;
    ctx.strokeRect(fx, fy, fw, fh);

    // Heat haze: stronger and redder as the room heats up
    const heat = Math.min(1, Math.max(0, (room.roomTemp - 22) / 30));
    if (room.minerWatts > 0) {
      const g = ctx.createRadialGradient(fx + fw * 0.5, fy + fh * 0.45, 10, fx + fw * 0.5, fy + fh * 0.45, Math.max(fw, fh) * 0.6);
      g.addColorStop(0, `rgba(${Math.round(80 + 175 * heat)},${Math.round(160 - 120 * heat)},${Math.round(255 - 215 * heat)},${0.08 + 0.18 * heat})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fx, fy, fw, fh);
    }

    const zoneRight = fx + fw * 0.80;
    const zoneLeft = fx + fw * 0.17;

    // ---- Rigs (centre area)
    let x = zoneLeft + 14 * s; let y = fy + 16 * s;
    const rowH = 118 * s;
    state.rigs.forEach((rig, i) => {
      const frame = byId[rig.frameId];
      const st = room.rigs[i];
      const slotW = 15 * s;
      const w = frame.slots * (slotW + 4 * s) + 54 * s;
      if (x + w > zoneRight - 10 * s) { x = zoneLeft + 14 * s; y += rowH; }
      const h = 96 * s;
      const sel = this.selected === rig.uid;
      this.panel(x, y, w, h, sel, st.running ? '#13284a' : '#1a1d27');
      ctx.fillStyle = '#e6edf7'; ctx.font = `700 ${12 * s}px Inter, system-ui`;
      ctx.fillText(rig.name, x + 8 * s, y + 16 * s);
      ctx.fillStyle = st.running ? COLORS.mining : st.status === 'off' ? '#8fa3c4' : COLORS.broken;
      ctx.font = `${10 * s}px Inter, system-ui`;
      ctx.fillText(st.running ? `${st.algo.toUpperCase()}` : st.status.replace('-', ' ').toUpperCase(), x + 8 * s, y + 30 * s);
      // GPU slots with spinning fan dots
      for (let k = 0; k < frame.slots; k++) {
        const gx = x + 8 * s + k * (slotW + 4 * s); const gy = y + 38 * s;
        const gpu = rig.gpus[k];
        let color = COLORS.empty;
        if (gpu) color = gpu.broken ? COLORS.broken : !st.running ? COLORS.off : gpu.q === 'golden' ? COLORS.golden : COLORS.mining;
        ctx.fillStyle = color;
        roundRect(ctx, gx, gy, slotW, 48 * s, 3 * s); ctx.fill();
        if (gpu && st.running && !gpu.broken && !dark) {
          const a = time * 14 + k;
          ctx.fillStyle = '#031018';
          for (let f = 0; f < 2; f++) {
            const cy = gy + 14 * s + f * 20 * s;
            ctx.beginPath(); ctx.arc(gx + slotW / 2 + Math.cos(a) * 3 * s, cy + Math.sin(a) * 3 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
          }
        }
        if (gpu) {
          ctx.fillStyle = QUALITY[gpu.q].color;
          ctx.fillRect(gx, gy + 50 * s, slotW, 3 * s);
        }
      }
      // PSU load gauge
      const px = x + w - 38 * s;
      ctx.fillStyle = '#0a1222'; roundRect(ctx, px, y + 38 * s, 28 * s, 48 * s, 4 * s); ctx.fill();
      const load = Math.min(1.2, st.psuLoadPct);
      ctx.fillStyle = load > 1 ? COLORS.broken : load > 0.85 ? COLORS.warn : '#34d399';
      const lh = 44 * s * Math.min(1, load);
      ctx.fillRect(px + 3 * s, y + 84 * s - lh, 22 * s, lh);
      ctx.fillStyle = '#8fa3c4'; ctx.font = `${9 * s}px Inter, system-ui`;
      ctx.fillText('PSU', px + 5 * s, y + 34 * s);
      this.hits.push({ x, y, w, h, pick: { type: 'rig', uid: rig.uid } });
      x += w + 12 * s;
    });
    // Empty rig slots
    const loc = room.location;
    for (let k = state.rigs.length; k < loc.rigSlots && k < state.rigs.length + 1; k++) {
      const w = 140 * s;
      if (x + w > zoneRight - 10 * s) { x = zoneLeft + 14 * s; y += rowH; }
      ctx.setLineDash([6 * s, 5 * s]); ctx.strokeStyle = '#2b3d60'; ctx.lineWidth = 1.5 * s;
      roundRect(ctx, x, y, w, 96 * s, 10 * s); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#4c638a'; ctx.font = `${11 * s}px Inter, system-ui`;
      ctx.fillText(`+ Rig space (${state.rigs.length}/${loc.rigSlots})`, x + 12 * s, y + 52 * s);
      this.hits.push({ x, y, w, h: 96 * s, pick: { type: 'shop', tab: 'frame' } });
    }

    // ---- Racks (left wall)
    let ry = fy + 16 * s;
    state.racks.forEach((rack, i) => {
      const spec = byId[rack.id];
      const st = room.racks[i];
      const w = zoneLeft - fx - 22 * s; const unitH = 22 * s;
      const h = spec.units * (unitH + 4 * s) + 30 * s;
      this.panel(fx + 10 * s, ry, w, h, this.selected === rack.uid, st.overloaded ? '#3a1515' : '#121a2c');
      ctx.fillStyle = '#e6edf7'; ctx.font = `700 ${11 * s}px Inter, system-ui`;
      ctx.fillText(`Rack ${i + 1}`, fx + 18 * s, ry + 16 * s);
      for (let u = 0; u < spec.units; u++) {
        const a = rack.asics[u]; const m = st.miners[u];
        const uy = ry + 24 * s + u * (unitH + 4 * s);
        ctx.fillStyle = !a ? COLORS.empty : a.broken ? COLORS.broken : m.running && !dark ? (a.q === 'golden' ? COLORS.golden : '#9fb4d8') : COLORS.off;
        roundRect(ctx, fx + 18 * s, uy, w - 16 * s, unitH, 3 * s); ctx.fill();
        if (a) {
          ctx.fillStyle = '#081020'; ctx.font = `600 ${9.5 * s}px Inter, system-ui`;
          ctx.fillText(byId[a.id].name.replace(/^(Antminer|Whatsminer|AvalonMiner|IceRiver|Jasminer) /, ''), fx + 24 * s, uy + 15 * s);
          if (m.running && !dark && Math.sin(time * 9 + u) > 0) { ctx.fillStyle = '#33ff88'; ctx.fillRect(fx + w - 8 * s, uy + 8 * s, 4 * s, 4 * s); }
        }
      }
      this.hits.push({ x: fx + 10 * s, y: ry, w, h, pick: { type: 'rack', uid: rack.uid } });
      ry += h + 10 * s;
    });
    if (state.racks.length < loc.rackSlots) {
      const w = zoneLeft - fx - 22 * s;
      ctx.setLineDash([6 * s, 5 * s]); ctx.strokeStyle = '#2b3d60';
      roundRect(ctx, fx + 10 * s, ry, w, 50 * s, 8 * s); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#4c638a'; ctx.font = `${10 * s}px Inter, system-ui`;
      ctx.fillText('+ Rack space', fx + 18 * s, ry + 30 * s);
      this.hits.push({ x: fx + 10 * s, y: ry, w, h: 50 * s, pick: { type: 'shop', tab: 'rack' } });
    }

    // ---- Cooling (right wall)
    let cy = fy + 16 * s;
    const cx = zoneRight + 10 * s; const cw = fx + fw - cx - 10 * s;
    state.cooling.forEach((c) => {
      const spec = byId[c.id];
      this.panel(cx, cy, cw, 44 * s, false, '#10203a');
      const ac = ['ac', 'crac'].includes(spec.style);
      ctx.fillStyle = ac ? '#7dd3fc' : '#9fb4d8';
      ctx.save(); ctx.translate(cx + 22 * s, cy + 22 * s);
      if (!dark && room.minerWatts) ctx.rotate(time * (ac ? 3 : 8));
      for (let b = 0; b < 4; b++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-1.5 * s, 0, 3 * s, 12 * s); }
      ctx.restore();
      ctx.fillStyle = '#e6edf7'; ctx.font = `600 ${10 * s}px Inter, system-ui`;
      wrapText(ctx, spec.name, cx + 40 * s, cy + 18 * s, cw - 46 * s, 12 * s);
      this.hits.push({ x: cx, y: cy, w: cw, h: 44 * s, pick: { type: 'cooling', uid: c.uid } });
      cy += 52 * s;
    });

    // ---- Energy corner (bottom right)
    const e = state.energy;
    const ex = cx; let ey = fy + fh - 16 * s;
    const items = [];
    if (e.inverters.length) items.push(['Inverter', `${e.inverters.reduce((t, i) => t + byId[i.id].kw, 0)} kW`, '#33ff88']);
    if (e.batteries.length) {
      const cap = e.batteries.reduce((t, b) => t + byId[b.id].kwh * (1 - (b.wear || 0)), 0);
      const soc = e.batteries.reduce((t, b) => t + (b.soc || 0), 0);
      items.push(['Battery', `${Math.round((soc / cap) * 100)}%`, soc / cap < 0.2 ? '#f87171' : '#34d399', soc / cap]);
    }
    if (e.solar.length) items.push(['Solar', `${e.solar.reduce((t, p) => t + byId[p.id].kwp, 0)} kWp`, '#fbbf24']);
    if (e.generators.length) items.push(['Generator', '20 kW', '#a3e635']);
    items.reverse().forEach(([name, value, color, frac]) => {
      ey -= 40 * s;
      this.panel(ex, ey, cw, 34 * s, false, '#0f1a2c');
      ctx.fillStyle = color; ctx.font = `700 ${10 * s}px Inter, system-ui`;
      ctx.fillText(name, ex + 8 * s, ey + 14 * s);
      ctx.fillStyle = '#e6edf7'; ctx.fillText(value, ex + 8 * s, ey + 27 * s);
      if (frac !== undefined) {
        ctx.fillStyle = '#0a1222'; ctx.fillRect(ex + cw - 50 * s, ey + 10 * s, 40 * s, 14 * s);
        ctx.fillStyle = color; ctx.fillRect(ex + cw - 49 * s, ey + 11 * s, 38 * s * Math.min(1, frac), 12 * s);
      }
      this.hits.push({ x: ex, y: ey, w: cw, h: 34 * s, pick: { type: 'power' } });
    });

    // ---- IT corner: PCs, NAS boxes and servers along the bottom of the centre area
    const servers = state.servers || [];
    const sh = 54 * s; const sw = 92 * s;
    let sx = zoneLeft + 14 * s; const sy = fy + fh - sh - 26 * s;
    if (servers.length || loc.serverSlots) {
      ctx.fillStyle = '#4c638a'; ctx.font = `700 ${10 * s}px Inter, system-ui`;
      ctx.fillText(`IT CORNER ${servers.length}/${loc.serverSlots}`, sx, sy - 6 * s);
    }
    servers.forEach((m, i) => {
      if (sx + sw > zoneRight - 6 * s) return;
      const st = room.servers?.[i];
      const up = st?.running && !(dark && !state.hostingUp);
      const sel = this.selected === m.uid;
      this.panel(sx, sy, sw, sh, sel, up ? '#112a2a' : '#1a1d27');
      ctx.fillStyle = '#e6edf7'; ctx.font = `700 ${10 * s}px Inter, system-ui`;
      ctx.fillText(m.name, sx + 8 * s, sy + 15 * s);
      ctx.fillStyle = up ? (st.status === 'degraded' ? COLORS.warn : '#34d399') : st?.status === 'off' ? '#8fa3c4' : COLORS.broken;
      ctx.font = `${9 * s}px Inter, system-ui`;
      ctx.fillText(up ? `${st.clients.length} client${st.clients.length === 1 ? '' : 's'}` : st?.status === 'off' ? 'off' : 'needs attention', sx + 8 * s, sy + 29 * s);
      // blinking activity LEDs
      for (let k = 0; k < Math.min(6, m.drives.length || 1); k++) {
        const on = up && Math.sin(time * (4 + k) + i) > 0;
        ctx.fillStyle = m.drives[k]?.broken ? COLORS.broken : on ? '#34d399' : '#1f3b35';
        ctx.fillRect(sx + 8 * s + k * 9 * s, sy + 38 * s, 6 * s, 6 * s);
      }
      this.hits.push({ x: sx, y: sy, w: sw, h: sh, pick: { type: 'server', uid: m.uid } });
      sx += sw + 8 * s;
    });
    if (servers.length < loc.serverSlots && sx + sw <= zoneRight - 6 * s) {
      ctx.setLineDash([6 * s, 5 * s]); ctx.strokeStyle = '#2b3d60';
      roundRect(ctx, sx, sy, sw, sh, 8 * s); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#4c638a'; ctx.font = `${10 * s}px Inter, system-ui`;
      ctx.fillText('+ Server / PC', sx + 10 * s, sy + 31 * s);
      this.hits.push({ x: sx, y: sy, w: sw, h: sh, pick: { type: 'shop', tab: 'pc' } });
    }

    // Outage overlay
    if (dark) {
      ctx.fillStyle = `rgba(120,0,0,${0.18 + 0.08 * Math.sin(time * 3)})`;
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = '#ffb4b4'; ctx.font = `800 ${18 * s}px Inter, system-ui`;
      const msg = `⚠ ${room.offlineReason || 'Power down'}`;
      ctx.fillText(msg, fx + fw / 2 - ctx.measureText(msg).width / 2, fy + fh - 24 * s);
    }
    // Location label
    ctx.fillStyle = '#4c638a'; ctx.font = `700 ${11 * s}px Inter, system-ui`;
    ctx.fillText(loc.name.toUpperCase(), fx + 8 * s, fy + fh - 8 * s);
  }

  panel(x, y, w, h, selected, fill) {
    const ctx = this.ctx;
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = selected ? '#5ee7ff' : '#26385a';
    ctx.lineWidth = selected ? 2.5 : 1.2;
    ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = ''; let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lineH; }
    else line = test;
  }
  ctx.fillText(line, x, yy);
}
