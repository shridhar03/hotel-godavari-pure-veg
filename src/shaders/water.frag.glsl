// -----------------------------------------------------------------------------
// Godavari water — fragment shader
// Lighting model:
//   1. Detail normals from scrolling fbm noise (small ripples flowing downstream)
//   2. Fresnel (Schlick) blends deep river colour with the reflected sky
//   3. Sky reflection = same gradient as the sky dome, sampled with the
//      reflected view vector
//   4. Sun (day) / moon (night) specular highlight
//   5. Warm glints under each floating diya (cheap fake reflection of the flame)
//   6. Distance fog into the horizon colour
// uNight (0 → 1) cross-fades every colour between the day and night palettes.
// -----------------------------------------------------------------------------
#define MAX_DIYAS 16

uniform float uTime;
uniform float uNight;
uniform vec3  uDeepDay;
uniform vec3  uDeepNight;
uniform vec3  uSkyTopDay;
uniform vec3  uSkyTopNight;
uniform vec3  uHorizonDay;
uniform vec3  uHorizonNight;
uniform vec3  uSunDir;
uniform vec3  uDiyas[MAX_DIYAS];
uniform int   uDiyaCount;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

// noise.glsl is prepended at build time

vec3 skyColor(vec3 dir, vec3 top, vec3 horizon) {
  float t = clamp(dir.y * 1.6, 0.0, 1.0);
  return mix(horizon, top, pow(t, 0.6));
}

void main() {
  vec3 deep    = mix(uDeepDay, uDeepNight, uNight);
  vec3 skyTop  = mix(uSkyTopDay, uSkyTopNight, uNight);
  vec3 horizon = mix(uHorizonDay, uHorizonNight, uNight);

  // 1. ripple normals: two fbm layers flowing toward the camera (+z) at different speeds
  vec2 uv = vWorldPos.xz;
  float e = 0.15;
  vec2 flowA = uv * 0.55 + vec2(0.0, -uTime * 0.35);
  vec2 flowB = uv * 1.30 + vec2(uTime * 0.05, -uTime * 0.6);
  float n  = fbm(flowA) + 0.5 * fbm(flowB);
  float nx = fbm(flowA + vec2(e, 0.0)) + 0.5 * fbm(flowB + vec2(e, 0.0));
  float nz = fbm(flowA + vec2(0.0, e)) + 0.5 * fbm(flowB + vec2(0.0, e));
  vec3 N = normalize(vNormal + vec3((n - nx) * 1.4, 0.0, (n - nz) * 1.4));

  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 R = reflect(-V, N);

  // 2. Schlick fresnel (F0 ≈ 0.02 for water)
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);

  // 3. reflected sky
  vec3 refl = skyColor(R, skyTop, horizon);

  // body colour: lighter on wave crests for a hint of subsurface scattering
  vec3 body = deep + vec3(0.04, 0.10, 0.10) * smoothstep(-0.1, 0.25, vHeight) * (1.0 - uNight * 0.7);

  vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));

  // 4. specular highlight: warm sun by day, cool moon by night
  vec3 L = normalize(uSunDir);
  float spec = pow(max(dot(R, L), 0.0), mix(180.0, 400.0, uNight));
  vec3 specCol = mix(vec3(1.0, 0.82, 0.5), vec3(0.75, 0.85, 1.0), uNight);
  col += specCol * spec * mix(2.2, 1.2, uNight);

  // 5. diya glints: stretched towards the viewer like real light streaks on water
  vec3 glint = vec3(0.0);
  for (int i = 0; i < MAX_DIYAS; i++) {
    if (i >= uDiyaCount) break;
    vec3 d = uDiyas[i];
    vec2 diff = vWorldPos.xz - d.xz;
    // elongate along the camera → diya axis
    vec2 toCam = normalize(cameraPosition.xz - d.xz);
    float along = dot(diff, toCam);
    float across = dot(diff, vec2(-toCam.y, toCam.x));
    float streak = exp(-across * across * 18.0) * exp(-max(along, 0.0) * 0.9) * smoothstep(-0.6, 0.0, along);
    float flicker = 0.75 + 0.25 * sin(uTime * 9.0 + float(i) * 1.7) * (n * 0.8 + 0.6);
    glint += vec3(1.0, 0.62, 0.18) * streak * flicker;
  }
  col += glint * mix(0.55, 1.5, uNight);

  // 6. fog to horizon
  float dist = length(cameraPosition - vWorldPos);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, horizon, fog);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
