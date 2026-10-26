import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  IslandThemeId,
  LivePetTelemetry,
  OwnedPetInstance,
  TimeOfDay,
} from '../types/pet';
import {
  applyIslandTheme,
  applyTimeOfDayLighting,
  buildFloatingIslandScene,
  IslandEnvironmentRefs,
  triggerLightningStrike,
} from '../three/islandBuilder';
import {
  AutonomousPetAgent,
  createTapHeartStarBurst,
  TapEffectParticle,
} from '../three/petAIController';
import { createProceduralPetRig } from '../three/petBuilder';
import { soundFX } from '../utils/sound';

export type PerformanceMode = 'potato' | 'hd';

interface SanctuaryCanvasProps {
  deployedPets: OwnedPetInstance[];
  timeOfDay: TimeOfDay;
  islandThemeId?: IslandThemeId;
  performanceMode?: PerformanceMode;
  telemetryEnabled?: boolean;
  cameraResetTrigger: number;
  onPetTapped: (
    instanceId: string,
    bonusCoins: number,
    screenX: number,
    screenY: number,
    nickname: string
  ) => void;
  onPassiveCoinTick: (coinsEarned: number) => void;
  onTelemetryUpdate: (telemetry: LivePetTelemetry[]) => void;
}

const _projVec = new THREE.Vector3();

