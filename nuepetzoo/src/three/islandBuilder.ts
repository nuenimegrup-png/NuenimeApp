import * as THREE from 'three';
import {
  ISLAND_THEMES_LIST,
  IslandThemeConfig,
  IslandThemeId,
  TimeOfDay,
} from '../types/pet';

export interface IslandEnvironmentRefs {
  islandGroup: THREE.Group;
  cloudsGroup: THREE.Group;
  pondWaterMesh: THREE.Mesh;
  pondRippleRing: THREE.Mesh;
  waterfallStreamMesh: THREE.Mesh;
  waterfallMistGroup: THREE.Group;
  treeCanopyGroups: THREE.Group[];
  dustMotesPoints: THREE.Points;
  pondLocation: THREE.Vector3;
  treeLocation: THREE.Vector3;
  keyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  lanternLights: THREE.PointLight[];
  // Dynamic theme material refs
  grassMat: THREE.MeshStandardMaterial;
  knollMat: THREE.MeshStandardMaterial;
  cliffRockMat: THREE.MeshStandardMaterial;
  instancedBoulders: THREE.InstancedMesh;
  boulderCount: number;
  waterMat: THREE.MeshStandardMaterial;
  waterfallMat: THREE.MeshBasicMaterial;
  treeFoliageMats: [
    THREE.MeshStandardMaterial,
    THREE.MeshStandardMaterial,
    THREE.MeshStandardMaterial,
  ][];
  shrubMat1: THREE.MeshStandardMaterial;
  shrubMat2: THREE.MeshStandardMaterial;
  // Dynamic Weather System (Light Rain + Occasional Lightning for Inferno Hell & Abyss Island)
  rainLineSegments: THREE.LineSegments;
  rainMat: THREE.LineBasicMaterial;
  lightningBoltGroup: THREE.Group;
  lightningMainLine: THREE.Line;
  lightningBranchLine: THREE.Line;
  lightningImpactRing: THREE.Mesh;
  lightningFlashLight: THREE.PointLight;
}

// Shared unit geometries to minimize GPU memory & draw-call overhead on mobile
const SHARED_SPHERE_GEO = new THREE.SphereGeometry(1, 14, 12);
const SHARED_CLOUD_GEO = new THREE.SphereGeometry(1, 12, 10);

const grassTexCache = new Map<IslandThemeId, THREE.CanvasTexture>();
const rockTexCache = new Map<IslandThemeId, THREE.CanvasTexture>();
const waterTexCache = new Map<IslandThemeId, THREE.CanvasTexture>();
const waterfallTexCache = new Map<IslandThemeId, THREE.CanvasTexture>();

function freezeStaticObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    child.updateMatrix();
    child.matrixAutoUpdate = false;
  });
}

function getThemeConfig(themeId: IslandThemeId): IslandThemeConfig {
  return (
    ISLAND_THEMES_LIST.find((t) => t.id === themeId) || ISLAND_THEMES_LIST[0]
  );
}

/**
 * Multi-tone stylized ground texture tailored to each Island Theme (Emerald, Abyss, Neraka/Inferno, Glacier, etc.)
 */
