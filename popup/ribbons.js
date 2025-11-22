// Ribbon Cursor Trail Effect
// Inspired by OGL Ribbons with smooth physics-based motion

class RibbonTrail {
  constructor(options = {}) {
    this.colors = options.colors || ['#ffffff'];
    this.baseThickness = options.baseThickness || 30;
    this.maxAge = options.maxAge || 500;
    this.pointCount = options.pointCount || 50;
    this.speedMultiplier = options.speedMultiplier || 0.6;
    this.baseSpring = options.baseSpring || 0.03;
    this.baseFriction = options.baseFriction || 0.9;
    
    this.canvas = null;
    this.ctx = null;
    this.ribbons = [];
    this.mouse = { x: 0, y: 0 };
    this.animationId = null;
    this.lastTime = performance.now();
  }

  init(container) {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Initialize ribbons
    this.colors.forEach((color, index) => {
      const ribbon = {
        color: color,
        points: [],
        velocity: { x: 0, y: 0 },
        spring: this.baseSpring + (Math.random() - 0.5) * 0.01,
        friction: this.baseFriction + (Math.random() - 0.5) * 0.02,
        thickness: this.baseThickness + (Math.random() - 0.5) * 5,
        offset: {
          x: (index - (this.colors.length - 1) / 2) * 10,
          y: (Math.random() - 0.5) * 20
        }
      };
      
      // Initialize points
      for (let i = 0; i < this.pointCount; i++) {
        ribbon.points.push({ x: 0, y: 0, age: 0 });
      }
      
      this.ribbons.push(ribbon);
    });
    
    // Start animation
    this.animate();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  updateMouse(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
  }

  animate() {
    const currentTime = performance.now();
    const dt = Math.min(currentTime - this.lastTime, 50); // Cap delta time
    this.lastTime = currentTime;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ribbons.forEach(ribbon => {
      // Update first point with spring physics
      const targetX = this.mouse.x + ribbon.offset.x;
      const targetY = this.mouse.y + ribbon.offset.y;
      
      const dx = targetX - ribbon.points[0].x;
      const dy = targetY - ribbon.points[0].y;
      
      ribbon.velocity.x += dx * ribbon.spring;
      ribbon.velocity.y += dy * ribbon.spring;
      
      ribbon.velocity.x *= ribbon.friction;
      ribbon.velocity.y *= ribbon.friction;
      
      ribbon.points[0].x += ribbon.velocity.x;
      ribbon.points[0].y += ribbon.velocity.y;
      ribbon.points[0].age = 0;
      
      // Update trailing points with smooth interpolation
      for (let i = 1; i < ribbon.points.length; i++) {
        const alpha = Math.min(1, (dt * this.speedMultiplier) / (this.maxAge / ribbon.points.length));
        ribbon.points[i].x += (ribbon.points[i - 1].x - ribbon.points[i].x) * alpha;
        ribbon.points[i].y += (ribbon.points[i - 1].y - ribbon.points[i].y) * alpha;
        ribbon.points[i].age += dt;
      }
      
      // Draw ribbon
      this.drawRibbon(ribbon);
    });
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  drawRibbon(ribbon) {
    if (ribbon.points.length < 2) return;
    
    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    // Draw smooth curve with gradient
    for (let i = 0; i < ribbon.points.length - 1; i++) {
      const p1 = ribbon.points[i];
      const p2 = ribbon.points[i + 1];
      
      // Calculate opacity based on age and position
      const progress = i / ribbon.points.length;
      const opacity = Math.max(0, 1 - progress) * 0.8;
      
      // Calculate thickness with taper
      const thickness = ribbon.thickness * (1 - progress * 0.7);
      
      // Draw segment
      const gradient = this.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      const color = this.hexToRgb(ribbon.color);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`);
      
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = thickness;
      
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// Export for use in popup.js
window.RibbonTrail = RibbonTrail;

