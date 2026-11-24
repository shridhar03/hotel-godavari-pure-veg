uniform float uNight;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);       // soft round sprite
  a = pow(a, 1.6) * vAlpha * mix(0.55, 1.0, uNight);
  vec3 col = mix(vec3(1.0, 0.78, 0.35), vec3(1.0, 0.85, 0.45), uNight);
  gl_FragColor = vec4(col, a);
}