function createRichMultiToneGrassTexture(
  theme: IslandThemeConfig,
  maxAnisotropy: number
): THREE.CanvasTexture {
  if (grassTexCache.has(theme.id)) {
    return grassTexCache.get(theme.id)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const baseGrad = ctx.createRadialGradient(240, 240, 30, 256, 256, 256);
  baseGrad.addColorStop(0.0, theme.grassStops[0]);
  baseGrad.addColorStop(0.32, theme.grassStops[1]);
  baseGrad.addColorStop(0.64, theme.grassStops[2]);
  baseGrad.addColorStop(0.86, theme.grassStops[3]);
  baseGrad.addColorStop(1.0, theme.grassStops[4]);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Winding path / magma crack / void vein toward bridge & pond
  ctx.save();
  ctx.strokeStyle = theme.pathColor;
  ctx.lineWidth = theme.id === 'inferno_hell' || theme.id === 'abyss_void' ? 18 : 26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(165, 310);
  ctx.quadraticCurveTo(256, 260, 385, 355);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(256, 260);
  ctx.quadraticCurveTo(305, 205, 345, 170);
  ctx.stroke();
  ctx.restore();

  // Speckles / glowing embers / void crystals
  const speckleColor =
    theme.id === 'inferno_hell'
      ? 'rgba(251, 146, 60, 0.38)'
      : theme.id === 'abyss_void'
      ? 'rgba(56, 189, 248, 0.35)'
      : 'rgba(255, 255, 255, 0.18)';

  for (let i = 0; i < 950; i++) {
    const angle = (i * 137.5) % (Math.PI * 2);
    const dist = Math.sqrt((i + 1) / 950) * 245;
    const x = 256 + Math.cos(angle) * dist;
    const y = 256 + Math.sin(angle) * dist;
    ctx.fillStyle = i % 2 === 0 ? speckleColor : 'rgba(0, 0, 0, 0.14)';
    ctx.beginPath();
    ctx.ellipse(x, y, 1.6, 3.2, (i % 7) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 4);
  grassTexCache.set(theme.id, tex);
  return tex;
}

function createLayeredRockTexture(
  theme: IslandThemeConfig,
  maxAnisotropy: number
): THREE.CanvasTexture {
  if (rockTexCache.has(theme.id)) {
    return rockTexCache.get(theme.id)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, theme.rockStops[0]);
  grad.addColorStop(0.28, theme.rockStops[1]);
  grad.addColorStop(0.62, theme.rockStops[2]);
  grad.addColorStop(1.0, theme.rockStops[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 12) {
    ctx.fillStyle =
      theme.id === 'inferno_hell' && y % 36 === 0
        ? 'rgba(249, 115, 22, 0.28)'
        : theme.id === 'abyss_void' && y % 36 === 0
        ? 'rgba(168, 85, 247, 0.25)'
        : y % 24 === 0
        ? 'rgba(255, 248, 235, 0.08)'
        : 'rgba(15, 10, 8, 0.12)';
    ctx.fillRect(0, y, 256, 5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 4);
  rockTexCache.set(theme.id, tex);
  return tex;
}

function createLagoonWaterTexture(
  theme: IslandThemeConfig
): THREE.CanvasTexture {
  if (waterTexCache.has(theme.id)) {
    return waterTexCache.get(theme.id)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
  grad.addColorStop(0.0, theme.waterStops[0]);
  grad.addColorStop(0.55, theme.waterStops[1]);
  grad.addColorStop(0.85, theme.waterStops[2]);
  grad.addColorStop(1.0, theme.waterStops[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  waterTexCache.set(theme.id, tex);
  return tex;
}

function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(10, 24, 10, 0.58)');
  grad.addColorStop(0.55, 'rgba(12, 30, 12, 0.3)');
  grad.addColorStop(1, 'rgba(12, 30, 12, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWaterfallTexture(theme: IslandThemeConfig): THREE.CanvasTexture {
  if (waterfallTexCache.has(theme.id)) {
    return waterfallTexCache.get(theme.id)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = theme.waterfallColor;
  ctx.fillRect(0, 0, 128, 256);

  ctx.fillStyle =
    theme.id === 'inferno_hell'
      ? 'rgba(254, 240, 138, 0.78)'
      : 'rgba(255, 255, 255, 0.65)';
  for (let i = 0; i < 26; i++) {
    const x = (i * 19) % 118;
    const y = (i * 37) % 220;
    ctx.fillRect(x, y, 7, 38);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  waterfallTexCache.set(theme.id, tex);
  return tex;
}

const SHARED_SMOOTH_BOULDER_GEO = (() => {
  const geo = new THREE.SphereGeometry(0.55, 14, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const wave = 1 + 0.08 * Math.sin(vx * 2.2 + vy * 1.7) * Math.cos(vz * 2.1);
    pos.setXYZ(i, vx * wave, vy * wave, vz * wave);
  }
  geo.computeVertexNormals();
  return geo;
})();

function createSmoothRoundedBoulder(
  radiusScale: number,
  mat: THREE.Material,
  scaleX: number,
  scaleY: number,
  scaleZ: number
): THREE.Mesh {
  const s = radiusScale / 0.55;
  const mesh = new THREE.Mesh(SHARED_SMOOTH_BOULDER_GEO, mat);
  mesh.scale.set(scaleX * s, scaleY * s, scaleZ * s);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createSmoothStylizedTree(
  trunkMat: THREE.Material,
  foliageColors: [number, number, number],
  scale: number = 1.0
): {
  root: THREE.Group;
  canopy: THREE.Group;
  foliageMats: [
    THREE.MeshStandardMaterial,
    THREE.MeshStandardMaterial,
    THREE.MeshStandardMaterial,
  ];
} {
  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 1.65, 12, 3);
  const tPos = trunkGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    const bend = Math.sin((y + 0.8) * 1.4) * 0.08;
    tPos.setX(i, tPos.getX(i) + bend);
  }
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.updateMatrix();
  trunk.matrixAutoUpdate = false;
  root.add(trunk);

  for (let r = 0; r < 4; r++) {
    const angle = (r / 4) * Math.PI * 2 + 0.4;
    const rootLobe = new THREE.Mesh(SHARED_SPHERE_GEO, trunkMat);
    rootLobe.scale.set(0.22 * 1.4, 0.22 * 0.55, 0.22 * 0.85);
    rootLobe.rotation.y = angle;
    rootLobe.position.set(
      Math.cos(angle) * 0.28,
      0.08,
      Math.sin(angle) * 0.28
    );
    rootLobe.castShadow = true;
    rootLobe.receiveShadow = true;
    rootLobe.updateMatrix();
    rootLobe.matrixAutoUpdate = false;
    root.add(rootLobe);
  }

  const canopy = new THREE.Group();
  canopy.position.y = 1.78;
  root.add(canopy);

  const bottomMat = new THREE.MeshStandardMaterial({
    color: foliageColors[0],
    roughness: 0.78,
    metalness: 0.02,
  });
  const midMat = new THREE.MeshStandardMaterial({
    color: foliageColors[1],
    roughness: 0.74,
    metalness: 0.02,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: foliageColors[2],
    roughness: 0.7,
    metalness: 0.02,
  });

  const lowerPuffs = [
    [-0.58, -0.1, 0.35, 0.74],
    [0.6, -0.08, 0.32, 0.75],
    [0.08, -0.08, -0.58, 0.76],
    [-0.42, -0.06, -0.42, 0.68],
  ];
  lowerPuffs.forEach(([px, py, pz, rad]) => {
    const puff = new THREE.Mesh(SHARED_SPHERE_GEO, bottomMat);
    puff.scale.set(rad * 1.12, rad * 0.82, rad * 1.12);
    puff.position.set(px, py, pz);
    puff.castShadow = true;
    puff.receiveShadow = true;
    puff.updateMatrix();
    puff.matrixAutoUpdate = false;
    canopy.add(puff);
  });

  const midPuffs = [
    [0, 0.2, 0, 0.96],
    [-0.38, 0.26, 0.24, 0.72],
    [0.38, 0.24, -0.18, 0.7],
  ];
  midPuffs.forEach(([px, py, pz, rad]) => {
    const puff = new THREE.Mesh(SHARED_SPHERE_GEO, midMat);
    puff.scale.set(rad * 1.1, rad * 0.86, rad * 1.1);
    puff.position.set(px, py, pz);
    puff.castShadow = true;
    puff.receiveShadow = true;
    puff.updateMatrix();
    puff.matrixAutoUpdate = false;
    canopy.add(puff);
  });

  const crown = new THREE.Mesh(SHARED_SPHERE_GEO, topMat);
  crown.scale.set(0.68 * 1.12, 0.68 * 0.8, 0.68 * 1.12);
  crown.position.set(0.04, 0.56, 0.04);
  crown.castShadow = true;
  crown.receiveShadow = true;
  crown.updateMatrix();
  crown.matrixAutoUpdate = false;
  canopy.add(crown);

  return { root, canopy, foliageMats: [bottomMat, midMat, topMat] };
}

export function buildFloatingIslandScene(
  scene: THREE.Scene,
  maxAnisotropy: number,
  _isSoftwareGl: boolean
): IslandEnvironmentRefs {
  const defaultTheme = ISLAND_THEMES_LIST[0];
  const islandGroup = new THREE.Group();
  scene.add(islandGroup);

  const shadowTex = createSoftShadowTexture();
  const shadowPlaneGeo = new THREE.PlaneGeometry(1, 1);
  shadowPlaneGeo.rotateX(-Math.PI / 2);
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const shadowTransforms: {
    x: number;
    y: number;
    z: number;
    sx: number;
    sz: number;
  }[] = [];
  const addBakedShadow = (
    _parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    scaleX: number,
    scaleZ: number
  ) => {
    shadowTransforms.push({ x, y, z, sx: scaleX, sz: scaleZ });
  };

  // ============================================================================
  // 1. LARGE, EXPANSIVE MULTI-TONE GRASS PLATEAU (Radius 6.5)
  // ============================================================================
  const ISLAND_RADIUS = 6.5;
  const grassTex = createRichMultiToneGrassTexture(defaultTheme, maxAnisotropy);
  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 0.82,
    metalness: 0.02,
  });

  const grassGeo = new THREE.CylinderGeometry(
    ISLAND_RADIUS,
    ISLAND_RADIUS + 0.25,
    0.75,
    40,
    1
  );
  const grassPlateau = new THREE.Mesh(grassGeo, grassMat);
  grassPlateau.position.y = -0.375;
  grassPlateau.receiveShadow = true;
  freezeStaticObject(grassPlateau);
  islandGroup.add(grassPlateau);

  const knollMat = new THREE.MeshStandardMaterial({
    color: defaultTheme.knollColor,
    roughness: 0.82,
    metalness: 0.02,
  });
  const knoll = new THREE.Mesh(
    new THREE.SphereGeometry(2.35, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    knollMat
  );
  knoll.scale.set(1.15, 0.26, 0.95);
  knoll.position.set(-2.2, -0.04, -2.8);
  knoll.receiveShadow = true;
  knoll.castShadow = true;
  freezeStaticObject(knoll);
  islandGroup.add(knoll);
  addBakedShadow(islandGroup, -2.2, 0.015, -2.8, 5.4, 4.6);

  const riverStoneMat = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1,
    roughness: 0.72,
    metalness: 0.04,
  });
  const warmStoneMat = new THREE.MeshStandardMaterial({
    color: 0xe6d3b3,
    roughness: 0.74,
    metalness: 0.03,
  });

  const steppingStones = [
    [0.6, 0.7, 0.38],
    [1.35, 1.15, 0.34],
    [2.1, 1.65, 0.36],
    [2.85, 2.15, 0.32],
    [3.55, 2.6, 0.35],
    [-0.65, 0.25, 0.34],
    [0.95, -0.65, 0.32],
    [1.65, -1.25, 0.35],
  ];
  steppingStones.forEach(([sx, sz, rad], idx) => {
    const stone = new THREE.Mesh(
      SHARED_SPHERE_GEO,
      idx % 2 === 0 ? riverStoneMat : warmStoneMat
    );
    stone.scale.set(rad * 1.15, rad * 0.18, rad * 0.95);
    stone.position.set(sx, 0.01, sz);
    stone.rotation.y = idx * 0.6;
    stone.receiveShadow = true;
    stone.castShadow = true;
    freezeStaticObject(stone);
    islandGroup.add(stone);
  });

  // ============================================================================
  // 2. SMOOTH SCULPTED ROCKY CLIFF UNDERSIDE & PERIMETER BOULDERS
  // ============================================================================
  const rockTex = createLayeredRockTexture(defaultTheme, maxAnisotropy);
  const cliffRockMat = new THREE.MeshStandardMaterial({
    map: rockTex,
    roughness: 0.85,
    metalness: 0.05,
  });
  const warmBoulderMat = new THREE.MeshStandardMaterial({
    color: 0xa68967,
    roughness: 0.84,
    metalness: 0.05,
  });

  const cliffPoints: THREE.Vector2[] = [
    new THREE.Vector2(0.01, -4.6),
    new THREE.Vector2(1.45, -4.1),
    new THREE.Vector2(2.85, -3.2),
    new THREE.Vector2(4.45, -2.1),
    new THREE.Vector2(5.75, -1.1),
    new THREE.Vector2(6.68, -0.35),
    new THREE.Vector2(6.55, 0.0),
  ];
  const cliffLatheGeo = new THREE.LatheGeometry(cliffPoints, 32);
  const cPos = cliffLatheGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const x = cPos.getX(i);
    const y = cPos.getY(i);
    const z = cPos.getZ(i);
    if (y < -0.25 && y > -4.3) {
      const angle = Math.atan2(z, x);
      const bulge =
        1 +
        0.055 * Math.sin(angle * 5 + y * 1.2) +
        0.035 * Math.cos(angle * 8 - y * 1.8);
      cPos.setX(i, x * bulge);
      cPos.setZ(i, z * bulge);
    }
  }
  cliffLatheGeo.computeVertexNormals();
  const cliffUnderside = new THREE.Mesh(cliffLatheGeo, cliffRockMat);
  cliffUnderside.castShadow = true;
  cliffUnderside.receiveShadow = true;
  freezeStaticObject(cliffUnderside);
  islandGroup.add(cliffUnderside);

  const totalRimBoulders = 32;
  const boulderDummy = new THREE.Object3D();
  const boulderMatrices: { mat: THREE.Matrix4; colorHex: number }[] = [];

  for (let i = 0; i < totalRimBoulders; i++) {
    const angle = (i / totalRimBoulders) * Math.PI * 2;
    if (Math.abs(angle - 0.65) < 0.22) continue;
    if (Math.abs(angle - 2.35) < 0.18) continue;

    const radius = ISLAND_RADIUS - 0.32 + (i % 3) * 0.08;
    const scaleX = 0.85 + (i % 4) * 0.22;
    const scaleY = 0.52 + ((i * 3) % 4) * 0.16;
    const scaleZ = 0.85 + ((i * 2) % 3) * 0.2;

    const bx = Math.cos(angle) * radius;
    const bz = Math.sin(angle) * radius;
    boulderDummy.position.set(bx, 0.12 + scaleY * 0.1, bz);
    boulderDummy.rotation.set(0, angle + (i % 3) * 0.3, 0);
    boulderDummy.scale.set(scaleX, scaleY, scaleZ);
    boulderDummy.updateMatrix();

    const colorHex = defaultTheme.boulderColors[i % 3];
    boulderMatrices.push({
      mat: boulderDummy.matrix.clone(),
      colorHex,
    });

    addBakedShadow(
      islandGroup,
      Math.cos(angle) * (radius - 0.32),
      0.015,
      Math.sin(angle) * (radius - 0.32),
      scaleX * 1.5,
      scaleZ * 1.5
    );
  }

  const instancedBoulders = new THREE.InstancedMesh(
    SHARED_SMOOTH_BOULDER_GEO,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.05,
    }),
    boulderMatrices.length
  );
  instancedBoulders.castShadow = true;
  instancedBoulders.receiveShadow = true;
  const tempColor = new THREE.Color();
  boulderMatrices.forEach((item, idx) => {
    instancedBoulders.setMatrixAt(idx, item.mat);
    instancedBoulders.setColorAt(idx, tempColor.setHex(item.colorHex));
  });
  instancedBoulders.instanceMatrix.needsUpdate = true;
  if (instancedBoulders.instanceColor) {
    instancedBoulders.instanceColor.needsUpdate = true;
  }
  freezeStaticObject(instancedBoulders);
  islandGroup.add(instancedBoulders);

  // ============================================================================
  // 3. CRYSTAL LAGOON / MAGMA / ABYSS POND + CASCADING WATERFALL
  // ============================================================================
  const pondLocation = new THREE.Vector3(-2.35, 0.02, 1.85);
  const pondGroup = new THREE.Group();
  pondGroup.position.copy(pondLocation);
  islandGroup.add(pondGroup);

  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xeed28a,
    roughness: 0.85,
  });
  const pondBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.78, 1.65, 0.08, 24),
    sandMat
  );
  pondBasin.position.y = -0.02;
  pondBasin.receiveShadow = true;
  freezeStaticObject(pondBasin);
  pondGroup.add(pondBasin);

  const lagoonTex = createLagoonWaterTexture(defaultTheme);
  const waterMat = new THREE.MeshStandardMaterial({
    map: lagoonTex,
    color: defaultTheme.waterColorHex,
    emissive: defaultTheme.waterEmissiveHex,
    emissiveIntensity: 0.22,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.94,
  });
  const pondWaterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.62, 28),
    waterMat
  );
  pondWaterMesh.rotation.x = -Math.PI / 2;
  pondWaterMesh.position.y = 0.03;
  pondWaterMesh.receiveShadow = true;
  freezeStaticObject(pondWaterMesh);
  pondGroup.add(pondWaterMesh);

  for (let p = 0; p < 8; p++) {
    const pAngle = (p / 8) * Math.PI * 1.6 - 0.4;
    const pebble = createSmoothRoundedBoulder(
      0.22,
      p % 2 === 0 ? riverStoneMat : warmBoulderMat,
      1.1,
      0.45,
      0.9
    );
    pebble.position.set(
      Math.cos(pAngle) * 1.68,
      0.04,
      Math.sin(pAngle) * 1.68
    );
    freezeStaticObject(pebble);
    pondGroup.add(pebble);
  }

  const rippleGeo = new THREE.RingGeometry(0.42, 0.5, 24);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.65,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const pondRippleRing = new THREE.Mesh(rippleGeo, rippleMat);
  pondRippleRing.position.y = 0.042;
  pondGroup.add(pondRippleRing);

  const lilyMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    roughness: 0.68,
  });
  [
    [-0.55, 0.35, 0.3],
    [0.48, -0.42, 0.25],
    [-0.15, -0.68, 0.22],
  ].forEach(([lx, lz, r]) => {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.025, 12, 1, false, 0, Math.PI * 1.8),
      lilyMat
    );
    pad.position.set(lx, 0.045, lz);
    pad.receiveShadow = true;
    freezeStaticObject(pad);
    pondGroup.add(pad);
  });

  const streamChannel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 2.35),
    waterMat
  );
  streamChannel.rotation.x = -Math.PI / 2;
  streamChannel.rotation.z = -Math.PI / 4;
  streamChannel.position.set(-3.45, 0.032, 2.95);
  freezeStaticObject(streamChannel);
  islandGroup.add(streamChannel);

  const waterfallTex = createWaterfallTexture(defaultTheme);
  const waterfallMat = new THREE.MeshBasicMaterial({
    map: waterfallTex,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });
  const waterfallStreamMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 3.1, 2, 4),
    waterfallMat
  );
  waterfallStreamMesh.position.set(-4.52, -1.4, 4.52);
  waterfallStreamMesh.rotation.y = -Math.PI / 4;
  waterfallStreamMesh.rotation.x = -0.14;
  freezeStaticObject(waterfallStreamMesh);
  islandGroup.add(waterfallStreamMesh);

  const waterfallMistGroup = new THREE.Group();
  waterfallMistGroup.position.set(-4.35, 0.05, 4.35);
  islandGroup.add(waterfallMistGroup);
  const mistMat = new THREE.MeshBasicMaterial({
    color: 0xf0f9ff,
    transparent: true,
    opacity: 0.65,
  });
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(SHARED_CLOUD_GEO, mistMat);
    const rad = 0.18 + (i % 3) * 0.06;
    puff.scale.setScalar(rad);
    puff.position.set(
      (Math.random() - 0.5) * 0.85,
      (i % 2) * 0.14,
      (Math.random() - 0.5) * 0.85
    );
    waterfallMistGroup.add(puff);
  }

  // ============================================================================
  // 4. RUSTIC WOODEN BRIDGE ON CLIFF EDGE
  // ============================================================================
  const bridgeGroup = new THREE.Group();
  const bridgeAngle = 0.65;
  bridgeGroup.position.set(
    Math.cos(bridgeAngle) * (ISLAND_RADIUS - 0.7),
    0.05,
    Math.sin(bridgeAngle) * (ISLAND_RADIUS - 0.7)
  );
  bridgeGroup.rotation.y = -bridgeAngle + Math.PI / 2;
  bridgeGroup.scale.setScalar(1.22);
  islandGroup.add(bridgeGroup);

  addBakedShadow(
    islandGroup,
    Math.cos(bridgeAngle) * (ISLAND_RADIUS - 1.15),
    0.018,
    Math.sin(bridgeAngle) * (ISLAND_RADIUS - 1.15),
    2.4,
    2.4
  );

  const woodPlankMat = new THREE.MeshStandardMaterial({
    color: 0xb4692c,
    roughness: 0.78,
    metalness: 0.05,
  });
  const darkTimberMat = new THREE.MeshStandardMaterial({
    color: 0x6b3a14,
    roughness: 0.85,
    metalness: 0.08,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xd6b88a,
    roughness: 0.9,
  });

  const sharedPlankGeo = new THREE.BoxGeometry(1.28, 0.075, 0.19);
  const plankCount = 9;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1);
    const zOffset = (t - 0.3) * 2.1;
    const archY = Math.sin(t * Math.PI) * 0.26;
    const plank = new THREE.Mesh(sharedPlankGeo, woodPlankMat);
    plank.position.set(0, archY, zOffset);
    plank.rotation.x = (0.5 - t) * 0.26;
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);
  }

  const sharedPostGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.56, 8);
  [-0.6, 0.6].forEach((sideX) => {
    for (let p = 0; p < 4; p++) {
      const t = p / 3;
      const zPos = (t - 0.3) * 1.98;
      const archY = Math.sin(t * Math.PI) * 0.24;
      const post = new THREE.Mesh(sharedPostGeo, darkTimberMat);
      post.position.set(sideX, archY + 0.25, zPos);
      post.castShadow = true;
      bridgeGroup.add(post);
    }

    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sideX, 0.46, -0.6),
      new THREE.Vector3(sideX, 0.66, 0.38),
      new THREE.Vector3(sideX, 0.44, 1.38),
    ]);
    const railGeo = new THREE.TubeGeometry(railCurve, 12, 0.032, 6, false);
    const railMesh = new THREE.Mesh(railGeo, ropeMat);
    bridgeGroup.add(railMesh);
  });

  const lanternLights: THREE.PointLight[] = [];
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.5,
  });
  const bridgeLantern = new THREE.Mesh(SHARED_SPHERE_GEO, lanternMat);
  bridgeLantern.scale.setScalar(0.11);
  bridgeLantern.position.set(-0.6, 0.76, 0.38);
  bridgeGroup.add(bridgeLantern);
  freezeStaticObject(bridgeGroup);

  const bridgePointLight = new THREE.PointLight(0xfbbf24, 1.2, 8, 2);
  bridgePointLight.position.set(
    bridgeGroup.position.x - 0.3,
    1.1,
    bridgeGroup.position.z
  );
  islandGroup.add(bridgePointLight);
  lanternLights.push(bridgePointLight);

  // ============================================================================
  // 5. SMOOTH ROUNDED TREES & CUSHION SHRUBS
  // ============================================================================
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6e3f1d,
    roughness: 0.86,
  });
  const treeCanopyGroups: THREE.Group[] = [];
  const treeFoliageMats: [
    THREE.MeshStandardMaterial,
    THREE.MeshStandardMaterial,
    THREE.MeshStandardMaterial,
  ][] = [];

  const treeLocation = new THREE.Vector3(2.55, 0.0, -1.75);
  const mainTree = createSmoothStylizedTree(
    trunkMat,
    defaultTheme.tree1Colors,
    1.32
  );
  mainTree.root.position.copy(treeLocation);
  mainTree.root.updateMatrix();
  mainTree.root.matrixAutoUpdate = false;
  islandGroup.add(mainTree.root);
  treeCanopyGroups.push(mainTree.canopy);
  treeFoliageMats.push(mainTree.foliageMats);
  addBakedShadow(islandGroup, treeLocation.x, 0.016, treeLocation.z, 4.2, 4.2);

  const sakuraTree = createSmoothStylizedTree(
    trunkMat,
    defaultTheme.tree2Colors,
    1.05
  );
  sakuraTree.root.position.set(-2.35, 0.45, -2.95);
  sakuraTree.root.updateMatrix();
  sakuraTree.root.matrixAutoUpdate = false;
  islandGroup.add(sakuraTree.root);
  treeCanopyGroups.push(sakuraTree.canopy);
  treeFoliageMats.push(sakuraTree.foliageMats);
  addBakedShadow(islandGroup, -2.35, 0.48, -2.95, 3.2, 3.2);

  const meadowTree = createSmoothStylizedTree(
    trunkMat,
    defaultTheme.tree3Colors,
    0.92
  );
  meadowTree.root.position.set(0.45, 0.0, -4.15);
  meadowTree.root.updateMatrix();
  meadowTree.root.matrixAutoUpdate = false;
  islandGroup.add(meadowTree.root);
  treeCanopyGroups.push(meadowTree.canopy);
  treeFoliageMats.push(meadowTree.foliageMats);
  addBakedShadow(islandGroup, 0.45, 0.016, -4.15, 2.8, 2.8);

  const gardenPost = new THREE.Mesh(sharedPostGeo, darkTimberMat);
  gardenPost.position.set(1.55, 0.32, -0.95);
  gardenPost.castShadow = true;
  freezeStaticObject(gardenPost);
  islandGroup.add(gardenPost);

  const gardenBulb = new THREE.Mesh(SHARED_SPHERE_GEO, lanternMat);
  gardenBulb.scale.setScalar(0.11);
  gardenBulb.position.set(1.55, 0.68, -0.95);
  freezeStaticObject(gardenBulb);
  islandGroup.add(gardenBulb);

  const treeLanternLight = new THREE.PointLight(0xfbbf24, 1.2, 7.5, 2);
  treeLanternLight.position.set(1.55, 0.85, -0.95);
  islandGroup.add(treeLanternLight);
  lanternLights.push(treeLanternLight);

  const shrubMat1 = new THREE.MeshStandardMaterial({
    color: defaultTheme.shrubColors[0],
    roughness: 0.76,
  });
  const shrubMat2 = new THREE.MeshStandardMaterial({
    color: defaultTheme.shrubColors[1],
    roughness: 0.74,
  });
  const flowerMats = [0xf472b6, 0xfacc15, 0x38bdf8, 0xc084fc].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })
  );

  const shrubLocations = [
    [3.85, -0.45, 1.1],
    [1.85, -3.55, 0.95],
    [-3.95, -0.95, 1.05],
    [0.85, 4.15, 0.9],
    [-1.45, 4.25, 1.0],
    [3.95, 1.35, 0.88],
    [-3.65, -2.45, 0.92],
  ];
  shrubLocations.forEach(([sx, sz, sc], idx) => {
    const shrubGroup = new THREE.Group();
    shrubGroup.position.set(sx, 0, sz);
    shrubGroup.scale.setScalar(sc);

    const mainCushion = new THREE.Mesh(
      SHARED_SPHERE_GEO,
      idx % 2 === 0 ? shrubMat1 : shrubMat2
    );
    mainCushion.scale.set(0.34 * 1.25, 0.34 * 0.72, 0.34 * 1.15);
    mainCushion.position.y = 0.18;
    mainCushion.castShadow = true;
    mainCushion.receiveShadow = true;
    shrubGroup.add(mainCushion);

    const sideCushion = new THREE.Mesh(
      SHARED_SPHERE_GEO,
      idx % 2 === 0 ? shrubMat2 : shrubMat1
    );
    sideCushion.scale.set(0.24 * 1.15, 0.24 * 0.7, 0.24 * 1.1);
    sideCushion.position.set(0.24, 0.14, 0.12);
    sideCushion.castShadow = true;
    sideCushion.receiveShadow = true;
    shrubGroup.add(sideCushion);

    const fl = new THREE.Mesh(
      SHARED_SPHERE_GEO,
      flowerMats[idx % flowerMats.length]
    );
    fl.scale.set(0.085 * 1.1, 0.085 * 0.65, 0.085 * 1.1);
    fl.position.set(0.06, 0.36, 0.08);
    shrubGroup.add(fl);

    freezeStaticObject(shrubGroup);
    islandGroup.add(shrubGroup);
    addBakedShadow(islandGroup, sx, 0.015, sz, 1.15 * sc, 1.15 * sc);
  });

  const instancedShadows = new THREE.InstancedMesh(
    shadowPlaneGeo,
    contactShadowMat,
    shadowTransforms.length
  );
  const shadowDummy = new THREE.Object3D();
  shadowTransforms.forEach((st, idx) => {
    shadowDummy.position.set(st.x, st.y, st.z);
    shadowDummy.scale.set(st.sx, 1, st.sz);
    shadowDummy.updateMatrix();
    instancedShadows.setMatrixAt(idx, shadowDummy.matrix);
  });
  instancedShadows.instanceMatrix.needsUpdate = true;
  freezeStaticObject(instancedShadows);
  islandGroup.add(instancedShadows);

  // ============================================================================
  // 6. SOFT SCULPTED 3D CLOUDS ONLY
  // ============================================================================
  const cloudsGroup = new THREE.Group();
  scene.add(cloudsGroup);
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.94,
  });

  const cloudConfigs = [
    [-9.5, 2.8, -8.5, 1.45],
    [8.2, 3.4, -7.8, 1.55],
    [-6.2, -2.2, -7.5, 1.25],
    [8.8, -1.8, -6.2, 1.15],
    [0.8, 4.2, -10.5, 1.65],
    [-3.8, -3.5, 4.2, 1.05],
    [5.2, 1.8, -9.2, 1.3],
  ];
  cloudConfigs.forEach(([cx, cy, cz, scale]) => {
    const singleCloud = new THREE.Group();
    singleCloud.position.set(cx, cy, cz);
    singleCloud.scale.setScalar(scale);

    const blobs = [
      [0, 0, 0, 0.82],
      [-0.68, -0.12, 0.1, 0.6],
      [0.68, -0.1, -0.08, 0.62],
      [0.2, 0.34, 0.15, 0.56],
      [-0.25, 0.26, -0.1, 0.52],
    ];
    blobs.forEach(([bx, by, bz, br]) => {
      const m = new THREE.Mesh(SHARED_CLOUD_GEO, cloudMat);
      m.position.set(bx, by, bz);
      m.scale.set(br * 1.25, br * 0.82, br * 0.95);
      m.updateMatrix();
      m.matrixAutoUpdate = false;
      singleCloud.add(m);
    });
    cloudsGroup.add(singleCloud);
  });

  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(3), 3)
  );
  const moteMat = new THREE.PointsMaterial({ visible: false });
  const dustMotesPoints = new THREE.Points(moteGeo, moteMat);
  dustMotesPoints.visible = false;
  islandGroup.add(dustMotesPoints);

  // ============================================================================
  // 7. REAL-TIME SHADOW MAPPING & TIME-RESPONSIVE LIGHTING RIG
  // ============================================================================
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3f6212, 0.92);
  hemiLight.position.set(0, 18, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.8);
  keyLight.position.set(8.5, 13.5, 8.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 512;
  keyLight.shadow.mapSize.height = 512;
  const d = 7.6;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 32;
  keyLight.shadow.bias = -0.0008;
  keyLight.shadow.normalBias = 0.025;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
  rimLight.position.set(-8, 7, -8);
  scene.add(rimLight);

  // ============================================================================
  // 8. DYNAMIC WEATHER: LIGHT RAIN STREAKS & BRANCHING 3D LIGHTNING BOLT
  // ============================================================================
  const rainDropCount = 120;
  const rainPositions = new Float32Array(rainDropCount * 6); // 2 vertices per streak line
  for (let i = 0; i < rainDropCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 7.2;
    const x = Math.cos(angle) * radius;
    const y = Math.random() * 8.5;
    const z = Math.sin(angle) * radius;
    const idx = i * 6;
    // Top of raindrop streak
    rainPositions[idx] = x;
    rainPositions[idx + 1] = y;
    rainPositions[idx + 2] = z;
    // Bottom of raindrop streak (slanted slightly by wind)
    rainPositions[idx + 3] = x - 0.08;
    rainPositions[idx + 4] = y - 0.55;
    rainPositions[idx + 5] = z;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const rainLineSegments = new THREE.LineSegments(rainGeo, rainMat);
  rainLineSegments.visible = false;
  islandGroup.add(rainLineSegments);

  // 3D Jagged Branching Lightning Bolt Group + Ground Impact Ring + Flash Light
  const lightningBoltGroup = new THREE.Group();
  lightningBoltGroup.visible = false;
  islandGroup.add(lightningBoltGroup);

  const mainBoltPositions = new Float32Array(10 * 3);
  const mainBoltGeo = new THREE.BufferGeometry();
  mainBoltGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(mainBoltPositions, 3)
  );
  const mainBoltMat = new THREE.LineBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.95,
  });
  const lightningMainLine = new THREE.Line(mainBoltGeo, mainBoltMat);
  lightningBoltGroup.add(lightningMainLine);

  const branchBoltPositions = new Float32Array(5 * 3);
  const branchBoltGeo = new THREE.BufferGeometry();
  branchBoltGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(branchBoltPositions, 3)
  );
  const branchBoltMat = new THREE.LineBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.85,
  });
  const lightningBranchLine = new THREE.Line(branchBoltGeo, branchBoltMat);
  lightningBoltGroup.add(lightningBranchLine);

  const impactRingGeo = new THREE.RingGeometry(0.18, 0.55, 24);
  impactRingGeo.rotateX(-Math.PI / 2);
  const impactRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lightningImpactRing = new THREE.Mesh(impactRingGeo, impactRingMat);
  lightningImpactRing.position.y = 0.04;
  lightningBoltGroup.add(lightningImpactRing);

  const lightningFlashLight = new THREE.PointLight(0x38bdf8, 0, 22, 1.5);
  lightningFlashLight.position.set(0, 6.5, 0);
  islandGroup.add(lightningFlashLight);

  return {
    islandGroup,
    cloudsGroup,
    pondWaterMesh,
    pondRippleRing,
    waterfallStreamMesh,
    waterfallMistGroup,
    treeCanopyGroups,
    dustMotesPoints,
    pondLocation,
    treeLocation,
    keyLight,
    hemiLight,
    rimLight,
    lanternLights,
    grassMat,
    knollMat,
    cliffRockMat,
    instancedBoulders,
    boulderCount: boulderMatrices.length,
    waterMat,
    waterfallMat,
    treeFoliageMats,
    shrubMat1,
    shrubMat2,
    rainLineSegments,
    rainMat,
    lightningBoltGroup,
    lightningMainLine,
    lightningBranchLine,
    lightningImpactRing,
    lightningFlashLight,
  };
}

