/**
 * Lazy model / texture loading.
 * GLTFLoader + DRACOLoader + KTX2Loader are only downloaded when a real model is configured
 * in the JSON data (e.g. "model": "models/thali.glb"), so the placeholder build ships none of them.
 *
 * The DRACO decoder and Basis (KTX2) transcoder are self-hosted: three.js r17x+ references them
 * with `new URL(..., import.meta.url)`, so Vite copies them into dist/assets automatically.
 * They are only fetched when a model actually needs them.
 */
import * as THREE from 'three';
import { asset } from './data.js';

let gltfLoaderPromise;
function getGLTFLoader(renderer) {
  if (!gltfLoaderPromise) {
    gltfLoaderPromise = Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
      import('three/examples/jsm/loaders/KTX2Loader.js'),
    ]).then(([{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }]) => {
      const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader());
      if (renderer) loader.setKTX2Loader(new KTX2Loader().detectSupport(renderer));
      return loader;
    });
  }
  return gltfLoaderPromise;
}

/** Load a (DRACO/KTX2-compressed) GLB and return its scene root. */
export async function loadGLB(path, renderer) {
  const loader = await getGLTFLoader(renderer);
  const gltf = await loader.loadAsync(asset(path));
  return gltf.scene;
}

const texLoader = new THREE.TextureLoader();
/** Load a WebP/JPG texture as sRGB. */
export function loadTexture(path) {
  return texLoader.loadAsync(asset(path)).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}
