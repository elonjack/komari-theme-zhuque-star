const DEG = Math.PI / 180;
const EARTH_TEXTURES = {
  day: "/assets/images/earth-blue-marble-2048.jpg",
  night: "/assets/images/earth-night.jpg",
  bump: "/assets/images/earth-topology.png",
  water: "/assets/images/earth-water.png",
};

const VERTEX_SHADER = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  attribute vec2 a_uv;
  uniform mat4 u_modelView;
  uniform mat4 u_projection;
  uniform mat3 u_normalMatrix;
  varying vec2 v_uv;
  varying vec3 v_normal;
  varying vec3 v_viewPosition;
  void main() {
    vec4 viewPosition = u_modelView * vec4(a_position, 1.0);
    v_uv = a_uv;
    v_normal = normalize(u_normalMatrix * a_normal);
    v_viewPosition = viewPosition.xyz;
    gl_Position = u_projection * viewPosition;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_day;
  uniform sampler2D u_night;
  uniform sampler2D u_bump;
  uniform sampler2D u_water;
  uniform float u_time;
  varying vec2 v_uv;
  varying vec3 v_normal;
  varying vec3 v_viewPosition;
  void main() {
    vec3 normal = normalize(v_normal);
    vec3 viewDir = normalize(-v_viewPosition);
    vec3 lightDir = normalize(vec3(-0.56, 0.42, 0.72));
    float rawLight = dot(normal, lightDir);
    float diffuse = max(rawLight, 0.0);
    float relief = texture2D(u_bump, v_uv).r;
    float water = texture2D(u_water, v_uv).r;
    vec3 day = texture2D(u_day, v_uv).rgb;
    vec3 night = texture2D(u_night, v_uv).rgb;
    vec3 dayColor = day * (0.27 + diffuse * 0.92) * mix(0.92, 1.08, relief);
    float nightSide = 1.0 - smoothstep(-0.18, 0.28, rawLight);
    vec3 nightColor = night * (0.58 + nightSide * 1.08);
    vec3 color = mix(dayColor, nightColor, nightSide * 0.82);
    vec3 halfVector = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfVector), 0.0), 64.0) * water * max(rawLight, 0.0);
    color += vec3(0.72, 0.88, 1.0) * specular * 0.32;
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.1);
    color += vec3(0.18, 0.52, 0.86) * fresnel * (0.56 + 0.08 * sin(u_time * 0.35));
    gl_FragColor = vec4(pow(max(color, 0.0), vec3(0.92)), 1.0);
  }
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function multiply4(left, right) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] = left[row] * right[column * 4]
        + left[4 + row] * right[column * 4 + 1]
        + left[8 + row] * right[column * 4 + 2]
        + left[12 + row] * right[column * 4 + 3];
    }
  }
  return result;
}

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0, 0, f, 0, 0,
    0, 0, (far + near) * range, -1, 0, 0, near * far * 2 * range, 0,
  ]);
}

function translation(x, y, z) {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
}

function rotationX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
}

function rotationY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
}

function makeSphere(latitudeBands = 72, longitudeBands = 128) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (let latIndex = 0; latIndex <= latitudeBands; latIndex += 1) {
    const v = latIndex / latitudeBands;
    const latitude = Math.PI / 2 - v * Math.PI;
    const cosLat = Math.cos(latitude);
    for (let lonIndex = 0; lonIndex <= longitudeBands; lonIndex += 1) {
      const u = lonIndex / longitudeBands;
      const longitude = -Math.PI + u * Math.PI * 2;
      const x = cosLat * Math.sin(longitude), y = Math.sin(latitude), z = cosLat * Math.cos(longitude);
      positions.push(x, y, z); normals.push(x, y, z); uvs.push(u, v);
    }
  }
  for (let lat = 0; lat < latitudeBands; lat += 1) {
    for (let lon = 0; lon < longitudeBands; lon += 1) {
      const first = lat * (longitudeBands + 1) + lon;
      const second = first + longitudeBands + 1;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint16Array(indices) };
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function createTexture(gl, image, unit) {
  const texture = gl.createTexture();
  const powerOfTwo = (value) => (value & (value - 1)) === 0;
  const canMipmap = powerOfTwo(image.naturalWidth) && powerOfTwo(image.naturalHeight);
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, canMipmap ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, canMipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  if (canMipmap) gl.generateMipmap(gl.TEXTURE_2D);
  return texture;
}

function rotatePoint(lat, lng, yaw, pitch) {
  const phi = lat * DEG, lambda = lng * DEG, cosPhi = Math.cos(phi);
  const x = cosPhi * Math.sin(lambda), y = Math.sin(phi), z = cosPhi * Math.cos(lambda);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), yawX = cy * x + sy * z, yawZ = -sy * x + cy * z;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return { x: yawX, y: cp * y - sp * yawZ, z: sp * y + cp * yawZ };
}