/**
 * Generates a fresh jagged 3D lightning strike path from the sky onto the island
 * when Inferno Hell or Abyss Island is active.
 */
export function triggerLightningStrike(
  env: IslandEnvironmentRefs,
  themeId: IslandThemeId
): void {
  const angle = Math.random() * Math.PI * 2;
  const radius = 1.6 + Math.random() * 3.8;
  const strikeX = Math.cos(angle) * radius;
  const strikeZ = Math.sin(angle) * radius;

  const mainAttr = env.lightningMainLine.geometry.attributes
    .position as THREE.BufferAttribute;
  const branchAttr = env.lightningBranchLine.geometry.attributes
    .position as THREE.BufferAttribute;

  const topY = 9.5;
  const segments = 9;
  let branchStartX = strikeX;
  let branchStartY = 5.0;
  let branchStartZ = strikeZ;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = topY * (1 - t) + 0.04 * t;
    const jitter = i === 0 || i === segments ? 0 : (Math.random() - 0.5) * 0.95;
    const jz = i === 0 || i === segments ? 0 : (Math.random() - 0.5) * 0.95;
    const px = strikeX + jitter;
    const pz = strikeZ + jz;
    mainAttr.setXYZ(i, px, y, pz);

    if (i === 4) {
      branchStartX = px;
      branchStartY = y;
      branchStartZ = pz;
    }
  }
  mainAttr.needsUpdate = true;

  // Secondary forked lightning branch
  const branchDirX = (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.8);
  const branchDirZ = (Math.random() - 0.5) * 1.1;
  for (let j = 0; j < 5; j++) {
    const bt = j / 4;
    branchAttr.setXYZ(
      j,
      branchStartX + branchDirX * bt + (j > 0 ? (Math.random() - 0.5) * 0.3 : 0),
      branchStartY - bt * 2.8,
      branchStartZ + branchDirZ * bt + (j > 0 ? (Math.random() - 0.5) * 0.3 : 0)
    );
  }
  branchAttr.needsUpdate = true;

  env.lightningImpactRing.position.set(strikeX, 0.045, strikeZ);
  env.lightningImpactRing.scale.setScalar(0.4);
  env.lightningFlashLight.position.set(strikeX, 5.5, strikeZ);

  const mainMat = env.lightningMainLine.material as THREE.LineBasicMaterial;
  const branchMat = env.lightningBranchLine.material as THREE.LineBasicMaterial;
  const ringMat = env.lightningImpactRing.material as THREE.MeshBasicMaterial;

  if (themeId === 'inferno_hell') {
    mainMat.color.setHex(0xfef08a);
    branchMat.color.setHex(0xf97316);
    ringMat.color.setHex(0xf97316);
    env.lightningFlashLight.color.setHex(0xfb923c);
  } else {
    mainMat.color.setHex(0xe0f2fe);
    branchMat.color.setHex(0xc084fc);
    ringMat.color.setHex(0x38bdf8);
    env.lightningFlashLight.color.setHex(0x38bdf8);
  }

  env.lightningBoltGroup.visible = true;
}

