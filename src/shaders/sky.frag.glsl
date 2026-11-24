// -----------------------------------------------------------------------------
// Sky dome: vertical gradient + soft sun (day) / moon & twinkling stars (night)
// Shares its gradient function with the water so reflections line up.
// -----------------------------------------------------------------------------
uniform float uTime;
uniform float uNight;
uniform vec3 uSkyTopDay;
uniform vec3 uSkyTopNight;
uniform vec3 uHorizonDay;
uniform vec3 uHorizonNight;
uniform vec3 uSunDir;
varying vec3 vDir;

// noise.glsl is prepended at build time

void main() {
  vec3 d = normalize(vDir);
  vec3 top = mix(uSkyTopDay, uSkyTopNight, uNight);
  vec3 hor = mix(uHorizonDay, uHorizonNight, uNight);
  float t = clamp(d.y * 1.6, 0.0, 1.0);
  vec3 col = mix(hor, top, pow(t, 0.6));

  // sun / moon disc with halo
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  vec3 sunCol = mix(vec3(1.0, 0.78, 0.42), vec3(0.85, 0.9, 1.0), uNight);
  col += sunCol * (pow(s, mix(900.0, 2400.0, uNight)) * 3.0 + pow(s, 12.0) * mix(0.35, 0.12, uNight));

  // stars: hash a 3D grid on the unit sphere so they stay round at any angle,
  // only visible at night and above the horizon
  vec3 sp = d * 140.0;
  vec3 cell = floor(sp);
  float h = hash21(cell.xy + cell.z * 17.31);
  float star = step(0.993, h) * smoothstep(0.45, 0.1, length(fract(sp) - 0.5));
  star *= 0.6 + 0.4 * sin(uTime * 2.0 + h * 50.0);
  col += vec3(1.0, 0.95, 0.85) * star * uNight * smoothstep(0.02, 0.2, d.y);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
