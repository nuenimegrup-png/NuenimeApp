import * as THREE from 'three';
import {
  ELEMENT_SYNERGY_MULTIPLIER,
  getStarScaleMultiplier,
  hasIslandElementSynergy,
  InteractionTargetType,
  IslandThemeId,
  LivePetTelemetry,
  PET_SPECIES_CATALOG,
  PetAIState,
  PetSpeciesId,
} from '../types/pet';
import {
  animatePetRig,
  ArticulatedPetRig,
  updatePetRigStageTexture,
} from './petBuilder';

// Pre-allocated math vectors at module scope to prevent GC in the render loop
const _toTarget = new THREE.Vector3();
const _pondStandSpot = new THREE.Vector3();
const _treeStandSpot = new THREE.Vector3();

export interface TapEffectParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
}

export class AutonomousPetAgent {
  public instanceId: string;
  public speciesId: PetSpeciesId;
  public nickname: string;
  public star: number = 1;
  public rig: ArticulatedPetRig;
  public state: PetAIState = PetAIState.IDLE;
  public stateTimer: number = 3.5;
  public targetPosition: THREE.Vector3 = new THREE.Vector3();
  public targetZone: InteractionTargetType = 'none';
  public walkPhase: number = 0;
  public unclaimedCoins: number = 0;
  private coinAccumulator: number = 0;

  constructor(
    instanceId: string,
    speciesId: PetSpeciesId,
    nickname: string,
    rig: ArticulatedPetRig,
    initialAngle: number,
    star: number = 1
  ) {
    this.instanceId = instanceId;
    this.speciesId = speciesId;
    this.nickname = nickname;
    this.star = star;
    this.rig = rig;
    this.applyStarScale(star);

    const startRadius = 1.1 + Math.random() * 2.8;
    this.rig.root.position.set(
      Math.cos(initialAngle) * startRadius,
      0,
      Math.sin(initialAngle) * startRadius
    );
    this.stateTimer = 2.5 + Math.random() * 3.0;
  }

  public applyStarScale(star: number): void {
    this.star = star;
    const scale = getStarScaleMultiplier(star);
    this.rig.root.scale.setScalar(scale);
    updatePetRigStageTexture(this.rig, this.speciesId, star);
  }

  public triggerTapReaction(islandThemeId?: IslandThemeId): number {
    const config = PET_SPECIES_CATALOG[this.speciesId];
    this.state = PetAIState.REACT_TAP;
    this.stateTimer = 1.65;
    const starMult = Math.pow(2, Math.max(0, this.star - 1));
    const synergyMult =
      islandThemeId && hasIslandElementSynergy(this.speciesId, islandThemeId)
        ? ELEMENT_SYNERGY_MULTIPLIER
        : 1;
    const bonus = Math.round(config.tapBonusCoins * starMult * synergyMult);
    this.unclaimedCoins += bonus;
    return bonus;
  }

  public update(
    delta: number,
    elapsed: number,
    pondCenter: THREE.Vector3,
    treeCenter: THREE.Vector3,
    cameraQuaternion?: THREE.Quaternion,
    islandThemeId?: IslandThemeId
  ): number {
    const config = PET_SPECIES_CATALOG[this.speciesId];

    // Akumulasi koin pasif presisi harian (1 hari = 86.400 detik)
    this.coinAccumulator += delta;
    let newlyProduced = 0;
    const starMult = Math.pow(2, Math.max(0, this.star - 1));
    const synergyMult =
      islandThemeId && hasIslandElementSynergy(this.speciesId, islandThemeId)
        ? ELEMENT_SYNERGY_MULTIPLIER
        : 1;
    const dailyRate = config.coinsPerDay * starMult * synergyMult;
    const secondsPerCoin = dailyRate > 0 ? 86400 / dailyRate : 86400;

    if (this.coinAccumulator >= secondsPerCoin) {
      const wholeCoins = Math.floor(this.coinAccumulator / secondsPerCoin);
      this.coinAccumulator -= wholeCoins * secondsPerCoin;
      newlyProduced = wholeCoins;
      this.unclaimedCoins += newlyProduced;
    }

    this.stateTimer -= delta;

    if (this.state === PetAIState.REACT_TAP) {
      if (this.stateTimer <= 0) {
        this.enterIdleState();
      }
    } else if (this.state === PetAIState.IDLE) {
      if (this.stateTimer <= 0) {
        if (Math.random() < 0.65) {
          this.enterRoamState(pondCenter, treeCenter);
        } else {
          this.enterInteractMoveState(pondCenter, treeCenter);
        }
      }
    } else if (this.state === PetAIState.ROAM) {
      _toTarget.subVectors(this.targetPosition, this.rig.root.position);
      _toTarget.y = 0;
      const dist = _toTarget.length();

      if (dist < 0.14 || this.stateTimer <= 0) {
        if (this.targetZone !== 'none') {
          this.state = PetAIState.INTERACT;
          this.stateTimer = 4.0 + Math.random() * 3.0;
          const lookPoint = this.targetZone === 'pond' ? pondCenter : treeCenter;
          this.rig.facingDir =
            lookPoint.x - this.rig.root.position.x >= 0 ? 1 : -1;
        } else {
          this.enterIdleState();
        }
      } else {
        _toTarget.normalize();
        // Flip 2.5D dragon sprite horizontally based on X movement direction
        if (Math.abs(_toTarget.x) > 0.08) {
          this.rig.facingDir = _toTarget.x >= 0 ? 1 : -1;
        }

        const step = Math.min(dist, config.moveSpeed * delta);
        this.rig.root.position.x += _toTarget.x * step;
        this.rig.root.position.z += _toTarget.z * step;
        this.walkPhase += delta * config.moveSpeed * 6.2;
      }
    } else if (this.state === PetAIState.INTERACT) {
      if (this.stateTimer <= 0) {
        this.targetZone = 'none';
        this.enterRoamState(pondCenter, treeCenter);
      }
    }

    animatePetRig(
      this.rig,
      this.speciesId,
      this.state,
      elapsed,
      this.walkPhase,
      this.stateTimer,
      cameraQuaternion
    );

    return newlyProduced;
  }

