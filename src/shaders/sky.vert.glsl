// Sky dome: pass the view direction to the fragment shader.
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // push to far plane so the dome never clips scene geometry
}
