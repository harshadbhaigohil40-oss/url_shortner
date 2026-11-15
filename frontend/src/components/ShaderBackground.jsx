import React, { useEffect, useRef } from 'react';

const ShaderBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function syncSize() {
      const w = Math.max(canvas.clientWidth || window.innerWidth, 1);
      const h = Math.max(canvas.clientHeight || window.innerHeight, 1);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', syncSize);
    }
    syncSize();

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      return () => {
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener('resize', syncSize);
      };
    }

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
    const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

void main() {
    vec2 uv = v_texCoord;
    vec2 p = (uv - 0.5) * 2.0;
    float safeY = max(u_resolution.y, 1.0);
    p.x *= u_resolution.x / safeY;

    float t = u_time * 0.3;
    
    // Orb 1: Blue/Purple
    vec2 pos1 = vec2(0.5 * sin(t), 0.3 * cos(t * 0.8));
    float dist1 = length(p - pos1);
    float glow1 = 0.15 / (dist1 + 0.4);
    vec3 col1 = vec3(0.2, 0.4, 1.0) * glow1;

    // Orb 2: Purple/Violet
    vec2 pos2 = vec2(-0.4 * cos(t * 0.7), -0.5 * sin(t * 1.1));
    float dist2 = length(p - pos2);
    float glow2 = 0.12 / (dist2 + 0.4);
    vec3 col2 = vec3(0.6, 0.2, 1.0) * glow2;

    // Orb 3: Deep Navy Glow
    vec2 pos3 = vec2(0.7 * cos(t * 0.5), -0.2 * sin(t * 0.9));
    float dist3 = length(p - pos3);
    float glow3 = 0.1 / (dist3 + 0.5);
    vec3 col3 = vec3(0.1, 0.3, 0.8) * glow3;

    // Mouse Tracking Glow
    vec2 mPos = (u_mouse / max(u_resolution, vec2(1.0, 1.0)) - 0.5) * 2.0;
    mPos.x *= u_resolution.x / safeY;
    float distMouse = length(p - mPos);
    float glowMouse = 0.08 / (distMouse + 0.3);
    vec3 colMouse = vec3(0.3, 0.6, 1.0) * glowMouse;

    vec3 finalCol = col1 + col2 + col3 + colMouse;
    
    // Dark background fade
    finalCol *= 0.8;
    
    gl_FragColor = vec4(finalCol, 1.0);
}`;

    function cs(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const vsShader = cs(gl.VERTEX_SHADER, vs);
    const fsShader = cs(gl.FRAGMENT_SHADER, fs);
    if (!vsShader || !fsShader) {
      if (vsShader) gl.deleteShader(vsShader);
      if (fsShader) gl.deleteShader(fsShader);
      return () => {
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener('resize', syncSize);
      };
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vsShader);
    gl.attachShader(prog, fsShader);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      gl.deleteShader(vsShader);
      gl.deleteShader(fsShader);
      return () => {
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener('resize', syncSize);
      };
    }

    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    
    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mouse.x = nx * canvas.width;
        mouse.y = ny * canvas.height;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId;
    let isPaused = false;

    function render(t) {
      if (isPaused) return;
      if (typeof ResizeObserver === 'undefined') syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    }

    const handleVisibility = () => {
      if (document.hidden) {
        isPaused = true;
        cancelAnimationFrame(animationFrameId);
      } else {
        if (isPaused) {
          isPaused = false;
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', syncSize);
      cancelAnimationFrame(animationFrameId);
      if (gl) {
        if (buf) gl.deleteBuffer(buf);
        if (prog) gl.deleteProgram(prog);
        if (vsShader) gl.deleteShader(vsShader);
        if (fsShader) gl.deleteShader(fsShader);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
};

export default ShaderBackground;
