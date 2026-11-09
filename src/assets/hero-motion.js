const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_image;
  uniform vec2 u_cover;
  uniform vec2 u_mouse;
  uniform float u_time;
  uniform float u_motion;
  uniform float u_particles;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float gaussian(vec2 p, vec2 c, float strength) {
    vec2 d = p - c;
    return exp(-dot(d, d) * strength);
  }

  void main() {
    vec2 screenUv = v_uv;
    // Fit the complete illustration inside the hero. The reciprocal scale is a
    // soft full-bleed backdrop, so ultrawide screens do not crop Wang Lin's
    // head or hands and do not expose empty bars at the sides.
    vec2 fittedUv = (screenUv - 0.5) * u_cover + 0.5;
    vec2 backdropScale = vec2(1.0 / u_cover.y, 1.0 / u_cover.x);
    vec2 backdropUv = (screenUv - 0.5) * backdropScale + 0.5;
    float inside = step(0.0, fittedUv.x) * step(fittedUv.x, 1.0) * step(0.0, fittedUv.y) * step(fittedUv.y, 1.0);
    vec2 uv = clamp(fittedUv, vec2(0.001), vec2(0.999));
    uv += (u_mouse - 0.5) * vec2(0.0032, 0.0020) * u_motion;

    vec3 probe = texture2D(u_image, uv).rgb;
    float hi = max(probe.r, max(probe.g, probe.b));
    float lo = min(probe.r, min(probe.g, probe.b));
    float neutral = 1.0 - (hi - lo);
    float luma = dot(probe, vec3(0.2126, 0.7152, 0.0722));

    float side = smoothstep(0.08, 0.24, abs(screenUv.x - 0.5));
    float upper = smoothstep(0.34, 0.60, screenUv.y);
    float brightHair = smoothstep(0.34, 0.76, luma) * smoothstep(0.38, 0.84, neutral);
    float faceLock = smoothstep(0.105, 0.215, distance(screenUv, vec2(0.505, 0.785)));
    float nearLuma = dot(texture2D(u_image, uv + vec2(0.0018, 0.0012)).rgb, vec3(0.2126, 0.7152, 0.0722));
    float strandDetail = smoothstep(0.008, 0.09, abs(luma - nearLuma));
    float tipFreedom = smoothstep(0.18, 0.47, abs(screenUv.x - 0.5)) * smoothstep(0.43, 0.88, screenUv.y);
    float hairMask = clamp(brightHair * side * upper * faceLock * mix(0.42, 1.0, strandDetail), 0.0, 1.0);
    float direction = screenUv.x < 0.5 ? -1.0 : 1.0;
    float gust = 0.82 + 0.16 * sin(u_time * 0.29) + 0.26 * smoothstep(0.72, 1.0, sin(u_time * 0.115 + 1.2));
    float hairWave = sin(screenUv.y * 12.0 + u_time * 1.18 + direction * 1.7)
      + 0.52 * sin(abs(screenUv.x - 0.5) * 29.0 - u_time * 0.72)
      + 0.31 * sin(screenUv.y * 41.0 + u_time * 0.41 + direction);

    vec2 warped = uv;
    warped.x += hairMask * hairWave * mix(0.007, 0.018, tipFreedom) * u_motion * gust * direction;
    warped.y += hairMask * (0.35 + tipFreedom) * cos(screenUv.x * 17.0 + u_time * 0.76) * 0.0064 * u_motion * gust;

    float robeArea = smoothstep(0.08, 0.28, screenUv.y) * (1.0 - smoothstep(0.58, 0.75, screenUv.y));
    float robeCenter = 1.0 - smoothstep(0.22, 0.47, abs(screenUv.x - 0.5));
    float robeMask = robeArea * robeCenter * (1.0 - smoothstep(0.18, 0.52, luma));
    float breathing = sin(u_time * 0.76);
    warped.y += robeMask * breathing * 0.0024 * u_motion;
    warped.x += robeMask * (screenUv.x - 0.5) * breathing * 0.0032 * u_motion;

    vec3 color = texture2D(u_image, warped).rgb;
    vec3 backdrop = texture2D(u_image, backdropUv).rgb;
    float backdropLuma = dot(backdrop, vec3(0.2126, 0.7152, 0.0722));
    backdrop = mix(vec3(backdropLuma), backdrop, 0.24) * 1.08 + vec3(0.07, 0.08, 0.10);
    color = mix(backdrop, color, inside);
    float pulse = 0.58 + 0.42 * sin(u_time * 1.08);
    float eyes = gaussian(screenUv, vec2(0.481, 0.817), 22000.0) + gaussian(screenUv, vec2(0.529, 0.817), 22000.0);
    float forehead = gaussian(screenUv, vec2(0.505, 0.889), 9500.0);
    color += vec3(0.22, 0.48, 1.0) * eyes * pulse * 0.54;
    color += vec3(0.55, 0.18, 0.94) * forehead * (0.66 + 0.34 * sin(u_time * 0.74)) * 0.32;

    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      float seed = hash(fi * 19.17 + 2.7);
      float speed = mix(0.008, 0.027, hash(fi * 7.13));
      vec2 p = vec2(hash(fi * 3.91), fract(seed * 8.31 + u_time * speed));
      p.x += sin(u_time * 0.23 + fi) * 0.012;
      float particle = smoothstep(0.0055, 0.0, distance(screenUv, p));
      color += vec3(0.78, 0.22, 0.20) * particle * (0.45 + 0.55 * sin(u_time * 1.7 + fi * 2.1)) * u_particles;
    }

    float mist = sin(screenUv.x * 8.0 + u_time * 0.10) * sin(screenUv.y * 5.0 - u_time * 0.07);
    mist = smoothstep(0.64, 1.0, mist) * (1.0 - smoothstep(0.58, 0.96, screenUv.y));
    color += vec3(0.72, 0.82, 0.96) * mist * 0.023 * u_motion;
    color *= mix(0.91, 1.035, smoothstep(0.9, 0.2, distance(screenUv, vec2(0.5))));
    gl_FragColor = vec4(pow(max(color, 0.0), vec3(0.96)), 1.0);
  }
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