/**
 * Dynamically re-skins the 3D Floating Island to any selected Island Theme
 * (DC Island, Abyss Void, Neraka Inferno, Glacier, Sakura, Celestial Gold, etc.)
 */
export function applyIslandTheme(
  env: IslandEnvironmentRefs,
  themeId: IslandThemeId,
  maxAnisotropy: number = 4
): void {
  const theme = getThemeConfig(themeId);

  // 1. Update multi-tone plateau grass / magma / abyss ground texture
  env.grassMat.map = createRichMultiToneGrassTexture(theme, maxAnisotropy);
  env.grassMat.needsUpdate = true;
  env.knollMat.color.setHex(theme.knollColor);

  // 2. Update cliff rock underside & instanced perimeter boulders
  env.cliffRockMat.map = createLayeredRockTexture(theme, maxAnisotropy);
  env.cliffRockMat.needsUpdate = true;

  const tempColor = new THREE.Color();
  for (let i = 0; i < env.boulderCount; i++) {
    env.instancedBoulders.setColorAt(
      i,
      tempColor.setHex(theme.boulderColors[i % 3])
    );
  }
  if (env.instancedBoulders.instanceColor) {
    env.instancedBoulders.instanceColor.needsUpdate = true;
  }

  // 3. Update lagoon / molten lava / abyssal void pool & waterfall
  env.waterMat.map = createLagoonWaterTexture(theme);
  env.waterMat.color.setHex(theme.waterColorHex);
  env.waterMat.emissive.setHex(theme.waterEmissiveHex);
  env.waterMat.emissiveIntensity =
    theme.id === 'inferno_hell' || theme.id === 'abyss_void' ? 0.65 : 0.2;
  env.waterMat.needsUpdate = true;

  env.waterfallMat.map = createWaterfallTexture(theme);
  env.waterfallMat.needsUpdate = true;

  // 4. Update all 3 smooth stylized trees & shrubs
  const treePalettes = [
    theme.tree1Colors,
    theme.tree2Colors,
    theme.tree3Colors,
  ];
  env.treeFoliageMats.forEach((mats, idx) => {
    const pal = treePalettes[idx] || theme.tree1Colors;
    mats[0].color.setHex(pal[0]);
    mats[1].color.setHex(pal[1]);
    mats[2].color.setHex(pal[2]);
  });

  env.shrubMat1.color.setHex(theme.shrubColors[0]);
  env.shrubMat2.color.setHex(theme.shrubColors[1]);

  // 5. Configure Dynamic Weather (Light Rain & Lightning) for Inferno Hell & Abyss Island
  if (theme.id === 'inferno_hell') {
    env.rainLineSegments.visible = true;
    env.rainMat.color.setHex(0xfdba74); // Warm ember-rain / volcanic ash-rain streaks
    env.rainMat.opacity = 0.5;
  } else if (theme.id === 'abyss_void') {
    env.rainLineSegments.visible = true;
    env.rainMat.color.setHex(0x67e8f9); // Mystic cyan-violet rain streaks
    env.rainMat.opacity = 0.52;
  } else {
    env.rainLineSegments.visible = false;
    env.lightningBoltGroup.visible = false;
    env.lightningFlashLight.intensity = 0;
  }
}