export const SanctuaryCanvas: React.FC<SanctuaryCanvasProps> = ({
  deployedPets,
  timeOfDay,
  islandThemeId = 'dc_island_1',
  performanceMode = 'potato',
  telemetryEnabled = false,
  cameraResetTrigger,
  onPetTapped,
  onPassiveCoinTick,
  onTelemetryUpdate,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const callbacksRef = useRef({
    onPetTapped,
    onPassiveCoinTick,
    onTelemetryUpdate,
    telemetryEnabled,
    performanceMode,
    islandThemeId,
  });
  useEffect(() => {
    callbacksRef.current = {
      onPetTapped,
      onPassiveCoinTick,
      onTelemetryUpdate,
      telemetryEnabled,
      performanceMode,
      islandThemeId,
    };
  }, [
    onPetTapped,
    onPassiveCoinTick,
    onTelemetryUpdate,
    telemetryEnabled,
    performanceMode,
    islandThemeId,
  ]);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const envRefs = useRef<IslandEnvironmentRefs | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const agentsMapRef = useRef<Map<string, AutonomousPetAgent>>(new Map());
  const petsContainerRef = useRef<THREE.Group | null>(null);

  // Update lighting & refresh cached shadow map when TimeOfDay changes
  useEffect(() => {
    if (sceneRef.current && envRefs.current) {
      applyTimeOfDayLighting(sceneRef.current, envRefs.current, timeOfDay);
      if (rendererRef.current) {
        rendererRef.current.shadowMap.needsUpdate = true;
      }
    }
  }, [timeOfDay]);

  const weatherStateRef = useRef({
    nextStrikeCooldown: 1.2,
    activeStrikeTimer: 0,
  });

  // Update 3D Island Biome Theme (DC Island, Abyss, Neraka/Inferno, Glacier, Sakura, Celestial, etc.)
  useEffect(() => {
    if (envRefs.current) {
      applyIslandTheme(envRefs.current, islandThemeId);
      if (islandThemeId === 'inferno_hell' || islandThemeId === 'abyss_void') {
        // Trigger an early atmospheric lightning strike shortly after entering Inferno Hell or Abyss Island
        weatherStateRef.current.nextStrikeCooldown = 1.0;
        weatherStateRef.current.activeStrikeTimer = 0;
      }
      if (rendererRef.current) {
        rendererRef.current.shadowMap.needsUpdate = true;
      }
    }
  }, [islandThemeId]);

  // Adjust pixel ratio dynamically when user switches between Mode Enteng (HP Kentang) & Mode HD
  useEffect(() => {
    const renderer = rendererRef.current;
    const container = canvasMountRef.current;
    if (!renderer || !container) return;

    const targetDpr =
      performanceMode === 'potato'
        ? 1
        : Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(targetDpr);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.needsUpdate = true;
  }, [performanceMode]);

  useEffect(() => {
    if (cameraResetTrigger > 0 && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 8.6, 11.4);
      controlsRef.current.target.set(0, -0.1, 0);
      controlsRef.current.update();
    }
  }, [cameraResetTrigger]);

  useEffect(() => {
    const petsContainer = petsContainerRef.current;
    if (!petsContainer) return;

    const currentMap = agentsMapRef.current;
    const nextIds = new Set(deployedPets.map((p) => p.instanceId));

    for (const [id, agent] of currentMap.entries()) {
      if (!nextIds.has(id)) {
        petsContainer.remove(agent.rig.root);
        currentMap.delete(id);
      }
    }

    deployedPets.forEach((pet, idx) => {
      const stage = Math.max(pet.star || 1, pet.level || 1);
      if (!currentMap.has(pet.instanceId)) {
        const rig = createProceduralPetRig(
          pet.speciesId,
          pet.instanceId,
          stage
        );
        petsContainer.add(rig.root);
        const angle = (idx / Math.max(1, deployedPets.length)) * Math.PI * 2;
        const agent = new AutonomousPetAgent(
          pet.instanceId,
          pet.speciesId,
          pet.nickname,
          rig,
          angle,
          stage
        );
        currentMap.set(pet.instanceId, agent);
      } else {
        const existing = currentMap.get(pet.instanceId)!;
        existing.nickname = pet.nickname;
        existing.applyStarScale(stage);
      }
    });
  }, [deployedPets]);

  useEffect(() => {
    const container = canvasMountRef.current;
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
      powerPreference: 'high-performance',
      stencil: false,
    });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    const initialDpr =
      isSoftwareGl || callbacksRef.current.performanceMode === 'potato'
        ? 1
        : Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(initialDpr);

    // Enable realistic shadow mapping with cached shadow pass (0% per-frame shadow overhead!)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.2,
      90
    );
    camera.position.set(0, 8.6, 11.4);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 5.2;
    controls.maxPolarAngle = Math.PI / 2.38;
    controls.minAzimuthAngle = -Math.PI / 2.1;
    controls.maxAzimuthAngle = Math.PI / 2.1;
    controls.minDistance = 6.5;
    controls.maxDistance = 17.5;
    controls.target.set(0, -0.1, 0);
    controls.update();
    controlsRef.current = controls;

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const env = buildFloatingIslandScene(scene, maxAnisotropy, isSoftwareGl);
    envRefs.current = env;
    applyIslandTheme(env, islandThemeId, maxAnisotropy);
    applyTimeOfDayLighting(scene, env, timeOfDay);
    renderer.shadowMap.needsUpdate = true;

    const petsContainer = new THREE.Group();
    env.islandGroup.add(petsContainer);
    petsContainerRef.current = petsContainer;

    const fxContainer = new THREE.Group();
    env.islandGroup.add(fxContainer);
    const activeTapParticles: TapEffectParticle[] = [];

    deployedPets.forEach((pet, idx) => {
      const stage = Math.max(pet.star || 1, pet.level || 1);
      const rig = createProceduralPetRig(
        pet.speciesId,
        pet.instanceId,
        stage
      );
      petsContainer.add(rig.root);
      const angle = (idx / Math.max(1, deployedPets.length)) * Math.PI * 2;
      const agent = new AutonomousPetAgent(
        pet.instanceId,
        pet.speciesId,
        pet.nickname,
        rig,
        angle,
        stage
      );
      agentsMapRef.current.set(pet.instanceId, agent);
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (moveDist > 10) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const hitboxes: THREE.Object3D[] = [];
      agentsMapRef.current.forEach((agent) => hitboxes.push(agent.rig.hitbox));

      const intersects = raycaster.intersectObjects(hitboxes, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const instanceId = hit.userData.instanceId as string;
        const agent = agentsMapRef.current.get(instanceId);
        if (agent) {
          const bonus = agent.triggerTapReaction(
            callbacksRef.current.islandThemeId
          );
          createTapHeartStarBurst(
            fxContainer,
            agent.rig.root.position,
            activeTapParticles
          );

          _projVec.copy(agent.rig.root.position);
          _projVec.y += 1.2;
          _projVec.project(camera);
          const screenX = ((_projVec.x + 1) / 2) * rect.width + rect.left;
          const screenY = ((-_projVec.y + 1) / 2) * rect.height + rect.top;

          callbacksRef.current.onPetTapped(
            instanceId,
            bonus,
            screenX,
            screenY,
            agent.nickname
          );
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    domElem.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let telemetryTimer = 0;
    let frameParity = 0;

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
      const rawDelta = clock.getDelta();
      const delta = Math.min(rawDelta, 0.1);
      const elapsed = clock.getElapsedTime();
      frameParity = (frameParity + 1) & 1;

      controls.update();

      // 1. Subtle floating island bobbing
      env.islandGroup.position.y = Math.sin(elapsed * 1.1) * 0.09;

      // 2. Drifting background clouds across the sky
      env.cloudsGroup.children.forEach((cloud, idx) => {
        cloud.position.x += delta * (0.16 + (idx % 3) * 0.05);
        if (cloud.position.x > 14.5) {
          cloud.position.x = -14.5;
        }
      });

      // 3. Pond water ripple, scrolling waterfall stream, & mist puffs
      const rippleCycle = (elapsed * 0.45) % 1;
      env.pondRippleRing.scale.setScalar(0.65 + rippleCycle * 1.55);
      (env.pondRippleRing.material as THREE.MeshBasicMaterial).opacity =
        (1 - rippleCycle) * 0.58;

      const wfMat = env.waterfallStreamMesh.material as THREE.MeshBasicMaterial;
      if (wfMat.map) {
        wfMat.map.offset.y = (elapsed * 0.95) % 1;
      }

      // Update secondary ambient animations on alternating frames in potato mode to save CPU
      if (callbacksRef.current.performanceMode === 'hd' || frameParity === 0) {
        env.waterfallMistGroup.children.forEach((puff, idx) => {
          const cycle = (elapsed * 1.2 + idx * 0.22) % 1;
          puff.position.y = cycle * 0.48;
          puff.scale.setScalar(0.18 + Math.sin(cycle * Math.PI) * 0.12);
        });

        // 4. Gentle breeze sway on all smooth tree canopies
        env.treeCanopyGroups.forEach((canopy, idx) => {
          canopy.rotation.z = Math.sin(elapsed * 1.5 + idx) * 0.028;
        });
      }

      // 5. Dynamic Storm Weather (Light Rain + Occasional Lightning Bolts) on Inferno Hell & Abyss Island
      const currentTheme = callbacksRef.current.islandThemeId;
      const isStormIsland =
        currentTheme === 'inferno_hell' || currentTheme === 'abyss_void';

      if (isStormIsland && env.rainLineSegments.visible) {
        // Animate falling light rain streaks in a single BufferAttribute pass
        const rainPos = env.rainLineSegments.geometry.attributes
          .position as THREE.BufferAttribute;
        const dropSpeedY = 11.2 * delta;
        const windDriftX = -1.5 * delta;
        const dropCount = rainPos.count / 2;

        for (let i = 0; i < dropCount; i++) {
          const topIdx = i * 2;
          const botIdx = topIdx + 1;
          let x = rainPos.getX(topIdx) + windDriftX;
          let y = rainPos.getY(topIdx) - dropSpeedY;
          const z = rainPos.getZ(topIdx);

          if (y < 0.1) {
            y = 7.8 + (i % 5) * 0.35;
            x = ((i * 1.73) % 12) - 6.0;
          }

          rainPos.setXYZ(topIdx, x, y, z);
          rainPos.setXYZ(botIdx, x - 0.08, y - 0.55, z);
        }
        rainPos.needsUpdate = true;

        // Occasional 3D Branching Lightning Strikes + Ambient Flash
        const ws = weatherStateRef.current;
        if (ws.activeStrikeTimer > 0) {
          ws.activeStrikeTimer -= delta;
          if (ws.activeStrikeTimer <= 0) {
            env.lightningBoltGroup.visible = false;
            env.lightningFlashLight.intensity = 0;
          } else {
            // Double-flicker pulse during the 0.32s strike
            const progress = 1 - ws.activeStrikeTimer / 0.32;
            const flicker = Math.abs(Math.sin(progress * Math.PI * 3));
            env.lightningBoltGroup.visible = flicker > 0.2;
            env.lightningFlashLight.intensity = flicker * 9.5;
            env.lightningImpactRing.scale.setScalar(0.45 + progress * 2.4);
            (
              env.lightningImpactRing.material as THREE.MeshBasicMaterial
            ).opacity = (1 - progress) * 0.85;
          }
        } else {
          ws.nextStrikeCooldown -= delta;
          if (ws.nextStrikeCooldown <= 0) {
            triggerLightningStrike(env, currentTheme);
            soundFX.playThunderStrike();
            ws.activeStrikeTimer = 0.32;
            ws.nextStrikeCooldown = 4.2 + Math.random() * 4.0;
          }
        }
      }

      // 6. Update Autonomous Pet Agents (2.5D Transparent GIF Billboards + FSM + Star/Synergy Boost)
      let totalTickCoins = 0;
      agentsMapRef.current.forEach((agent) => {
        const earned = agent.update(
          delta,
          elapsed,
          env.pondLocation,
          env.treeLocation,
          camera.quaternion,
          callbacksRef.current.islandThemeId
        );
        totalTickCoins += earned;
      });

      if (totalTickCoins > 0) {
        callbacksRef.current.onPassiveCoinTick(totalTickCoins);
      }

      // 7. Update 3D Heart & Star tap particles
      for (let i = activeTapParticles.length - 1; i >= 0; i--) {
        const p = activeTapParticles[i];
        p.age += delta;
        if (p.age >= p.maxAge) {
          fxContainer.remove(p.mesh);
          p.mesh.geometry.dispose();
          activeTapParticles.splice(i, 1);
        } else {
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.velocity.y -= 2.2 * delta;
          p.mesh.rotation.y += delta * 6;
          p.mesh.rotation.x += delta * 4;
          const scale = 1 - (p.age / p.maxAge) * 0.75;
          p.mesh.scale.setScalar(scale);
        }
      }

      // 8. Broadcast live FSM telemetry ONLY when the Architecture panel is open
      if (callbacksRef.current.telemetryEnabled) {
        telemetryTimer += delta;
        if (telemetryTimer >= 0.5) {
          telemetryTimer = 0;
          const list: LivePetTelemetry[] = [];
          agentsMapRef.current.forEach((a) => list.push(a.getTelemetry()));
          callbacksRef.current.onTelemetryUpdate(list);
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (container.contains(domElem)) {
        container.removeChild(domElem);
      }
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      aria-label="Kanvas 3D Pulau Melayang NuePet Zoo"
    />
  );
};
