import * as THREE from 'three';
import {
  getPetStageVisuals,
  PET_SPECIES_CATALOG,
  PetAIState,
  PetSpeciesId,
} from '../types/pet';

export interface ArticulatedPetRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  tailGroup: THREE.Group;
  legs: THREE.Group[];
  spriteMesh: THREE.Mesh;
  spriteTexture: THREE.Texture;
  currentSheetUrl: string;
  frameCount: number;
  facingDir: number; // 1 or -1 for horizontal flip
  auraGroup?: THREE.Group;
  shadowDisc: THREE.Mesh;
  hitbox: THREE.Mesh;
}

const textureLoader = new THREE.TextureLoader();
const baseSheetCache = new Map<string, THREE.Texture>();

// Shared geometries & soft shadow material for all pets (reduces draw overhead)
const SHARED_SPRITE_GEO = new THREE.PlaneGeometry(1.65, 1.65);
const SHARED_HITBOX_GEO = new THREE.CylinderGeometry(0.68, 0.68, 1.45, 8);
const SHARED_HITBOX_MAT = new THREE.MeshBasicMaterial({ visible: false });

const SHARED_PET_SHADOW_GEO = (() => {
  const geo = new THREE.PlaneGeometry(1.15, 1.15);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();

const SHARED_PET_SHADOW_MAT = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(15, 38, 12, 0.48)');
  grad.addColorStop(0.6, 'rgba(15, 38, 12, 0.22)');
  grad.addColorStop(1, 'rgba(15, 38, 12, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
})();

function getClonedSpriteSheetTexture(url: string, frameCount: number): THREE.Texture {
  let baseTex = baseSheetCache.get(url);
  if (!baseTex) {
    baseTex = textureLoader.load(url);
    baseTex.colorSpace = THREE.SRGBColorSpace;
    baseTex.wrapS = THREE.RepeatWrapping;
    baseTex.wrapT = THREE.ClampToEdgeWrapping;
    baseTex.magFilter = THREE.LinearFilter;
    baseTex.minFilter = THREE.LinearMipmapLinearFilter;
    baseSheetCache.set(url, baseTex);
  }

  // Clone texture per pet instance so each pet can have its own independent animation frame offset & flip
  const instanceTex = baseTex.clone();
  instanceTex.colorSpace = THREE.SRGBColorSpace;
  instanceTex.wrapS = THREE.RepeatWrapping;
  instanceTex.wrapT = THREE.ClampToEdgeWrapping;
  instanceTex.repeat.set(1 / frameCount, 1);
  instanceTex.needsUpdate = true;

  // Ensure once the base image finishes loading, the cloned texture updates immediately
  if (!baseTex.image) {
    const checkLoad = setInterval(() => {
      if (baseTex && baseTex.image) {
        instanceTex.image = baseTex.image;
        instanceTex.needsUpdate = true;
        clearInterval(checkLoad);
      }
    }, 60);
  }

  return instanceTex;
}

export function createProceduralPetRig(
  speciesId: PetSpeciesId,
  instanceId: string,
  starOrLevel: number = 1
): ArticulatedPetRig {
  const spec = PET_SPECIES_CATALOG[speciesId];
  const stageVisuals = getPetStageVisuals(speciesId, starOrLevel);
  const root = new THREE.Group();
  root.name = `pet_${instanceId}`;

  // 1. Soft natural radial shadow grounded on the grass (no colored ring or orbiting dots)
  const shadowDisc = new THREE.Mesh(SHARED_PET_SHADOW_GEO, SHARED_PET_SHADOW_MAT);
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // 2. Invisible raycast proxy hitbox on layer 1
  const hitbox = new THREE.Mesh(SHARED_HITBOX_GEO, SHARED_HITBOX_MAT);
  hitbox.position.y = 0.72;
  hitbox.layers.enable(1);
  hitbox.userData = { isPetHitbox: true, instanceId, speciesId };
  root.add(hitbox);

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.78;
  root.add(bodyGroup);

  const headGroup = new THREE.Group();
  const tailGroup = new THREE.Group();
  bodyGroup.add(headGroup, tailGroup);

  // 3. 2.5D Transparent Animated Dragon Sprite Plane (stage-aware: Lv.1 Baby vs Lv.2 Winged)
  const frameCount = spec.frameCount || 16;
  const spriteTexture = getClonedSpriteSheetTexture(
    stageVisuals.spriteSheetUrl,
    frameCount
  );

  const spriteMat = new THREE.MeshBasicMaterial({
    map: spriteTexture,
    color: spec.spriteTintHex ? new THREE.Color(spec.spriteTintHex) : 0xffffff,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const spriteMesh = new THREE.Mesh(SHARED_SPRITE_GEO, spriteMat);
  spriteMesh.castShadow = false;
  bodyGroup.add(spriteMesh);

  return {
    root,
    bodyGroup,
    headGroup,
    tailGroup,
    legs: [],
    spriteMesh,
    spriteTexture,
    currentSheetUrl: stageVisuals.spriteSheetUrl,
    frameCount,
    facingDir: 1,
    shadowDisc,
    hitbox,
  };
}

/**
 * Dynamically swaps the 3D sprite sheet texture when a pet evolves from Level 1 (Baby) to Level 2 (Winged)
 */
export function updatePetRigStageTexture(
  rig: ArticulatedPetRig,
  speciesId: PetSpeciesId,
  starOrLevel: number
): void {
  const stageVisuals = getPetStageVisuals(speciesId, starOrLevel);
  if (rig.currentSheetUrl === stageVisuals.spriteSheetUrl) return;

  const newTex = getClonedSpriteSheetTexture(
    stageVisuals.spriteSheetUrl,
    rig.frameCount
  );
  rig.spriteTexture.dispose();
  rig.spriteTexture = newTex;
  rig.currentSheetUrl = stageVisuals.spriteSheetUrl;

  const mat = rig.spriteMesh.material as THREE.MeshBasicMaterial;
  mat.map = newTex;
  mat.needsUpdate = true;
}

export function animatePetRig(
  rig: ArticulatedPetRig,
  _speciesId: PetSpeciesId,
  state: PetAIState,
  elapsed: number,
  walkPhase: number,
  stateTimer: number,
  cameraQuaternion?: THREE.Quaternion
): void {
  const {
    bodyGroup,
    spriteTexture,
    frameCount,
    facingDir,
    shadowDisc,
  } = rig;

  // 1. Advance GIF Sprite Sheet Frame
  if (spriteTexture.image) {
    const fps = state === PetAIState.ROAM || state === PetAIState.REACT_TAP ? 18 : 14;
    const currentFrame = Math.floor(elapsed * fps) % frameCount;
    if (facingDir >= 0) {
      spriteTexture.repeat.x = 1 / frameCount;
      spriteTexture.offset.x = currentFrame / frameCount;
    } else {
      // Mirror horizontally when walking left
      spriteTexture.repeat.x = -1 / frameCount;
      spriteTexture.offset.x = (currentFrame + 1) / frameCount;
    }
  }

  // 2. Billboard orientation so the 2.5D dragon sprite always faces the camera cleanly
  if (cameraQuaternion) {
    rig.root.quaternion.copy(cameraQuaternion);
    rig.root.rotation.x = 0;
    rig.root.rotation.z = 0;
  }

  // 3. State-specific 2.5D motion (Hovering, Walking Bob, Tap Jump)
  if (state === PetAIState.REACT_TAP) {
    const jumpArc = Math.abs(Math.sin(elapsed * 8.5));
    bodyGroup.position.y = 0.82 + jumpArc * 0.45;
    bodyGroup.rotation.z = Math.sin(stateTimer * Math.PI * 4) * 0.18;
    const pulse = 1.08 + Math.sin(elapsed * 16) * 0.08;
    bodyGroup.scale.set(pulse, pulse, 1);
    shadowDisc.scale.setScalar(1 - jumpArc * 0.35);
    return;
  }

  bodyGroup.scale.set(1, 1, 1);

  if (state === PetAIState.ROAM) {
    const bob = Math.sin(walkPhase * 1.2) * 0.08;
    bodyGroup.position.y = 0.82 + bob;
    bodyGroup.rotation.z = Math.sin(walkPhase * 0.6) * 0.05;
    shadowDisc.scale.setScalar(0.95 - bob * 0.4);
  } else if (state === PetAIState.INTERACT) {
    const floatOffset = Math.sin(elapsed * 2.2) * 0.09;
    bodyGroup.position.y = 0.78 + floatOffset;
    bodyGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.03;
    shadowDisc.scale.setScalar(0.92 - floatOffset * 0.3);
  } else {
    // IDLE state
    const hover = Math.sin(elapsed * 2.6) * 0.06;
    bodyGroup.position.y = 0.8 + hover;
    bodyGroup.rotation.z = 0;
    shadowDisc.scale.setScalar(0.95 - hover * 0.3);
  }
}