export function applyTimeOfDayLighting(
  scene: THREE.Scene,
  env: IslandEnvironmentRefs,
  timeOfDay: TimeOfDay
): void {
  if (timeOfDay === 'day') {
    scene.fog = new THREE.FogExp2(0x9bd7fb, 0.015);
    env.keyLight.position.set(8.5, 13.5, 8.5);
    env.keyLight.color.setHex(0xfff6e5);
    env.keyLight.intensity = 1.8;
    env.hemiLight.color.setHex(0xe0f2fe);
    env.hemiLight.groundColor.setHex(0x3f6212);
    env.hemiLight.intensity = 0.95;
    env.rimLight.color.setHex(0x93c5fd);
    env.rimLight.intensity = 0.55;
    env.lanternLights.forEach((l) => (l.intensity = 0.25));
  } else if (timeOfDay === 'sunset') {
    scene.fog = new THREE.FogExp2(0xfda4af, 0.017);
    env.keyLight.position.set(11.5, 8.2, 6.5);
    env.keyLight.color.setHex(0xf97316);
    env.keyLight.intensity = 2.0;
    env.hemiLight.color.setHex(0xfed7aa);
    env.hemiLight.groundColor.setHex(0x4c1d95);
    env.hemiLight.intensity = 0.85;
    env.rimLight.color.setHex(0xc084fc);
    env.rimLight.intensity = 0.85;
    env.lanternLights.forEach((l) => (l.intensity = 2.0));
  } else {
    scene.fog = new THREE.FogExp2(0x0f172a, 0.019);
    env.keyLight.position.set(-7.5, 12.0, 7.5);
    env.keyLight.color.setHex(0x818cf8);
    env.keyLight.intensity = 0.95;
    env.hemiLight.color.setHex(0x312e81);
    env.hemiLight.groundColor.setHex(0x0f172a);
    env.hemiLight.intensity = 0.72;
    env.rimLight.color.setHex(0x38bdf8);
    env.rimLight.intensity = 0.95;
    env.lanternLights.forEach((l) => (l.intensity = 3.2));
  }
}
