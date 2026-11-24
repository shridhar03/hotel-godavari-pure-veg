// -----------------------------------------------------------------------------
// Fireflies / golden dust: GPU-animated point sprites.
// Each point drifts on its own Lissajous path (driven by aSeed) so the CPU
// never touches the buffer after creation.
// -----------------------------------------------------------------------------
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
uniform float uCamZ;      // wrap the field around the camera as it travels down the river
attribute float aSeed;
varying float vAlpha;
void main() {
  vec3 p = position;
  float t = uTime * (0.25 + aSeed * 0.35);
  p.x += sin(t + aSeed * 31.0) * 0.6;
  p.y += sin(t * 1.3 + aSeed * 17.0) * 0.35;
  p.z += cos(t * 0.8 + aSeed * 11.0) * 0.6;
  // keep particles in a 60-unit window ahead of the camera
  p.z = uCamZ - mod(uCamZ - p.z, 60.0) + 6.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.5 + aSeed) * (12.0 / -mv.z);
  vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 40.0));
}
