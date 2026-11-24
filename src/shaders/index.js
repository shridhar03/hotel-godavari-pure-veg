/**
 * Shader sources are kept in .glsl files (imported as raw strings by Vite)
 * so they get syntax highlighting and readable comments. Shared noise helpers
 * are prepended where needed.
 */
import noise from './noise.glsl?raw';
import waterVert from './water.vert.glsl?raw';
import waterFragRaw from './water.frag.glsl?raw';
import skyVert from './sky.vert.glsl?raw';
import skyFragRaw from './sky.frag.glsl?raw';
import flameVert from './flame.vert.glsl?raw';
import flameFragRaw from './flame.frag.glsl?raw';
import firefliesVert from './fireflies.vert.glsl?raw';
import firefliesFrag from './fireflies.frag.glsl?raw';
import rippleVert from './ripple.vert.glsl?raw';
import rippleFrag from './ripple.frag.glsl?raw';

const withNoise = (src) => noise + '\n' + src;

export const water = { vertexShader: waterVert, fragmentShader: withNoise(waterFragRaw) };
export const sky = { vertexShader: skyVert, fragmentShader: withNoise(skyFragRaw) };
export const flame = { vertexShader: flameVert, fragmentShader: withNoise(flameFragRaw) };
export const fireflies = { vertexShader: firefliesVert, fragmentShader: firefliesFrag };
export const ripple = { vertexShader: rippleVert, fragmentShader: rippleFrag };
