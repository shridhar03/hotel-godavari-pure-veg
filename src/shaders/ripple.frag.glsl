// -----------------------------------------------------------------------------
// Gallery hover: water-ripple distortion + RGB split centred on the mouse.
// - uHover eases 0 → 1 on mouseenter (GSAP), so the effect fades in and out
// - uCover emulates CSS object-fit: cover for any image / plane aspect ratio
// -----------------------------------------------------------------------------
uniform sampler2D uTex;
uniform float uTime;
uniform float uHover;
uniform vec2  uMouse;
uniform vec2  uCover;     // (planeAspect / imageAspect) correction
uniform float uRadius;    // rounded corners in uv units
uniform vec2  uSize;      // plane size in px
uniform float uAlpha;
varying vec2 vUv;

vec2 coverUv(vec2 uv) {
  return (uv - 0.5) * uCover + 0.5;
}

float roundedMask(vec2 uv) {
  vec2 px = uv * uSize;
  vec2 halfSize = uSize * 0.5;
  vec2 q = abs(px - halfSize) - (halfSize - uRadius);
  float d = length(max(q, 0.0)) - uRadius;
  return 1.0 - smoothstep(-1.0, 1.0, d);
}

void main() {
  vec2 uv = vUv;
  vec2 toM = uv - uMouse;
  float dist = length(toM * vec2(uSize.x / uSize.y, 1.0));
  // concentric ripple travelling outward from the cursor
  float wave = sin(dist * 38.0 - uTime * 6.0) * exp(-dist * 4.5);
  vec2 offs = normalize(toM + 1e-5) * wave * 0.018 * uHover;
  // gentle zoom on hover
  uv = (uv - 0.5) * (1.0 - 0.06 * uHover) + 0.5;

  vec2 cuv = coverUv(uv + offs);
  float split = 0.006 * uHover * exp(-dist * 3.0);
  float r = texture2D(uTex, cuv + vec2(split, 0.0)).r;
  float g = texture2D(uTex, cuv).g;
  float b = texture2D(uTex, cuv - vec2(split, 0.0)).b;
  vec3 col = vec3(r, g, b);
  // warm saffron tint near the cursor
  col += vec3(0.25, 0.15, 0.0) * uHover * exp(-dist * 6.0) * 0.5;

  gl_FragColor = vec4(col, roundedMask(vUv) * uAlpha);
  #include <colorspace_fragment>
}
