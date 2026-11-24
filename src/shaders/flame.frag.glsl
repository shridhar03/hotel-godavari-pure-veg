// -----------------------------------------------------------------------------
// Diya flame
// A teardrop distance field, distorted upward by scrolling noise, coloured with
// a white-hot core → saffron → deep orange edge. uIntensity (0..1) scales size
// and brightness, which is how the preloader "brightens as assets load".
// -----------------------------------------------------------------------------
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
varying vec2 vUv;

// noise.glsl is prepended at build time

void main() {
  vec2 p = vUv - vec2(0.5, 0.18);         // origin near the wick
  float n = fbm(vec2(p.x * 3.0 + uSeed, p.y * 2.5 - uTime * 2.4));
  p.x += (n - 0.5) * 0.18 * smoothstep(0.0, 0.6, p.y);   // noise only bends the upper flame

  // teardrop: circle at the base that narrows to a tip
  float h = clamp(p.y / (0.62 * (0.55 + 0.45 * uIntensity)), 0.0, 1.0);
  float width = mix(0.2, 0.0, pow(h, 1.25)) * (0.7 + 0.3 * uIntensity);
  float d = abs(p.x) / max(width, 1e-3);
  float body = (1.0 - smoothstep(0.55, 1.0, d)) * step(-0.12, p.y) * (1.0 - smoothstep(0.85, 1.0, h));
  body *= smoothstep(-0.12, 0.0, p.y + length(vec2(p.x, 0.0)) * 0.6);

  float core = (1.0 - smoothstep(0.0, 0.5, d)) * (1.0 - smoothstep(0.1, 0.55, h));

  vec3 edge = vec3(0.95, 0.32, 0.05);
  vec3 mid  = vec3(1.0, 0.66, 0.0);       // saffron #F4A300-ish
  vec3 hot  = vec3(1.0, 0.97, 0.85);
  vec3 col = mix(edge, mid, smoothstep(0.2, 0.9, 1.0 - d));
  col = mix(col, hot, core);
  // faint blue base like a real oil flame
  col = mix(col, vec3(0.3, 0.45, 1.0), (1.0 - smoothstep(0.0, 0.08, p.y + 0.05)) * 0.5 * body);

  float flicker = 0.85 + 0.15 * sin(uTime * 13.0 + uSeed * 10.0);
  float alpha = body * flicker * (0.35 + 0.65 * uIntensity);
  gl_FragColor = vec4(col * (0.8 + 1.4 * uIntensity), alpha);
  #include <colorspace_fragment>
}