export function mountSectGlobe(root) {
  if (!root) return () => {};
  const canvas = root.querySelector("[data-globe-canvas]");
  const shell = root.querySelector(".sect-globe-shell");
  const labels = [...root.querySelectorAll(".globe-node")];
  if (!canvas || !shell) return () => {};
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "high-performance" });
  if (!gl) { root.classList.add("globe-fallback"); return () => {}; }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.info("朱雀星 WebGL 初始化失败，已使用静态回退", error);
    root.classList.add("globe-fallback");
    return () => {};
  }

  const sphere = makeSphere();
  gl.useProgram(program);
  const bindAttribute = (name, data, size) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  };
  bindAttribute("a_position", sphere.positions, 3);
  bindAttribute("a_normal", sphere.normals, 3);
  bindAttribute("a_uv", sphere.uvs, 2);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
  const uniforms = Object.fromEntries(["u_modelView", "u_projection", "u_normalMatrix", "u_day", "u_night", "u_bump", "u_water", "u_time"].map((name) => [name, gl.getUniformLocation(program, name)]));
  const nodes = labels.map((element) => ({ element, lat: Number(element.dataset.lat) || 0, lng: Number(element.dataset.lng) || 0 }));
  const cameraDistance = 3.22, fov = 38 * DEG;
  let yaw = -105 * DEG, pitch = -10 * DEG, dragging = false, lastX = 0, lastY = 0;
  let frame = 0, visible = true, ready = false, disposed = false, lastTime = performance.now(), resumeAt = 0;

  function resize() {
    const bounds = shell.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.max(320, Math.round(bounds.width * scale)), height = Math.max(320, Math.round(bounds.height * scale));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
    return { width, height };
  }

  function updateLabels(width, height) {
    const aspect = width / height, tangent = Math.tan(fov / 2);
    const candidates = [];
    for (const node of nodes) {
      const point = rotatePoint(node.lat, node.lng, yaw, pitch);
      const distance = cameraDistance - point.z;
      const ndcX = point.x / distance / tangent / aspect, ndcY = point.y / distance / tangent;
      const front = point.z > .04 && Math.abs(ndcX) < .98 && Math.abs(ndcY) < .98;
      node.element.style.setProperty("--depth", String(Math.max(0, point.z)));
      if (front) candidates.push({ node, point, x: (ndcX * .5 + .5) * width, y: (.5 - ndcY * .5) * height });
      else {
        node.element.style.opacity = "0";
        node.element.style.pointerEvents = "none";
        node.element.tabIndex = -1;
      }
    }
    const placed = [];
    candidates.sort((a, b) => b.point.z - a.point.z).forEach((item) => {
      const elementWidth = Math.max(34, item.node.element.offsetWidth || 34);
      const elementHeight = Math.max(24, item.node.element.offsetHeight || 24);
      const offsets = [0, -24, 24, -48, 48];
      let chosen = null;
      for (const offset of offsets) {
        const x = Math.max(18, Math.min(width - elementWidth / 2 - 6, item.x));
        const y = Math.max(18, Math.min(height - 18, item.y + offset));
        const box = { left: x - elementWidth / 2, right: x + elementWidth / 2, top: y - elementHeight / 2, bottom: y + elementHeight / 2 };
        if (!placed.some((other) => box.left < other.right + 6 && box.right + 6 > other.left && box.top < other.bottom + 5 && box.bottom + 5 > other.top)) {
          chosen = box;
          item.y = y;
          item.x = x;
          break;
        }
      }
      const visible = Boolean(chosen);
      if (chosen) placed.push(chosen);
      item.node.element.style.setProperty("--gx", `${item.x}px`);
      item.node.element.style.setProperty("--gy", `${item.y}px`);
      item.node.element.style.opacity = visible ? String(.52 + item.point.z * .48) : "0";
      item.node.element.style.pointerEvents = visible ? "auto" : "none";
      item.node.element.tabIndex = visible ? 0 : -1;
    });
  }

  function draw(now = performance.now()) {
    if (disposed || !visible || document.hidden || !ready) return;
    const { width, height } = resize();
    if (!reducedMotion && !dragging && now > resumeAt) yaw += Math.min(40, now - lastTime) * .000006;
    lastTime = now;
    const model = multiply4(rotationX(pitch), rotationY(yaw));
    const modelView = multiply4(translation(0, 0, -cameraDistance), model);
    const projection = perspective(fov, width / height, .1, 20);
    const normal = new Float32Array([model[0],model[1],model[2], model[4],model[5],model[6], model[8],model[9],model[10]]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.uniformMatrix4fv(uniforms.u_modelView, false, modelView);
    gl.uniformMatrix4fv(uniforms.u_projection, false, projection);
    gl.uniformMatrix3fv(uniforms.u_normalMatrix, false, normal);
    gl.uniform1f(uniforms.u_time, now / 1000);
    gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
    updateLabels(width, height);
    if (!reducedMotion) frame = requestAnimationFrame(draw);
  }

  Promise.all(Object.values(EARTH_TEXTURES).map(loadImage)).then((images) => {
    if (disposed) return;
    images.forEach((image, index) => createTexture(gl, image, index));
    gl.useProgram(program);
    gl.uniform1i(uniforms.u_day, 0); gl.uniform1i(uniforms.u_night, 1); gl.uniform1i(uniforms.u_bump, 2); gl.uniform1i(uniforms.u_water, 3);
    ready = true; root.classList.add("globe-ready");
    const wasVisible = visible;
    visible = true;
    draw();
    visible = wasVisible;
    if (!visible) cancelAnimationFrame(frame);
  }).catch((error) => { console.info("朱雀星纹理不可用，已使用静态回退", error); root.classList.add("globe-fallback"); });

  function onPointerDown(event) { dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture?.(event.pointerId); }
  function onPointerMove(event) {
    if (!dragging) return;
    yaw += (event.clientX - lastX) * .006;
    pitch = Math.max(-.72, Math.min(.72, pitch + (event.clientY - lastY) * .004));
    lastX = event.clientX; lastY = event.clientY;
    if (reducedMotion) draw();
  }
  function onPointerUp(event) { dragging = false; resumeAt = performance.now() + 2200; canvas.releasePointerCapture?.(event.pointerId); }
  function onVisibility() { cancelAnimationFrame(frame); if (!document.hidden && visible && ready) { lastTime = performance.now(); draw(); } }
  canvas.addEventListener("pointerdown", onPointerDown); canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp); canvas.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("visibilitychange", onVisibility);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting; cancelAnimationFrame(frame);
    if (visible && !document.hidden && ready) { lastTime = performance.now(); draw(); }
  }, { threshold: .02 });
  observer.observe(root);
  const resizeObserver = new ResizeObserver(() => { if (ready && visible) draw(); });
  resizeObserver.observe(shell);
  root.classList.add("globe-mounted");

  return () => {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown); canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp); canvas.removeEventListener("pointercancel", onPointerUp);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
