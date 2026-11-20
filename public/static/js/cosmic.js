/**
 * Cosmic Starfield & Shooting Comet Canvas Animation
 * Built for Attendance Tracker
 * Credits: Tom Sanson | GitHub: Tomz-SN
 */

(function () {
  const canvas = document.getElementById('cosmic-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initStars();
  });

  const STAR_COUNT = Math.min(180, Math.floor((width * height) / 8000));
  const stars = [];
  const comets = [];

  const starColors = ['#ffffff', '#e0e7ff', '#c4b5fd', '#a5f3fc', '#fbcfe8'];

  function initStars() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.6 + 0.4,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        alpha: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleDir: Math.random() > 0.5 ? 1 : -1,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1
      });
    }
  }

  function spawnComet() {
    if (comets.length > 2) return;
    const startX = Math.random() * width * 0.8;
    const startY = Math.random() * (height * 0.4);
    const speed = Math.random() * 6 + 5;
    const angle = (Math.PI / 4) + (Math.random() * 0.2 - 0.1); // ~45 deg downward

    comets.push({
      x: startX,
      y: startY,
      length: Math.random() * 80 + 60,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1.0,
      decay: Math.random() * 0.012 + 0.008
    });
  }

  // Trigger comets periodically
  setInterval(() => {
    if (Math.random() > 0.3) {
      spawnComet();
    }
  }, 4500);

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Draw & update stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];

      // Twinkle
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha >= 0.95) {
        s.alpha = 0.95;
        s.twinkleDir = -1;
      } else if (s.alpha <= 0.15) {
        s.alpha = 0.15;
        s.twinkleDir = 1;
      }

      // Drift slightly
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < 0) s.x = width;
      if (s.x > width) s.x = 0;
      if (s.y < 0) s.y = height;
      if (s.y > height) s.y = 0;

      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.shadowBlur = s.radius * 3;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw & update comets
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      c.x += c.vx;
      c.y += c.vy;
      c.alpha -= c.decay;

      if (c.alpha <= 0 || c.x > width + 100 || c.y > height + 100) {
        comets.splice(i, 1);
        continue;
      }

      const tailX = c.x - (c.vx / 6) * (c.length / 10);
      const tailY = c.y - (c.vy / 6) * (c.length / 10);

      const grad = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255, 255, 255, ${c.alpha})`);
      grad.addColorStop(0.3, `rgba(103, 232, 249, ${c.alpha * 0.7})`);
      grad.addColorStop(1, 'rgba(139, 92, 246, 0)');

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // Comet head glow
      ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#06b6d4';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(animate);
  }

  initStars();
  animate();
})();