export function mountHeroMotion(root, options = {}) {
  if (!root) return () => {};
  const canvas = root.querySelector("[data-hero-canvas]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compact = matchMedia("(max-width: 700px)").matches;
  if (!canvas || options.enabled === false || reduceMotion) {
    root.classList.add("motion-static");
    return () => {};
  }

  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "high-performance" });
  if (!gl) {
    root.classList.add("motion-static");
    return () => {};
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.info("霜华动态首屏已切换为静态模式", error);
    root.classList.add("motion-static");
    return () => {};
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = Object.fromEntries(["u_image", "u_cover", "u_mouse", "u_time", "u_motion", "u_particles"].map((name) => [name, gl.getUniformLocation(program, name)]));
  const strengths = { "轻柔": 0.46, "标准": 0.92, "强烈": 1.38 };
  let motionTarget = (strengths[options.strength] || strengths["标准"]) * (compact ? 0.72 : 1);
  let motion = motionTarget;
  const mouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
  let imageAspect = 16 / 9;
  let animationFrame = 0;
  let visible = true;
  let disposed = false;
  let start = performance.now();

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, compact ? 1 : 1.5);
    const width = Math.min(compact ? 960 : 2560, Math.max(2, Math.round(bounds.width * scale)));
    const height = Math.min(compact ? 1280 : 1440, Math.max(2, Math.round(bounds.height * scale)));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const draw = (now) => {
    if (disposed || !visible || document.hidden) return;
    resize();
    motion += (motionTarget - motion) * 0.025;
    mouse.x += (mouse.targetX - mouse.x) * 0.035;
    mouse.y += (mouse.targetY - mouse.y) * 0.035;
    const canvasAspect = canvas.width / canvas.height;
    const aspectRatio = canvasAspect / imageAspect;
    // Wide heroes show the whole illustration with side ambience; narrow
    // heroes keep full height and crop only the far left/right hair tips.
    gl.uniform2f(uniforms.u_cover, aspectRatio, 1);
    gl.uniform2f(uniforms.u_mouse, mouse.x, mouse.y);
    gl.uniform1f(uniforms.u_time, (now - start) / 1000);
    gl.uniform1f(uniforms.u_motion, motion);
    gl.uniform1f(uniforms.u_particles, motion * 0.42);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    animationFrame = requestAnimationFrame(draw);
  };

  const image = new Image();
  image.onload = () => {
    if (disposed) return;
    imageAspect = image.naturalWidth / image.naturalHeight;
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(uniforms.u_image, 0);
    root.classList.add("motion-ready");
    start = performance.now();
    animationFrame = requestAnimationFrame(draw);
  };
  image.onerror = () => root.classList.add("motion-static");
  image.src = "/assets/images/wanglin-original-4k-v3.png";

  const onPointerMove = (event) => {
    const bounds = root.getBoundingClientRect();
    mouse.targetX = (event.clientX - bounds.left) / bounds.width;
    mouse.targetY = 1 - (event.clientY - bounds.top) / bounds.height;
  };
  const onWindClick = (event) => {
    const button = event.target.closest("[data-wind]");
    if (!button || !root.contains(button)) return;
    motionTarget = (strengths[button.dataset.wind] || strengths["标准"]) * (compact ? 0.72 : 1);
    root.querySelectorAll("[data-wind]").forEach((item) => item.classList.toggle("active", item === button));
  };
  const onVisibility = () => {
    cancelAnimationFrame(animationFrame);
    if (!document.hidden && visible) {
      start = performance.now();
      animationFrame = requestAnimationFrame(draw);
    }
  };
  root.addEventListener("pointermove", onPointerMove, { passive: true });
  root.addEventListener("click", onWindClick);
  document.addEventListener("visibilitychange", onVisibility);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    cancelAnimationFrame(animationFrame);
    if (visible && !document.hidden) {
      start = performance.now();
      animationFrame = requestAnimationFrame(draw);
    }
  }, { threshold: 0.02 });
  observer.observe(root);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    observer.disconnect();
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("click", onWindClick);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
