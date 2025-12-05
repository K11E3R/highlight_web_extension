/**
 * SplashCursor - WebGL Fluid Simulation Cursor Effect
 * Converted from React to Vanilla JavaScript for Chrome Extension
 */

class SplashCursor {
  constructor(options = {}) {
    this.config = {
      SIM_RESOLUTION: options.SIM_RESOLUTION || 128,
      DYE_RESOLUTION: options.DYE_RESOLUTION || 1024,
      CAPTURE_RESOLUTION: options.CAPTURE_RESOLUTION || 512,
      DENSITY_DISSIPATION: options.DENSITY_DISSIPATION || 3.5,
      VELOCITY_DISSIPATION: options.VELOCITY_DISSIPATION || 2,
      PRESSURE: options.PRESSURE || 0.1,
      PRESSURE_ITERATIONS: options.PRESSURE_ITERATIONS || 20,
      CURL: options.CURL || 3,
      SPLAT_RADIUS: options.SPLAT_RADIUS || 0.2,
      SPLAT_FORCE: options.SPLAT_FORCE || 6000,
      SHADING: options.SHADING !== false,
      COLOR_UPDATE_SPEED: options.COLOR_UPDATE_SPEED || 10,
      PAUSED: false,
      BACK_COLOR: options.BACK_COLOR || { r: 0.5, g: 0, b: 0 },
      TRANSPARENT: options.TRANSPARENT !== false
    };

    this.canvas = null;
    this.gl = null;
    this.ext = null;
    this.pointers = [this.pointerPrototype()];
    this.lastUpdateTime = Date.now();
    this.colorUpdateTimer = 0;
    this.animationFrame = null;
    this.isInitialized = false;
  }

  pointerPrototype() {
    return {
      id: -1,
      texcoordX: 0,
      texcoordY: 0,
      prevTexcoordX: 0,
      prevTexcoordY: 0,
      deltaX: 0,
      deltaY: 0,
      down: false,
      moved: false,
      color: { r: 0, g: 0, b: 0 }
    };
  }

  init() {
    if (this.isInitialized) return;

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'splash-cursor-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9998;
      pointer-events: none;
    `;
    document.body.appendChild(this.canvas);

    // Initialize WebGL
    const result = this.getWebGLContext(this.canvas);
    if (!result.gl || !result.ext) {
      console.error('WebGL not supported');
      return;
    }

    this.gl = result.gl;
    this.ext = result.ext;

    if (!this.ext.supportLinearFiltering) {
      this.config.DYE_RESOLUTION = 256;
      this.config.SHADING = false;
    }

    this.initShaders();
    this.initFramebuffers();
    this.setupEventListeners();
    this.updateKeywords();
    
    this.isInitialized = true;
    this.start();
  }

  getWebGLContext(canvas) {
    const params = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false
    };

    let gl = canvas.getContext('webgl2', params);
    if (!gl) {
      gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    }

    if (!gl) {
      return { gl: null, ext: null };
    }

    const isWebGL2 = !!gl.drawBuffers;
    let supportLinearFiltering = false;
    let halfFloat = null;

    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = !!gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = !!gl.getExtension('OES_texture_half_float_linear');
    }

    gl.clearColor(0, 0, 0, 1);

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat ? halfFloat.HALF_FLOAT_OES : 0);

    let formatRGBA, formatRG, formatR;

    if (isWebGL2) {
      formatRGBA = this.getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG = this.getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
      formatR = this.getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
      formatRGBA = this.getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG = this.getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatR = this.getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    return {
      gl,
      ext: {
        formatRGBA,
        formatRG,
        formatR,
        halfFloatTexType,
        supportLinearFiltering
      }
    };
  }

  getSupportedFormat(gl, internalFormat, format, type) {
    if (!this.supportRenderTextureFormat(gl, internalFormat, format, type)) {
      if (gl.drawBuffers) {
        switch (internalFormat) {
          case gl.R16F:
            return this.getSupportedFormat(gl, gl.RG16F, gl.RG, type);
          case gl.RG16F:
            return this.getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
          default:
            return null;
        }
      }
      return null;
    }
    return { internalFormat, format };
  }

  supportRenderTextureFormat(gl, internalFormat, format, type) {
    const texture = gl.createTexture();
    if (!texture) return false;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    if (!fbo) return false;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status === gl.FRAMEBUFFER_COMPLETE;
  }

  initShaders() {
    const gl = this.gl;

    // Base vertex shader
    const baseVertexShader = this.compileShader(gl.VERTEX_SHADER, `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `);

    // Fragment shaders
    const copyShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      void main () {
        gl_FragColor = texture2D(uTexture, vUv);
      }
    `);

