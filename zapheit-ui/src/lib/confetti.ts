const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

export function fireConfetti(originX = window.innerWidth / 2, originY = window.innerHeight / 2) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const count = 80;
  const particles: Particle[] = Array.from({ length: count }, () => ({
    x: originX, y: originY,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 12 - 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 7 + 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    opacity: 1,
  }));

  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      if (frame > 40) p.opacity = Math.max(0, p.opacity - 0.025);
      if (p.opacity > 0) alive = true;
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    frame++;
    if (alive) requestAnimationFrame(tick);
    else canvas.remove();
  }
  requestAnimationFrame(tick);
}
