// Gallery plane: a 1x1 quad scaled/positioned in pixels to match its DOM <img>.
varying vec2 vUv;
uniform float uHover;
uniform vec2 uMouse;
void main() {
  vUv = uv;
  vec3 p = position;
  // slight bulge toward the mouse while hovered
  float d = distance(uv, uMouse);
  p.z += uHover * 30.0 * exp(-d * d * 8.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