    const clearShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;
      void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
      }
    `);

    const splatShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }
    `);

    const advectionShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform vec2 dyeTexelSize;
      uniform float dt;
      uniform float dissipation;
      
      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;
        vec2 iuv = floor(st);
        vec2 fuv = fract(st);
        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
      }
      
      void main () {
        #ifdef MANUAL_FILTERING
          vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
          vec4 result = bilerp(uSource, coord, dyeTexelSize);
        #else
          vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
          vec4 result = texture2D(uSource, coord);
        #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
      }
    `, this.ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']);

    const divergenceShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; }
        if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; }
        if (vB.y < 0.0) { B = -C.y; }
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `);

    const curlShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
    `);

    const vorticityShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `);

    const pressureShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
    `);

    const gradientSubtractShader = this.compileShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `);

    const displayShaderSource = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform vec2 texelSize;
      
      vec3 linearToGamma (vec3 color) {
        color = max(color, vec3(0));
        return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));
      }
      
      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        #ifdef SHADING
          vec3 lc = texture2D(uTexture, vL).rgb;
          vec3 rc = texture2D(uTexture, vR).rgb;
          vec3 tc = texture2D(uTexture, vT).rgb;
          vec3 bc = texture2D(uTexture, vB).rgb;
          float dx = length(rc) - length(lc);
          float dy = length(tc) - length(bc);
          vec3 n = normalize(vec3(dx, dy, length(texelSize)));
          vec3 l = vec3(0.0, 0.0, 1.0);
          float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
          c *= diffuse;
        #endif
        float a = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c, a);
      }
    `;

    // Initialize programs
    this.copyProgram = new Program(this.gl, baseVertexShader, copyShader);
    this.clearProgram = new Program(this.gl, baseVertexShader, clearShader);
    this.splatProgram = new Program(this.gl, baseVertexShader, splatShader);
    this.advectionProgram = new Program(this.gl, baseVertexShader, advectionShader);
    this.divergenceProgram = new Program(this.gl, baseVertexShader, divergenceShader);
    this.curlProgram = new Program(this.gl, baseVertexShader, curlShader);
    this.vorticityProgram = new Program(this.gl, baseVertexShader, vorticityShader);
    this.pressureProgram = new Program(this.gl, baseVertexShader, pressureShader);
    this.gradientSubtractProgram = new Program(this.gl, baseVertexShader, gradientSubtractShader);
    this.displayMaterial = new Material(this.gl, baseVertexShader, displayShaderSource);

    // Setup blit
    this.setupBlit();
  }

  setupBlit() {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);

    const elemBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    this.blit = (target, doClear = false) => {
      if (!target) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (doClear) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  }

  compileShader(type, source, keywords = null) {
    const gl = this.gl;
    if (keywords) {
      let keywordsString = '';
      for (const keyword of keywords) {
        keywordsString += `#define ${keyword}\n`;
      }
      source = keywordsString + source;
    }

    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  }

  initFramebuffers() {
    const gl = this.gl;
    const simRes = this.getResolution(this.config.SIM_RESOLUTION);
    const dyeRes = this.getResolution(this.config.DYE_RESOLUTION);

    const texType = this.ext.halfFloatTexType;
    const rgba = this.ext.formatRGBA;
    const rg = this.ext.formatRG;
    const r = this.ext.formatR;
    const filtering = this.ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    gl.disable(gl.BLEND);

    this.dye = this.createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
    this.velocity = this.createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    this.divergence = this.createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    this.curl = this.createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    this.pressure = this.createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
  }

  createFBO(w, h, internalFormat, format, type, param) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      texture,
      fbo,
      width: w,
      height: h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      }
    };
  }

  createDoubleFBO(w, h, internalFormat, format, type, param) {
    const fbo1 = this.createFBO(w, h, internalFormat, format, type, param);
    const fbo2 = this.createFBO(w, h, internalFormat, format, type, param);

    return {
      width: w,
      height: h,
      texelSizeX: fbo1.texelSizeX,
      texelSizeY: fbo1.texelSizeY,
      read: fbo1,
      write: fbo2,
      swap() {
        const tmp = this.read;
        this.read = this.write;
        this.write = tmp;
      }
    };
  }

  getResolution(resolution) {
    const w = this.gl.drawingBufferWidth;
    const h = this.gl.drawingBufferHeight;
    const aspectRatio = w / h;
    let aspect = aspectRatio < 1 ? 1 / aspectRatio : aspectRatio;
    const min = Math.round(resolution);
    const max = Math.round(resolution * aspect);

    if (w > h) {
      return { width: max, height: min };
    }
    return { width: min, height: max };
  }

  updateKeywords() {
    const displayKeywords = [];
    if (this.config.SHADING) displayKeywords.push('SHADING');
    this.displayMaterial.setKeywords(displayKeywords);
  }

  setupEventListeners() {
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseDown = this.handleMouseDown.bind(this);
    
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mousedown', this.boundMouseDown);
  }

  handleMouseMove(e) {
    const pointer = this.pointers[0];
    const posX = this.scaleByPixelRatio(e.clientX);
    const posY = this.scaleByPixelRatio(e.clientY);
    this.updatePointerMoveData(pointer, posX, posY, pointer.color);
  }

  handleMouseDown(e) {
    const pointer = this.pointers[0];
    const posX = this.scaleByPixelRatio(e.clientX);
    const posY = this.scaleByPixelRatio(e.clientY);
    this.updatePointerDownData(pointer, -1, posX, posY);
    this.clickSplat(pointer);
  }

  scaleByPixelRatio(input) {
    const pixelRatio = window.devicePixelRatio || 1;
    return Math.floor(input * pixelRatio);
  }

  updatePointerDownData(pointer, id, posX, posY) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = posX / this.canvas.width;
    pointer.texcoordY = 1 - posY / this.canvas.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = this.generateColor();
  }

  updatePointerMoveData(pointer, posX, posY, color) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / this.canvas.width;
    pointer.texcoordY = 1 - posY / this.canvas.height;
    pointer.deltaX = this.correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = this.correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    pointer.color = color;
  }

  correctDeltaX(delta) {
    const aspectRatio = this.canvas.width / this.canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
  }

  correctDeltaY(delta) {
    const aspectRatio = this.canvas.width / this.canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
  }

  clickSplat(pointer) {
    const color = this.generateColor();
    color.r *= 10;
    color.g *= 10;
    color.b *= 10;
    const dx = 10 * (Math.random() - 0.5);
    const dy = 30 * (Math.random() - 0.5);
    this.splat(pointer.texcoordX, pointer.texcoordY, dx, dy, color);
  }

  splat(x, y, dx, dy, color) {
    const gl = this.gl;
    
    this.splatProgram.bind();
    if (this.splatProgram.uniforms.uTarget) {
      gl.uniform1i(this.splatProgram.uniforms.uTarget, this.velocity.read.attach(0));
    }
    if (this.splatProgram.uniforms.aspectRatio) {
      gl.uniform1f(this.splatProgram.uniforms.aspectRatio, this.canvas.width / this.canvas.height);
    }
    if (this.splatProgram.uniforms.point) {
      gl.uniform2f(this.splatProgram.uniforms.point, x, y);
    }
    if (this.splatProgram.uniforms.color) {
      gl.uniform3f(this.splatProgram.uniforms.color, dx, dy, 0);
    }
    if (this.splatProgram.uniforms.radius) {
      gl.uniform1f(this.splatProgram.uniforms.radius, this.correctRadius(this.config.SPLAT_RADIUS / 100));
    }
    this.blit(this.velocity.write);
    this.velocity.swap();

    if (this.splatProgram.uniforms.uTarget) {
      gl.uniform1i(this.splatProgram.uniforms.uTarget, this.dye.read.attach(0));
    }
    if (this.splatProgram.uniforms.color) {
      gl.uniform3f(this.splatProgram.uniforms.color, color.r, color.g, color.b);
    }
    this.blit(this.dye.write);
    this.dye.swap();
  }

  correctRadius(radius) {
    const aspectRatio = this.canvas.width / this.canvas.height;
    if (aspectRatio > 1) radius *= aspectRatio;
    return radius;
  }

  generateColor() {
    const c = this.HSVtoRGB(Math.random(), 1.0, 1.0);
    c.r *= 0.15;
    c.g *= 0.15;
    c.b *= 0.15;
    return c;
  }

  HSVtoRGB(h, s, v) {
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }

    return { r, g, b };
  }

  start() {
    const updateFrame = () => {
      const dt = this.calcDeltaTime();
      if (this.resizeCanvas()) this.initFramebuffers();
      this.updateColors(dt);
      this.applyInputs();
      this.step(dt);
      this.render();
      this.animationFrame = requestAnimationFrame(updateFrame);
    };
    updateFrame();
  }

  calcDeltaTime() {
    const now = Date.now();
    let dt = (now - this.lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    this.lastUpdateTime = now;
    return dt;
  }

  resizeCanvas() {
    const width = this.scaleByPixelRatio(this.canvas.clientWidth);
    const height = this.scaleByPixelRatio(this.canvas.clientHeight);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      return true;
    }
    return false;
  }

  updateColors(dt) {
    this.colorUpdateTimer += dt * this.config.COLOR_UPDATE_SPEED;
    if (this.colorUpdateTimer >= 1) {
      this.colorUpdateTimer = this.colorUpdateTimer % 1;
      this.pointers.forEach(p => {
        p.color = this.generateColor();
      });
    }
  }

  applyInputs() {
    for (const p of this.pointers) {
      if (p.moved) {
        p.moved = false;
        this.splatPointer(p);
      }
    }
  }

  splatPointer(pointer) {
    const dx = pointer.deltaX * this.config.SPLAT_FORCE;
    const dy = pointer.deltaY * this.config.SPLAT_FORCE;
    this.splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
  }

  step(dt) {
    const gl = this.gl;
    gl.disable(gl.BLEND);

    this.curlProgram.bind();
    if (this.curlProgram.uniforms.texelSize) {
      gl.uniform2f(this.curlProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    if (this.curlProgram.uniforms.uVelocity) {
      gl.uniform1i(this.curlProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    }
    this.blit(this.curl);

    this.vorticityProgram.bind();
    if (this.vorticityProgram.uniforms.texelSize) {
      gl.uniform2f(this.vorticityProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    if (this.vorticityProgram.uniforms.uVelocity) {
      gl.uniform1i(this.vorticityProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    }
    if (this.vorticityProgram.uniforms.uCurl) {
      gl.uniform1i(this.vorticityProgram.uniforms.uCurl, this.curl.attach(1));
    }
    if (this.vorticityProgram.uniforms.curl) {
      gl.uniform1f(this.vorticityProgram.uniforms.curl, this.config.CURL);
    }
    if (this.vorticityProgram.uniforms.dt) {
      gl.uniform1f(this.vorticityProgram.uniforms.dt, dt);
    }
    this.blit(this.velocity.write);
    this.velocity.swap();

    this.divergenceProgram.bind();
    if (this.divergenceProgram.uniforms.texelSize) {
      gl.uniform2f(this.divergenceProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    if (this.divergenceProgram.uniforms.uVelocity) {
      gl.uniform1i(this.divergenceProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    }
    this.blit(this.divergence);

    this.clearProgram.bind();
    if (this.clearProgram.uniforms.uTexture) {
      gl.uniform1i(this.clearProgram.uniforms.uTexture, this.pressure.read.attach(0));
    }
    if (this.clearProgram.uniforms.value) {
      gl.uniform1f(this.clearProgram.uniforms.value, this.config.PRESSURE);
    }
    this.blit(this.pressure.write);
    this.pressure.swap();

    this.pressureProgram.bind();
    if (this.pressureProgram.uniforms.texelSize) {
      gl.uniform2f(this.pressureProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    if (this.pressureProgram.uniforms.uDivergence) {
      gl.uniform1i(this.pressureProgram.uniforms.uDivergence, this.divergence.attach(0));
    }

    for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i++) {
      if (this.pressureProgram.uniforms.uPressure) {
        gl.uniform1i(this.pressureProgram.uniforms.uPressure, this.pressure.read.attach(1));
      }
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    this.gradientSubtractProgram.bind();
    if (this.gradientSubtractProgram.uniforms.texelSize) {
      gl.uniform2f(this.gradientSubtractProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    if (this.gradientSubtractProgram.uniforms.uPressure) {
      gl.uniform1i(this.gradientSubtractProgram.uniforms.uPressure, this.pressure.read.attach(0));
    }
    if (this.gradientSubtractProgram.uniforms.uVelocity) {
      gl.uniform1i(this.gradientSubtractProgram.uniforms.uVelocity, this.velocity.read.attach(1));
    }
    this.blit(this.velocity.write);
    this.velocity.swap();

    this.advectionProgram.bind();
    if (this.advectionProgram.uniforms.texelSize) {
      gl.uniform2f(this.advectionProgram.uniforms.texelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }
    if (!this.ext.supportLinearFiltering && this.advectionProgram.uniforms.dyeTexelSize) {
      gl.uniform2f(this.advectionProgram.uniforms.dyeTexelSize, this.velocity.texelSizeX, this.velocity.texelSizeY);
    }

    const velocityId = this.velocity.read.attach(0);
    if (this.advectionProgram.uniforms.uVelocity) {
      gl.uniform1i(this.advectionProgram.uniforms.uVelocity, velocityId);
    }
    if (this.advectionProgram.uniforms.uSource) {
      gl.uniform1i(this.advectionProgram.uniforms.uSource, velocityId);
    }
    if (this.advectionProgram.uniforms.dt) {
      gl.uniform1f(this.advectionProgram.uniforms.dt, dt);
    }
    if (this.advectionProgram.uniforms.dissipation) {
      gl.uniform1f(this.advectionProgram.uniforms.dissipation, this.config.VELOCITY_DISSIPATION);
    }
    this.blit(this.velocity.write);
    this.velocity.swap();

    if (!this.ext.supportLinearFiltering && this.advectionProgram.uniforms.dyeTexelSize) {
      gl.uniform2f(this.advectionProgram.uniforms.dyeTexelSize, this.dye.texelSizeX, this.dye.texelSizeY);
    }
    if (this.advectionProgram.uniforms.uVelocity) {
      gl.uniform1i(this.advectionProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    }
    if (this.advectionProgram.uniforms.uSource) {
      gl.uniform1i(this.advectionProgram.uniforms.uSource, this.dye.read.attach(1));
    }
    if (this.advectionProgram.uniforms.dissipation) {
      gl.uniform1f(this.advectionProgram.uniforms.dissipation, this.config.DENSITY_DISSIPATION);
    }
    this.blit(this.dye.write);
    this.dye.swap();
  }

  render() {
    const gl = this.gl;
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    this.displayMaterial.bind();
    if (this.config.SHADING && this.displayMaterial.uniforms.texelSize) {
      gl.uniform2f(this.displayMaterial.uniforms.texelSize, 1 / width, 1 / height);
    }
    if (this.displayMaterial.uniforms.uTexture) {
      gl.uniform1i(this.displayMaterial.uniforms.uTexture, this.dye.read.attach(0));
    }
    this.blit(null, false);
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
    }
    if (this.boundMouseDown) {
      document.removeEventListener('mousedown', this.boundMouseDown);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.isInitialized = false;
  }
}

// Helper classes
class Program {
  constructor(gl, vertexShader, fragmentShader) {
    this.gl = gl;
    this.program = this.createProgram(vertexShader, fragmentShader);
    this.uniforms = this.program ? this.getUniforms(this.program) : {};
  }

  createProgram(vertexShader, fragmentShader) {
    if (!vertexShader || !fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  getUniforms(program) {
    const uniforms = {};
    const uniformCount = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = this.gl.getActiveUniform(program, i);
      if (uniformInfo) {
        uniforms[uniformInfo.name] = this.gl.getUniformLocation(program, uniformInfo.name);
      }
    }
    return uniforms;
  }

  bind() {
    if (this.program) this.gl.useProgram(this.program);
  }
}

class Material {
  constructor(gl, vertexShader, fragmentShaderSource) {
    this.gl = gl;
    this.vertexShader = vertexShader;
    this.fragmentShaderSource = fragmentShaderSource;
    this.programs = {};
    this.activeProgram = null;
    this.uniforms = {};
  }

  setKeywords(keywords) {
    let hash = 0;
    for (const kw of keywords) {
      hash += this.hashCode(kw);
    }

    let program = this.programs[hash];
    if (program == null) {
      const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
      program = this.createProgram(this.vertexShader, fragmentShader);
      this.programs[hash] = program;
    }

    if (program === this.activeProgram) return;

    if (program) {
      this.uniforms = this.getUniforms(program);
    }
    this.activeProgram = program;
  }

  hashCode(s) {
    if (!s.length) return 0;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  compileShader(type, source, keywords = null) {
    if (keywords) {
      let keywordsString = '';
      for (const keyword of keywords) {
        keywordsString += `#define ${keyword}\n`;
      }
      source = keywordsString + source;
    }

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Material shader compile error:', this.gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  }

  createProgram(vertexShader, fragmentShader) {
    if (!vertexShader || !fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Material program link error:', this.gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  getUniforms(program) {
    const uniforms = {};
    const uniformCount = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = this.gl.getActiveUniform(program, i);
      if (uniformInfo) {
        uniforms[uniformInfo.name] = this.gl.getUniformLocation(program, uniformInfo.name);
      }
    }
    return uniforms;
  }

  bind() {
    if (this.activeProgram) {
      this.gl.useProgram(this.activeProgram);
    }
  }
}

// Export for use in popup.js
window.SplashCursor = SplashCursor;