  private enterIdleState(): void {
    this.state = PetAIState.IDLE;
    this.targetZone = 'none';
    this.stateTimer = 3.0 + Math.random() * 3.0;
  }

  private enterRoamState(pondCenter: THREE.Vector3, treeCenter: THREE.Vector3): void {
    this.state = PetAIState.ROAM;
    this.targetZone = 'none';
    this.stateTimer = 7.0;

    for (let attempt = 0; attempt < 12; attempt++) {
      const r = 0.6 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const candidateX = Math.cos(theta) * r;
      const candidateZ = Math.sin(theta) * r;

      const distToPond = Math.hypot(candidateX - pondCenter.x, candidateZ - pondCenter.z);
      const distToTree = Math.hypot(candidateX - treeCenter.x, candidateZ - treeCenter.z);

      if (distToPond > 1.85 && distToTree > 0.95) {
        this.targetPosition.set(candidateX, 0, candidateZ);
        return;
      }
    }
    this.targetPosition.set(0, 0, 1.8);
  }

  private enterInteractMoveState(pondCenter: THREE.Vector3, treeCenter: THREE.Vector3): void {
    const config = PET_SPECIES_CATALOG[this.speciesId];
    const choosePond =
      config.preferredZone === 'pond' ? Math.random() < 0.7 : Math.random() < 0.35;

    this.state = PetAIState.ROAM;
    this.stateTimer = 7.5;

    if (choosePond) {
      this.targetZone = 'pond';
      const rimAngle = Math.random() * Math.PI * 1.4 - 0.3;
      _pondStandSpot.set(
        pondCenter.x + Math.cos(rimAngle) * 1.85,
        0,
        pondCenter.z + Math.sin(rimAngle) * 1.85
      );
      this.targetPosition.copy(_pondStandSpot);
    } else {
      this.targetZone = 'tree';
      const shadeAngle = Math.random() * Math.PI * 2;
      _treeStandSpot.set(
        treeCenter.x + Math.cos(shadeAngle) * 1.2,
        0,
        treeCenter.z + Math.sin(shadeAngle) * 1.2
      );
      this.targetPosition.copy(_treeStandSpot);
    }
  }

  public getTelemetry(): LivePetTelemetry {
    return {
      instanceId: this.instanceId,
      speciesId: this.speciesId,
      nickname: this.nickname,
      state: this.state,
      stateTimer: Number(Math.max(0, this.stateTimer).toFixed(1)),
      targetZone: this.targetZone,
      position: {
        x: Number(this.rig.root.position.x.toFixed(2)),
        y: Number(this.rig.root.position.y.toFixed(2)),
        z: Number(this.rig.root.position.z.toFixed(2)),
      },
      unclaimedCoins: this.unclaimedCoins,
    };
  }
}

export function createTapHeartStarBurst(
  parentGroup: THREE.Group,
  origin: THREE.Vector3,
  activeParticles: TapEffectParticle[]
): void {
  const heartMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xe11d48,
    emissiveIntensity: 0.7,
    roughness: 0.25,
  });
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xeab308,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });

  for (let i = 0; i < 8; i++) {
    const isStar = i % 2 === 0;
    const geo = isStar
      ? new THREE.OctahedronGeometry(0.08, 0)
      : new THREE.DodecahedronGeometry(0.075, 0);
    const mesh = new THREE.Mesh(geo, isStar ? starMat : heartMat);
    mesh.position.set(origin.x, origin.y + 0.85, origin.z);

    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 0.65 + Math.random() * 0.55;
    const velocity = new THREE.Vector3(
      Math.cos(angle) * speed,
      1.2 + Math.random() * 0.7,
      Math.sin(angle) * speed
    );

    parentGroup.add(mesh);
    activeParticles.push({
      mesh,
      velocity,
      age: 0,
      maxAge: 0.95,
    });
  }
}
