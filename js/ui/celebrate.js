// Confetti bursts and the big level-up banner.

let canvas = null; let ctx = null; let bits = []; let running = false;
const COLORS = ['#5ee7ff', '#8b5cf6', '#ffd166', '#34d399', '#f472b6', '#ffffff'];
const reduced = () => document.body.classList.contains('calm') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.id = 'confetti';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
}

export function confetti({ x = 0.5, y = 0.35, count = 120, spread = 1 } = {}) {
  if (reduced()) return;
  ensure();
  const W = window.innerWidth; const H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2; const v = (4 + Math.random() * 9) * spread;
    bits.push({
      x: x * W, y: y * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
      c: COLORS[i % COLORS.length], life: 1,
    });
  }
  if (!running) { running = true; requestAnimationFrame(step); }
}

function step() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bits = bits.filter((b) => b.life > 0 && b.y < canvas.height + 20);
  for (const b of bits) {
    b.vy += 0.25; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.life -= 0.007;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, b.life * 1.6));
    ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
  }
  if (bits.length) requestAnimationFrame(step);
  else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

/** Full-screen "LEVEL 7" moment. */
export function banner(big, small, kind = 'level') {
  if (reduced()) return;
  const el = document.createElement('div');
  el.className = `banner ${kind}`;
  el.innerHTML = `<div class="banner-big"></div><div class="banner-small"></div>`;
  el.querySelector('.banner-big').textContent = big;
  el.querySelector('.banner-small').textContent = small;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2800);
}
