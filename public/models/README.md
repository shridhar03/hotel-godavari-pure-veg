# 3D models (placeholders)

Drop DRACO-compressed `.glb` files here and reference them from `public/data/signature.json` (`"model": "models/thali.glb"`) or `public/data/rooms.json`.

Compress with:

```bash
npx gltf-transform optimize input.glb output.glb --compress draco --texture-compress webp
# or KTX2 textures:
npx gltf-transform optimize input.glb output.glb --compress draco --texture-compress ktx2
```

Until a model is set, the site renders procedural low-poly placeholders.
