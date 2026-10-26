import React, { useState } from 'react';
import { X, Code2, Cpu, Layers } from 'lucide-react';
import { LivePetTelemetry, PET_SPECIES_CATALOG } from '../types/pet';
import { soundFX } from '../utils/sound';

interface ArchitectureGuideDrawerProps {
  isOpen: boolean;
  telemetry: LivePetTelemetry[];
  onClose: () => void;
}

export const ArchitectureGuideDrawer: React.FC<ArchitectureGuideDrawerProps> = ({
  isOpen,
  telemetry,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'fsm' | 'model' | 'guide'>('fsm');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 sm:p-4">
      <div className="w-full max-w-4xl max-h-[88vh] rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="font-['Fredoka'] text-lg sm:text-xl font-bold tracking-tight">
              Arsitektur Kode & Live AI State Inspector
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Dokumentasi teknis struktur data model hewan, Finite-State Machine (FSM), dan panduan implementasi scene 3D
            </p>
          </div>
          <button
            onClick={() => {
              soundFX.playUiClick();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 transition-colors"
            aria-label="Tutup Arsitektur"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Control Tabs */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => {
              soundFX.playUiClick();
              setActiveTab('fsm');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'fsm'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            1. State Management & Live FSM AI
          </button>

          <button
            onClick={() => {
              soundFX.playUiClick();
              setActiveTab('model');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'model'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            2. Struktur Data Model Hewan
          </button>

          <button
            onClick={() => {
              soundFX.playUiClick();
              setActiveTab('guide');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'guide'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            3. Panduan Implementasi Scene 3D
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">
          {activeTab === 'fsm' && (
            <>
              <div>
                <h3 className="font-bold text-base text-slate-900 mb-1">
                  Pemantau Real-Time Autonomous AI (Finite-State Machine)
                </h3>
                <p className="text-xs text-slate-600 mb-3">
                  Tabel di bawah ini menampilkan status langsung dari setiap hewan 3D yang sedang aktif di pulau melayang saat ini:
                </p>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-3 font-semibold">Nama Pet</th>
                        <th className="py-2.5 px-3 font-semibold">Spesies</th>
                        <th className="py-2.5 px-3 font-semibold">State FSM Aktif</th>
                        <th className="py-2.5 px-3 font-semibold">Sisa Durasi</th>
                        <th className="py-2.5 px-3 font-semibold">Target Interaksi</th>
                        <th className="py-2.5 px-3 font-semibold">Koordinat (X, Z)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {telemetry.map((t) => {
                        const spec = PET_SPECIES_CATALOG[t.speciesId];
                        return (
                          <tr key={t.instanceId} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                              {t.nickname}
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-600">
                              {spec.title} ({spec.rarity})
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`font-semibold ${
                                  t.state === 'REACT_TAP'
                                    ? 'text-rose-600'
                                    : t.state === 'INTERACT'
                                    ? 'text-purple-600'
                                    : t.state === 'ROAM'
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                {t.state}
                              </span>
                            </td>
                            <td className="py-2 px-3">{t.stateTimer}s</td>
                            <td className="py-2 px-3">
                              {t.targetZone === 'pond'
                                ? 'Tepi Kolam Air'
                                : t.targetZone === 'tree'
                                ? 'Bawah Pohon Rindang'
                                : 'Area Rumput'}
                            </td>
                            <td className="py-2 px-3">
                              ({t.position.x}, {t.position.z})
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-900 mb-2">
                  Arsitektur Kode Finite-State Machine (`AutonomousPetAgent`)
                </h4>
                <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
{`export enum PetAIState {
  IDLE = 'IDLE',           // Diam bernapas / menjilati cakar (3 - 6 detik)
  ROAM = 'ROAM',           // Berjalan menuju titik waypoint acak di rumput
  INTERACT = 'INTERACT',   // Minum di tepi kolam atau tidur/meditasi di bawah pohon
  REACT_TAP = 'REACT_TAP', // Reaksi loncat gembira + partikel hati/bintang saat di-tap
}

// Transisi State di dalam Game Loop (THREE.Clock getDelta):
switch (this.state) {
  case PetAIState.IDLE:
    if (this.stateTimer <= 0) {
      // 65% Roam ke titik rumput acak, 35% menuju zona Kolam / Pohon
      Math.random() < 0.65
        ? this.enterRoamState(pondCenter, treeCenter)
        : this.enterInteractMoveState(pondCenter, treeCenter);
    }
    break;
  case PetAIState.ROAM:
    // Interpolasi rotasi Y menghadap target & translasi posisi
    if (distanceToTarget < 0.14) {
      this.state = this.targetZone !== 'none' ? PetAIState.INTERACT : PetAIState.IDLE;
    }
    break;
  case PetAIState.REACT_TAP:
    // Dipicu oleh THREE.Raycaster saat pemain menyentuh hitbox hewan
    // Memutar animasi loncat 360 derajat + partikel hati & bonus koin
    if (this.stateTimer <= 0) this.enterIdleState();
    break;
}`}
                </pre>
              </div>
            </>
          )}

          {activeTab === 'model' && (
            <div className="space-y-4">
              <h3 className="font-bold text-base text-slate-900">
                Struktur Data Model Hewan & Ekonomi Idle
              </h3>
              <p className="text-xs text-slate-600">
                Setiap spesies hewan didefinisikan menggunakan skema TypeScript yang memisahkan konfigurasi statis spesies (`PetSpeciesConfig`) dan instance koleksi milik pemain (`OwnedPetInstance`):
              </p>
              <pre className="p-4 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
{`export interface PetSpeciesConfig {
  id: 'red_panda' | 'forest_cat' | 'baby_dragon' | 'mystic_fox';
  name: string;
  title: string;
  rarity: 'Common' | 'Rare' | 'Epic';
  gachaWeight: number;       // Common: 75%, Rare: 18%, Epic: 7%
  coinsPerDay: number;       // Common: 50/hari, Rare: 100/hari, Epic: 200/hari
  tapBonusCoins: number;     // Bonus koin instan saat hewan disentuh (tap)
  moveSpeed: number;         // Kecepatan jelajah di permukaan pulau
  preferredZone: 'pond' | 'tree';
}

export interface OwnedPetInstance {
  instanceId: string;
  speciesId: PetSpeciesId;
  nickname: string;
  isDeployed: boolean;       // Dibatasi maksimal 6 ekor aktif di pulau (MAX_ISLAND_PETS = 6)
  totalCoinsProduced: number;
}`}
              </pre>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4">
              <h3 className="font-bold text-base text-slate-900">
                Panduan Implementasi Scene 3D Langkah demi Langkah
              </h3>
              <ol className="space-y-3 text-xs text-slate-700 list-decimal list-inside leading-relaxed">
                <li>
                  <strong className="text-slate-900">Inisialisasi Renderer & Kamera Isometrik Semi-Tetap:</strong>{' '}
                  Gunakan <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">THREE.WebGLRenderer</code> dengan <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">ACESFilmicToneMapping</code> dan <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">RoomEnvironment</code>. Batasi sudut <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">OrbitControls</code> (<code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">minPolarAngle = Math.PI / 5.2</code>, <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">maxPolarAngle = Math.PI / 2.45</code>, <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">minDistance = 6.2</code>, <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">maxDistance = 15.5</code>) agar pemain mendapat perspektif isometrik yang nyaman dan dapat melakukan zoom ke hewan.
                </li>
                <li>
                  <strong className="text-slate-900">Konstruksi Pulau Melayang Low-Poly Stylized:</strong>{' '}
                  Gabungkan silinder rumput bertekstur kanvas di bagian atas dengan kerucut tebing batu berfaset (<code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">flatShading: true</code>) di bagian bawah, dikelilingi batu tebing organik, jembatan kayu melengkung di tepi tebing, kolam air transparan (<code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">MeshPhysicalMaterial</code>), dan pohon rindang berlapis.
                </li>
                <li>
                  <strong className="text-slate-900">Efek Atmosfer & Pencahayaan Hangat:</strong>{' '}
                  Pasang kombinasi <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">HemisphereLight</code> (langit biru sejuk vs pantulan rumput) dan <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">DirectionalLight</code> bersudut hangat dengan <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">PCFSoftShadowMap</code>, awan latar yang bergeser perlahan pada sumbu X, serta sistem partikel <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">THREE.Points</code> untuk debu cahaya / kunang-kunang.
                </li>
                <li>
                  <strong className="text-slate-900">Rigging Prosedural 4 Karakter Hewan:</strong>{' '}
                  Susun setiap hewan sebagai hierarki <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">THREE.Group</code> (<code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">bodyGroup</code>, <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">headGroup</code>, <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">tailGroup</code>, <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">legs[4]</code>, serta <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">wings</code> untuk Bayi Naga dan <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">auraGroup</code> untuk Rubah Ekor Berkilau) sehingga animasi sinusoidal di dalam <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">animatePetRig()</code> berjalan mulus pada 60 FPS.
                </li>
                <li>
                  <strong className="text-slate-900">Deteksi Sentuhan (Raycasting Layer 1) & Gacha Telur 3D:</strong>{' '}
                  Beri setiap hewan silinder hitbox tak terlihat pada layer 1 untuk dideteksi oleh <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">THREE.Raycaster</code> saat pemain melakukan tap. Untuk modal Gacha, gunakan <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">THREE.LatheGeometry</code> bermaterial emas berkilau yang bertransisi melalui fase <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">idle → cracking → burst → reveal</code>.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
