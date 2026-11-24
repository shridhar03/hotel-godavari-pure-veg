// -----------------------------------------------------------------------------
// Godavari water — vertex shader
// Displaces a flat, subdivided plane with a sum of directional sine waves
// (a light-weight Gerstner approximation). The normal is rebuilt from the
// analytic partial derivatives so lighting stays smooth at any resolution.
//
// IMPORTANT: waveHeight() is mirrored in JS (scenes/RiverScene.js → waveHeight)
// so floating diyas and lotuses bob exactly on the surface.
// -----------------------------------------------------------------------------
uniform float uTime;
uniform float uAmp;          // overall wave amplitude

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

// direction (xy), frequency (z), speed (w)
const vec4 W0 = vec4( 0.20,  1.00, 0.35, 1.10);
const vec4 W1 = vec4(-0.55,  0.80, 0.55, 1.45);
const vec4 W2 = vec4( 0.85,  0.45, 0.90, 1.90);
const vec4 W3 = vec4(-0.15,  1.00, 1.60, 2.60);
const vec4 AMPS = vec4(0.18, 0.10, 0.05, 0.025);

// Returns height in .x and d/dx, d/dz in .yz
vec3 wave(vec2 p, vec4 w, float a) {
  vec2 d = normalize(w.xy);
  float ph = dot(d, p) * w.z + uTime * w.w;
  float h = sin(ph) * a;
  float dh = cos(ph) * a * w.z;
  return vec3(h, d.x * dh, d.y * dh);
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec2 p = world.xz;

  vec3 s = wave(p, W0, AMPS.x) + wave(p, W1, AMPS.y) + wave(p, W2, AMPS.z) + wave(p, W3, AMPS.w);
  s *= uAmp;

  world.y += s.x;
  vHeight = s.x;
  vNormal = normalize(vec3(-s.y, 1.0, -s.z));
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
