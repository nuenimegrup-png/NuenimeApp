import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  GACHA_SINGLE_COST,
  GACHA_TEN_COST,
  PET_SPECIES_CATALOG,
  PetAIState,
  PetRarity,
  PetSpeciesId,
} from '../types/pet';
import { animatePetRig, createProceduralPetRig } from '../three/petBuilder';
import { soundFX } from '../utils/sound';
import { PetAvatarBadge, RarityPillBadge } from './PetAvatarBadge';

interface GachaEggModalProps {
  isOpen: boolean;
  gems: number;
  onClose: () => void;
  onPerformGacha: (count: 1 | 10) => PetSpeciesId[] | null;
}

type GachaAnimPhase = 'idle' | 'cracking' | 'burst' | 'reveal';

/**
 * True tapered Dragon Egg SVG icon (replaces boxy rounded-full spans)
 */
export const GoldenEggIcon: React.FC<{ className?: string }> = ({
  className = 'w-6 h-7',
}) => (
  <svg
    viewBox="0 0 28 34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 drop-shadow-xs select-none ${className}`}
  >
    <defs>
      <radialGradient
        id="goldEggGrad"
        cx="35%"
        cy="28%"
        r="70%"
        fx="35%"
        fy="28%"
      >
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="28%" stopColor="#FDE047" />
        <stop offset="68%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </radialGradient>
      <linearGradient id="eggRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    {/* Tapered Organic Egg Silhouette */}
    <path
      d="M14 2 C7.8 2 3 10.6 3 19.2 C3 26.8 7.8 32 14 32 C20.2 32 25 26.8 25 19.2 C25 10.6 20.2 2 14 2 Z"
      fill="url(#goldEggGrad)"
      stroke="url(#eggRimGrad)"
      strokeWidth="1.6"
    />
    {/* Dragon Egg Markings */}
    <ellipse
      cx="18.5"
      cy="14.5"
      rx="2.2"
      ry="3"
      transform="rotate(15 18.5 14.5)"
      fill="#FEF9C3"
      fillOpacity="0.55"
    />
    <ellipse
      cx="9.5"
      cy="21.5"
      rx="2.4"
      ry="3.2"
      transform="rotate(-12 9.5 21.5)"
      fill="#FEF9C3"
      fillOpacity="0.45"
    />
    <circle cx="16.5" cy="24" r="1.8" fill="#FEF9C3" fillOpacity="0.5" />
    {/* Glossy Specular Highlight */}
    <ellipse
      cx="10.2"
      cy="10.5"
      rx="2.4"
      ry="4.8"
      transform="rotate(22 10.2 10.5)"
      fill="#FFFFFF"
      fillOpacity="0.82"
    />
    <circle cx="8.2" cy="16.2" r="1" fill="#FFFFFF" fillOpacity="0.7" />
  </svg>
);

/**
 * Helper to build a true 5-pointed 3D star geometry
 */
function createFivePointStarGeometry(
  outerRadius = 0.13,
  innerRadius = 0.055,
  depth = 0.035
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  geo.center();
  return geo;
}

/**
 * Helper to create a soft radial glow texture for 3D magical aura planes & sprites
 */
function createMagicalAuraTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Soft outer golden-magenta-cyan magical radial glow
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.25, 'rgba(254, 240, 138, 0.85)');
  grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.42)');
  grad.addColorStop(0.82, 'rgba(168, 85, 247, 0.18)');
  grad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Crisp magic ring circles
  ctx.strokeStyle = 'rgba(254, 249, 195, 0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 128, 86, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const GachaEggModal: React.FC<GachaEggModalProps> = ({
  isOpen,
  gems,
  onClose,
  onPerformGacha,
}) => {
  const stageMountRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<GachaAnimPhase>('idle');
  const [obtainedResults, setObtainedResults] = useState<PetSpeciesId[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const phaseRef = useRef<GachaAnimPhase>('idle');
  const activeSpeciesRef = useRef<PetSpeciesId | null>(null);
  const rebuildPetShowcaseRef = useRef<
    ((species: PetSpeciesId | null) => void) | null
  >(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const currentSpeciesId =
    obtainedResults.length > 0 ? obtainedResults[selectedIndex] : null;

  useEffect(() => {
    activeSpeciesRef.current = currentSpeciesId;
    if (rebuildPetShowcaseRef.current) {
      rebuildPetShowcaseRef.current(currentSpeciesId);
    }
  }, [currentSpeciesId]);

  useEffect(() => {
    if (isOpen) {
      setPhase('idle');
      setObtainedResults([]);
      setSelectedIndex(0);
      setErrorMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const container = stageMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    camera.position.set(0, 0.8, 4.2);
    camera.lookAt(0, 0.25, 0);

    const hemi = new THREE.HemisphereLight(0xfffbeb, 0xf59e0b, 1.2);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    // 0. MAGICAL GLOWING AURA BACKDROP & GROUND RUNE CIRCLE
    const auraTex = createMagicalAuraTexture();
    const backAuraMat = new THREE.MeshBasicMaterial({
      map: auraTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const backAuraMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      backAuraMat
    );
    backAuraMesh.position.set(0, 0.3, -0.55);
    scene.add(backAuraMesh);

    const groundAuraMat = new THREE.MeshBasicMaterial({
      map: auraTex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const groundAuraMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      groundAuraMat
    );
    groundAuraMesh.rotation.x = -Math.PI / 2;
    groundAuraMesh.position.set(0, -0.32, 0);
    scene.add(groundAuraMesh);

    // 1. 3D MAGICAL GOLDEN EGG GROUP (Ultra-smooth tapered oval egg profile)
    const eggGroup = new THREE.Group();
    scene.add(eggGroup);

    const eggPoints: THREE.Vector2[] = [];
    const profileSteps = 48;
    for (let i = 0; i <= profileSteps; i++) {
      const t = (i / profileSteps) * Math.PI;
      // Authentic avian/dragon egg curve: narrower pointed top, fuller rounded bottom
      const taper = 1 - 0.22 * Math.cos(t);
      const rx = Math.sin(t) * 0.68 * taper;
      const ry = -Math.cos(t) * 0.98;
      eggPoints.push(new THREE.Vector2(Math.max(0.0001, rx), ry));
    }
    const eggGeo = new THREE.LatheGeometry(eggPoints, 64);
    eggGeo.computeVertexNormals();

    const goldEggMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
      roughness: 0.14,
      metalness: 0.82,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    const eggMesh = new THREE.Mesh(eggGeo, goldEggMat);
    eggMesh.position.y = 0.22;
    eggGroup.add(eggMesh);

    const spotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    const topHighlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      spotMat
    );
    topHighlight.scale.set(0.9, 1.5, 0.35);
    topHighlight.position.set(-0.24, 0.58, 0.56);
    topHighlight.rotation.z = -0.32;
    eggGroup.add(topHighlight);

    const crackGroup = new THREE.Group();
    crackGroup.position.y = 0.22;
    crackGroup.visible = false;
    eggGroup.add(crackGroup);

    const crackMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 8; i++) {
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 2.8, 8),
        crackMat
      );
      beam.rotation.z = (i / 8) * Math.PI * 2;
      beam.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.48;
      crackGroup.add(beam);
    }

    // 2. 3D 5-POINTED STAR BURST & ORBITING CELESTIAL STARS GROUP
    const starGeo = createFivePointStarGeometry(0.13, 0.055, 0.032);
    const sparklesGroup = new THREE.Group();
    sparklesGroup.position.y = 0.25;
    scene.add(sparklesGroup);

    const sparkleMeshes: {
      mesh: THREE.Mesh;
      dir: THREE.Vector3;
      rotSpeed: THREE.Vector3;
      baseScale: number;
    }[] = [];

    const starPalette = [0xfef08a, 0xfacc15, 0x38bdf8, 0xc084fc, 0xffffff];
    for (let i = 0; i < 36; i++) {
      const colorHex = starPalette[i % starPalette.length];
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 1.6,
        roughness: 0.1,
        metalness: 0.5,
      });
      const m = new THREE.Mesh(starGeo, mat);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.65 + Math.random() * 0.85;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 0.25,
        Math.sin(phi) * Math.sin(theta) * speed
      );
      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );
      const baseScale = 0.65 + Math.random() * 0.75;
      sparklesGroup.add(m);
      sparkleMeshes.push({ mesh: m, dir, rotSpeed, baseScale });
    }

    // Expanding shockwave ring during hatch burst
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const shockwaveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.68, 48),
      shockwaveMat
    );
    sparklesGroup.add(shockwaveRing);
    sparklesGroup.visible = false;

    // 3. REVEALED PET STAGE GROUP + PERSISTENT FLOATING MAGICAL STARS
    const petShowcaseGroup = new THREE.Group();
    petShowcaseGroup.position.y = -0.35;
    scene.add(petShowcaseGroup);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.08, 0.12, 32),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.18,
        roughness: 0.35,
        metalness: 0.4,
      })
    );
    pedestal.position.y = -0.06;
    petShowcaseGroup.add(pedestal);

    // Persistent rising star particles around the hatched pet during reveal
    const revealStarsGroup = new THREE.Group();
    petShowcaseGroup.add(revealStarsGroup);
    const revealOrbitStars: {
      mesh: THREE.Mesh;
      angle: number;
      radius: number;
      heightOffset: number;
      speed: number;
    }[] = [];

    for (let i = 0; i < 14; i++) {
      const colorHex = starPalette[i % starPalette.length];
      const m = new THREE.Mesh(
        starGeo,
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.92,
        })
      );
      const angle = (i / 14) * Math.PI * 2;
      const radius = 0.75 + (i % 3) * 0.22;
      const heightOffset = (i / 14) * 1.4;
      const speed = 0.8 + (i % 4) * 0.25;
      m.scale.setScalar(0.52);
      revealStarsGroup.add(m);
      revealOrbitStars.push({ mesh: m, angle, radius, heightOffset, speed });
    }

    petShowcaseGroup.visible = false;

    let currentRig: ReturnType<typeof createProceduralPetRig> | null = null;

    rebuildPetShowcaseRef.current = (species: PetSpeciesId | null) => {
      if (currentRig) {
        petShowcaseGroup.remove(currentRig.root);
        currentRig = null;
      }
      if (species) {
        currentRig = createProceduralPetRig(species, 'gacha_preview', 1);
        currentRig.root.scale.setScalar(1.18);
        petShowcaseGroup.add(currentRig.root);
      }
    };

    const clock = new THREE.Clock();
    let frameId = 0;
    let burstTimer = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const currentPhase = phaseRef.current;

      // Rotate magical aura backdrop & ground circle continuously
      backAuraMesh.rotation.z = elapsed * 0.35;
      groundAuraMesh.rotation.z = -elapsed * 0.55;

      if (currentPhase === 'idle') {
        eggGroup.visible = true;
        crackGroup.visible = false;
        sparklesGroup.visible = false;
        petShowcaseGroup.visible = false;

        backAuraMesh.scale.setScalar(0.95 + Math.sin(elapsed * 2.2) * 0.06);
        backAuraMat.opacity = 0.45 + Math.sin(elapsed * 2.2) * 0.1;
        groundAuraMat.opacity = 0.55;

        eggGroup.position.x = 0;
        eggGroup.position.y = Math.sin(elapsed * 2.4) * 0.11;
        eggGroup.rotation.y = elapsed * 0.85;
        eggGroup.rotation.z = Math.sin(elapsed * 1.8) * 0.05;
        eggGroup.scale.setScalar(1);
        goldEggMat.emissiveIntensity = 0.24 + Math.sin(elapsed * 3) * 0.08;
      } else if (currentPhase === 'cracking') {
        eggGroup.visible = true;
        crackGroup.visible = true;
        sparklesGroup.visible = false;
        petShowcaseGroup.visible = false;

        // Aura intensifies rapidly as egg cracks
        backAuraMesh.scale.setScalar(1.25 + Math.sin(elapsed * 18) * 0.12);
        backAuraMat.opacity = 0.92;
        groundAuraMat.opacity = 0.95;

        eggGroup.position.x = Math.sin(elapsed * 48) * 0.09;
        eggGroup.position.y = Math.cos(elapsed * 42) * 0.06;
        eggGroup.rotation.z = Math.sin(elapsed * 38) * 0.18;
        eggGroup.scale.setScalar(1.08 + Math.sin(elapsed * 20) * 0.05);
        goldEggMat.emissiveIntensity = 1.35;
        crackGroup.rotation.y += delta * 5.2;
        crackGroup.rotation.z += delta * 3.8;
        burstTimer = 0;
      } else if (currentPhase === 'burst') {
        burstTimer += delta;
        eggGroup.visible = false;
        sparklesGroup.visible = true;
        petShowcaseGroup.visible = true;

        backAuraMesh.scale.setScalar(1.45 - burstTimer * 0.4);
        backAuraMat.opacity = Math.max(0.65, 1.0 - burstTimer * 0.5);

        shockwaveRing.scale.setScalar(0.5 + burstTimer * 5.2);
        shockwaveMat.opacity = Math.max(0, 1 - burstTimer * 1.8);

        sparkleMeshes.forEach(({ mesh, dir, rotSpeed, baseScale }) => {
          mesh.position.copy(dir).multiplyScalar(burstTimer * 3.6);
          mesh.rotation.x += delta * rotSpeed.x;
          mesh.rotation.y += delta * rotSpeed.y;
          mesh.rotation.z += delta * rotSpeed.z;
          const fade = Math.max(0.01, (1 - burstTimer * 1.35) * baseScale);
          mesh.scale.setScalar(fade);
        });

        const popScale = Math.min(1, burstTimer * 2.6);
        petShowcaseGroup.scale.setScalar(popScale);
        petShowcaseGroup.rotation.y = 0;
      } else if (currentPhase === 'reveal') {
        eggGroup.visible = false;
        sparklesGroup.visible = false;
        petShowcaseGroup.visible = true;
        petShowcaseGroup.scale.setScalar(1);

        // Magical glowing aura pulses gently behind the newly hatched pet
        backAuraMesh.scale.setScalar(1.12 + Math.sin(elapsed * 2.8) * 0.08);
        backAuraMat.opacity = 0.72 + Math.sin(elapsed * 2.8) * 0.12;
        groundAuraMat.opacity = 0.85;

        // Update orbiting & rising 3D star particles around the hatched pet
        revealOrbitStars.forEach((st, idx) => {
          const curAngle = st.angle + elapsed * st.speed;
          const cycleY = ((elapsed * 0.55 + st.heightOffset) % 1.45) + 0.05;
          st.mesh.position.set(
            Math.cos(curAngle) * st.radius,
            cycleY,
            Math.sin(curAngle) * st.radius
          );
          st.mesh.rotation.y = elapsed * 3 + idx;
          st.mesh.rotation.z = elapsed * 2 + idx;
          const twinkle =
            0.38 + Math.abs(Math.sin(elapsed * 4.5 + idx)) * 0.35;
          st.mesh.scale.setScalar(twinkle);
        });

        if (currentRig && activeSpeciesRef.current) {
          animatePetRig(
            currentRig,
            activeSpeciesRef.current,
            PetAIState.IDLE,
            elapsed,
            elapsed * 4,
            2,
            camera.quaternion
          );
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      starGeo.dispose();
      auraTex.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerPull = (count: 1 | 10) => {
    const cost = count === 1 ? GACHA_SINGLE_COST : GACHA_TEN_COST;
    if (gems < cost) {
      setErrorMsg(
        `Permata belum cukup (Butuh ${cost.toLocaleString('id-ID')} Permata). Tukarkan Koin di bagian atas layar!`
      );
      return;
    }

    setErrorMsg(null);
    const results = onPerformGacha(count);
    if (!results || results.length === 0) return;

    setObtainedResults(results);
    setSelectedIndex(0);
    setPhase('cracking');
    soundFX.playEggCrack();

    setTimeout(() => {
      setPhase('burst');
      const hasRareOrEpic = results.some(
        (id) => PET_SPECIES_CATALOG[id].rarity !== PetRarity.COMMON
      );
      soundFX.playGachaReveal(hasRareOrEpic);
    }, 950);

    setTimeout(() => {
      setPhase('reveal');
    }, 1500);
  };

  const revealedConfig = currentSpeciesId
    ? PET_SPECIES_CATALOG[currentSpeciesId]
    : null;

  // Rarity-specific aura glow color
  const auraGlowGradient =
    phase === 'reveal' && revealedConfig
      ? revealedConfig.rarity === PetRarity.EPIC ||
        revealedConfig.rarity === PetRarity.LEGEND
        ? 'radial-gradient(circle, rgba(250,204,21,0.75) 0%, rgba(168,85,247,0.42) 48%, rgba(255,253,247,0) 75%)'
        : revealedConfig.rarity === PetRarity.RARE
        ? 'radial-gradient(circle, rgba(56,189,248,0.68) 0%, rgba(250,204,21,0.32) 52%, rgba(255,253,247,0) 75%)'
        : 'radial-gradient(circle, rgba(253,224,71,0.65) 0%, rgba(134,239,172,0.28) 52%, rgba(255,253,247,0) 75%)'
      : phase === 'cracking' || phase === 'burst'
      ? 'radial-gradient(circle, rgba(254,240,138,0.92) 0%, rgba(245,158,11,0.55) 50%, rgba(255,253,247,0) 78%)'
      : 'radial-gradient(circle, rgba(253,224,71,0.55) 0%, rgba(254,240,138,0.22) 55%, rgba(255,253,247,0) 75%)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55">
      <div className="w-full max-w-md rounded-3xl bg-[#FFFDF7] border border-amber-200/80 shadow-2xl p-6 flex flex-col items-center text-center relative overflow-hidden">
        <h2 className="font-['Fredoka'] text-2xl font-bold text-slate-800 tracking-tight">
          Gacha Pet
        </h2>
        <p className="text-xs font-medium text-slate-500 mt-0.5">
          {phase === 'reveal' && revealedConfig
            ? `✨ Selamat! Telur Emas menetas menjadi ${revealedConfig.name} (${revealedConfig.title})`
            : 'Mari mencari pet naga dari telur emas magis'}
        </p>

        {/* Crystal Balance Badge in Gacha Modal */}
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold">
          <span className="text-[#4AA9DF]">✦</span> Saldo Crystal: <span className="font-mono tabular-nums">{gems.toLocaleString('id-ID')}</span>
        </div>

        {/* 3D Egg / Pet Reveal Viewport with Multi-Layer Magical Aura & Star Sparkles */}
        <div className="relative w-full h-64 my-2 flex items-center justify-center">
          {/* Dynamic Glowing Aura Circle */}
          <div
            className={`absolute w-56 h-56 rounded-full pointer-events-none transition-all duration-500 ${
              phase === 'cracking' || phase === 'burst'
                ? 'scale-115 animate-pulse'
                : 'scale-100'
            }`}
            style={{ background: auraGlowGradient }}
          />

          {/* Floating Star Sparkle Badges during Cracking / Burst / Reveal */}
          {(phase === 'cracking' || phase === 'burst' || phase === 'reveal') && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <span className="absolute top-4 left-12 text-amber-400 text-lg animate-ping">
                ✦
              </span>
              <span className="absolute top-6 right-12 text-purple-400 text-base animate-bounce">
                ★
              </span>
              <span className="absolute bottom-14 left-10 text-sky-400 text-sm animate-pulse">
                ✦
              </span>
              <span className="absolute bottom-16 right-10 text-amber-500 text-base animate-bounce">
                ✦
              </span>
            </div>
          )}

          <div ref={stageMountRef} className="w-full h-full relative z-10" />

          {phase === 'reveal' && revealedConfig && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 bg-white/95 border border-amber-300 px-4 py-1.5 rounded-2xl shadow-lg">
              <div className="flex items-center gap-2">
                <span className="font-['Fredoka'] font-bold text-sm text-slate-800 whitespace-nowrap">
                  {revealedConfig.name} {revealedConfig.title}
                </span>
                <RarityPillBadge rarity={revealedConfig.rarity} />
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 font-mono tabular-nums">
                HASILKAN +{revealedConfig.coinsPerDay} Koin/hari
              </span>
            </div>
          )}
        </div>

        {/* 10x Pull Thumbnail Selector Grid */}
        {phase === 'reveal' && obtainedResults.length > 1 && (
          <div className="w-full mb-3">
            <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
              Hasil 10x Buka (Klik untuk melihat karakter):
            </p>
            <div className="grid grid-cols-5 gap-1.5 max-h-28 overflow-y-auto p-1 bg-amber-50/70 rounded-2xl border border-amber-200/60">
              {obtainedResults.map((specId, idx) => {
                const cfg = PET_SPECIES_CATALOG[specId];
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${specId}-${idx}`}
                    onClick={() => {
                      soundFX.playUiClick();
                      setSelectedIndex(idx);
                    }}
                    className={`flex flex-col items-center p-1 rounded-xl border transition-transform ${
                      isSelected
                        ? 'bg-white border-purple-500 scale-105 shadow-sm'
                        : 'bg-white/70 border-transparent hover:bg-white'
                    }`}
                  >
                    <PetAvatarBadge speciesId={specId} size="sm" />
                    <span className="text-[10px] font-semibold text-slate-700 truncate w-full mt-0.5">
                      {cfg.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'idle' && (
          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 mb-3">
            <span>Common: 45%</span>
            <span aria-hidden="true">·</span>
            <span className="text-sky-600 font-medium">Rare: 30%</span>
            <span aria-hidden="true">·</span>
            <span className="text-purple-600 font-medium">Epic: 25%</span>
          </div>
        )}

        {errorMsg && (
          <div className="w-full mb-3 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 w-full mb-3">
          <button
            disabled={phase === 'cracking' || phase === 'burst'}
            onClick={() => triggerPull(1)}
            className="h-12 rounded-2xl bg-[#C084FC] hover:bg-[#A855F7] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-between px-3.5 shadow-md text-white font-semibold"
          >
            <div className="flex items-center gap-1.5">
              <GoldenEggIcon className="w-5 h-6" />
              <span className="text-sm font-bold whitespace-nowrap">1x</span>
            </div>
            <span className="bg-white text-slate-700 font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded-xl shadow-xs whitespace-nowrap">
              ✦ {GACHA_SINGLE_COST}
            </span>
          </button>

          <button
            disabled={phase === 'cracking' || phase === 'burst'}
            onClick={() => triggerPull(10)}
            className="h-12 rounded-2xl bg-[#FDA4AF] hover:bg-[#FB7185] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-between px-3.5 shadow-md text-white font-semibold"
          >
            <div className="flex items-center gap-1.5">
              <GoldenEggIcon className="w-5 h-6" />
              <span className="text-sm font-bold whitespace-nowrap">10x</span>
            </div>
            <span className="bg-white text-slate-700 font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded-xl shadow-xs whitespace-nowrap">
              ✦ {GACHA_TEN_COST}
            </span>
          </button>
        </div>

        <button
          onClick={() => {
            soundFX.playUiClick();
            onClose();
          }}
          className="w-full h-11 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-sm transition-colors"
        >
          Kembali
        </button>
      </div>
    </div>
  );
};
