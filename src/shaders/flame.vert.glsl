// Flame billboard: a plane that always faces the camera (cylindrical billboard).
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 pos = position;
  // sway the tip of the flame a little
  float sway = sin(uTime * 3.1 + uSeed * 6.28) * 0.06 + sin(uTime * 7.3 + uSeed * 3.0) * 0.025;
  pos.x += sway * uv.y * uv.y;
  // billboard: take the model's world position, add the camera-facing offset
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 scale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
  mv.xy += pos.xy * scale.xy;
  gl_Position = projectionMatrix * mv;
}
