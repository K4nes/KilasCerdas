export function createConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const particles: {
    x: number; y: number; vx: number; vy: number;
    size: number; color: string; rotation: number; rotationSpeed: number;
    opacity: number; shape: 'rect' | 'circle';
  }[] = [];

  const colors = [
    'oklch(66% 0.22 0)',       // pink
    'oklch(60% 0.22 295)',     // violet
    'oklch(82% 0.150 85)',     // mustard
    'oklch(48% 0.155 45)',     // orange-pink
    'oklch(32% 0.105 150)',    // mint-dark
    'oklch(70% 0.075 145)',    // mint-light
  ];

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  for (let i = 0; i < 220; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 7,
      vy: Math.random() * 3 + 2,
      size: Math.random() * 9 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    });
  }

  let animId = 0;
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.0028;
      if (p.opacity <= 0) continue;
      alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive) animId = requestAnimationFrame(animate);
  };
  animate();
  return () => cancelAnimationFrame(animId);
}
