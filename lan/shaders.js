(function () {
  const VERT = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const PRESETS = {
    off: null,
    aurora: `
      precision mediump float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_res;
      void main() {
        vec2 uv = v_uv;
        float t = u_time * 0.15;
        float n = sin(uv.x * 6.0 + t) * cos(uv.y * 5.0 - t * 0.7);
        vec3 c1 = vec3(0.05, 0.12, 0.22);
        vec3 c2 = vec3(0.15, 0.35, 0.55);
        vec3 c3 = vec3(0.25, 0.12, 0.35);
        float m = 0.5 + 0.5 * n;
        vec3 col = mix(c1, c2, uv.y + m * 0.3);
        col = mix(col, c3, 0.35 + 0.35 * sin(t + uv.x * 8.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    plasma: `
      precision mediump float;
      varying vec2 v_uv;
      uniform float u_time;
      void main() {
        vec2 p = v_uv * 4.0;
        float t = u_time * 0.4;
        float v = 0.0;
        v += sin(p.x + t);
        v += sin(p.y + t * 0.7);
        v += sin(p.x + p.y + t * 0.5);
        v += sin(sqrt(p.x * p.x + p.y * p.y) + t);
        vec3 c = 0.5 + 0.5 * cos(vec3(v, v + 2.0, v + 4.0));
        c *= vec3(0.12, 0.14, 0.2) + c * 0.35;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    silk: `
      precision mediump float;
      varying vec2 v_uv;
      uniform float u_time;
      void main() {
        vec2 uv = v_uv * 2.0 - 1.0;
        float a = atan(uv.y, uv.x) + u_time * 0.2;
        float r = length(uv);
        float w = sin(10.0 * r - u_time * 1.5) * 0.5 + 0.5;
        float b = sin(a * 5.0 + r * 8.0) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.08, 0.08, 0.1), vec3(0.2, 0.22, 0.35), w);
        col = mix(col, vec3(0.35, 0.2, 0.45), b * (1.0 - r));
        col *= 1.0 - r * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    chroma: `
      precision mediump float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_res;
      void main() {
        vec2 uv = v_uv;
        float t = u_time * 0.25;
        float scan = sin(uv.y * u_res.y * 0.08 + t * 3.0) * 0.03;
        vec3 c = vec3(
          0.08 + 0.06 * sin(t + uv.x * 5.0),
          0.1 + 0.07 * sin(t * 1.3 + uv.y * 6.0 + scan * 10.0),
          0.12 + 0.08 * sin(t * 0.8 + (uv.x + uv.y) * 4.0)
        );
        float v = sin((uv.x * 3.0 + uv.y * 2.0) * 6.28318 + t) * 0.5 + 0.5;
        c += vec3(0.08, 0.05, 0.12) * v;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    noise: `
      precision mediump float;
      varying vec2 v_uv;
      uniform float u_time;
      float n(vec2 x) {
        return fract(sin(dot(x, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        vec2 uv = v_uv * 8.0;
        float t = u_time * 0.5;
        float m = n(floor(uv + t)) * 0.5 + n(floor(uv * 1.7 - t * 0.3)) * 0.35;
        vec3 col = vec3(0.07) + vec3(m * 0.25, m * 0.2, m * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  };

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createProgram(gl, fragSrc) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  window.ShaderBg = {
    PRESETS: Object.keys(PRESETS),
    init(canvas, presetId) {
      this.canvas = canvas;
      this.gl =
        canvas.getContext('webgl', { alpha: false, antialias: false }) ||
        canvas.getContext('experimental-webgl', { alpha: false });
      if (!this.gl) return;
      const gl = this.gl;
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.quad = quad;
      this.programs = {};
      this.loc = {};
      this.setPreset(presetId || 'aurora');
      this._resize();
      window.addEventListener('resize', () => this._resize());
      this._t0 = performance.now();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    },
    _resize() {
      if (!this.gl || !this.canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(this.canvas.clientWidth * dpr);
      const h = Math.floor(this.canvas.clientHeight * dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
      }
    },
    setPreset(id) {
      if (!this.gl) return;
      const key = PRESETS[id] ? id : 'aurora';
      const src = PRESETS[key];
      this.activeKey = key;
      if (!src) {
        this.canvas.style.opacity = '0';
        this.useProgram = null;
        return;
      }
      this.canvas.style.opacity = '1';
      if (!this.programs[key]) {
        this.programs[key] = createProgram(this.gl, src);
      }
      this.useProgram = this.programs[key];
      if (!this.useProgram) return;
      const gl = this.gl;
      gl.useProgram(this.useProgram);
      const loc = (this.loc[key] = this.loc[key] || {});
      loc.a_pos = gl.getAttribLocation(this.useProgram, 'a_pos');
      loc.u_time = gl.getUniformLocation(this.useProgram, 'u_time');
      loc.u_res = gl.getUniformLocation(this.useProgram, 'u_res');
    },
    _loop() {
      if (!this.gl || !this.useProgram) {
        requestAnimationFrame(this._loop);
        return;
      }
      const gl = this.gl;
      const t = (performance.now() - this._t0) * 0.001;
      const key = this.activeKey;
      const loc = this.loc[key];
      gl.useProgram(this.useProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(loc.a_pos);
      gl.vertexAttribPointer(loc.a_pos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(loc.u_time, t);
      if (loc.u_res) gl.uniform2f(loc.u_res, this.canvas.width, this.canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(this._loop);
    },
  };
})();
