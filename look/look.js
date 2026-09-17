// 이번 주 프로토타입 — 룩 공유 케이스(JS). 브라우저 전역 Look. 값의 정본은 channel.yaml brand.colors.
const Look = {
  colors: { cream: '#F0E7D8', ink: '#0E0A08', amber: '#E6B422', walnut: '#241811',
            brass: '#8C7D5C', night: '#1A162E', rust: '#C6563A' },

  /** 논리 해상도 w×h 를 정수배로 키운 캔버스. 업스케일은 정수배만. */
  pixelCanvas(canvas, w, h, opt = {}) {
    const maxW = opt.maxWidth ?? (typeof window !== 'undefined' ? window.innerWidth : w);
    const maxH = opt.maxHeight ?? (typeof window !== 'undefined' ? window.innerHeight : h);
    const scale = Math.max(1, Math.min(Math.floor(maxW / w), Math.floor(maxH / h)));
    canvas.width = w * scale; canvas.height = h * scale;
    canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(scale, scale);
    return { ctx, scale };
  },

  /** 잔상: 지우는 대신 배경색을 alpha 로 덮는다. 움직이는 것이 꼬리를 남긴다. */
  trail(ctx, w, h, alpha = 0.35, color = Look.colors.walnut) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
  },

  /** 비네트: 캔버스 안에서 그릴 때 쓴다(CSS .vignette 와 택일). */
  vignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(14,10,8,0)'); g.addColorStop(1, 'rgba(14,10,8,0.6)');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.restore();
  },
};
if (typeof window !== 'undefined') window.Look = Look;
