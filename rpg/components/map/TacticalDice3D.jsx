'use client';

import { useEffect, useRef, useState } from 'react';
import { User, X, Zap } from 'lucide-react';
import {
  playDiceBounceSound,
  playCriticalSuccessSound,
  playCriticalFumbleSound,
  playDiceSettleSound,
} from '../../lib/dice-audio';

/**
 * Componente de Rolagem Tática de Dados 3D (WebGL via Three.js)
 *
 * Arquitetura 3D Refatorada:
 * - Malhas poliedrais convexas sólidas e estanques para D4, D6, D8, D10, D12 e D20
 * - Mapeamento UV por face com CanvasTexture 512x512 de alta definição (zero Sprites flutuantes)
 * - D10 construído como Trapezoedro Pentagonal estritamente coplanar (10 faces pipa planas sem vincos diagonais)
 * - Cálculo do incentro geométrico exato de cada polígono (triângulo, quadrado, pipa, pentágono)
 * - Alinhamento matricial ortonormal (R = M_cam * M_face^T) garantindo que o número sorteado
 *   termine sempre voltado para a câmera e 100% em pé (nunca de cabeça para baixo)
 * - Trajetória física contínua com sombra de contato dinâmica na mesa e amortecimento suave por quaternions
 * - Efeitos sonoros procedurais Web Audio API (quiques, falha crítica 1 no d20 e sucesso máximo)
 *
 * Zero ícones de estrela em estrita conformidade com as diretrizes do projeto.
 */
export function TacticalDice3D({
  currentRoll,
  onSettled,
  onDismiss,
  className = '',
}) {
  const mountRef = useRef(null);
  const onSettledRef = useRef(onSettled);
  const onDismissRef = useRef(onDismiss);
  const [displayedRoll, setDisplayedRoll] = useState(null);
  const [phase, setPhase] = useState('idle'); // 'rolling' | 'settled' | 'fading'

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Chave estável da rolagem para evitar reinicializações por re-render do pai ou eco do Firestore
  const rollKey = currentRoll
    ? `${currentRoll.seed || currentRoll.id}_${currentRoll.sides}_${currentRoll.roll}`
    : null;

  useEffect(() => {
    if (!currentRoll || !rollKey) return;

    const mountNode = mountRef.current;
    const rollSnapshot = { ...currentRoll };
    setDisplayedRoll(rollSnapshot);
    setPhase('rolling');

    const soundPlayed = {
      bounce1: false,
      bounce2: false,
      bounce3: false,
      settle: false,
      fanfare: false,
    };

    let disposed = false;
    let animId = null;
    let renderer = null;
    let resizeObserver = null;
    const disposableTextures = [];
    const disposableMaterials = [];
    const disposableGeometries = [];

    async function init3DDice() {
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const THREE = await import('three');
      if (disposed || !mountRef.current) return;

      const width = Math.max(mount.clientWidth || 640, 320);
      const height = Math.max(mount.clientHeight || 480, 280);

      // 1. Cena e Câmera em ângulo tático de mesa (distância segura sem clipping)
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.5, 60);
      camera.position.set(0, -2.5, 11.4);
      camera.lookAt(0, 0, 0);

      // 2. Renderizador WebGL com antialiasing e tone mapping cinematográfico
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
      } catch {
        renderer = new THREE.WebGLRenderer({ alpha: true });
      }

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.22;

      mount.replaceChildren(renderer.domElement);

      // 3. Iluminação de estúdio tridimensional para destacar facetas e gravuras
      const ambientLight = new THREE.AmbientLight(0x1e293b, 2.2);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
      keyLight.position.set(4.5, 6.5, 9.0);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
      fillLight.position.set(-6.0, -3.0, 5.0);
      scene.add(fillLight);

      const rimColor = rollSnapshot.is_max
        ? 0xf59e0b
        : rollSnapshot.is_fumble
        ? 0xf43f5e
        : 0x94a3b8;
      const rimLight = new THREE.DirectionalLight(rimColor, 2.1);
      rimLight.position.set(0, 5.5, -4.0);
      scene.add(rimLight);

      const topPointLight = new THREE.PointLight(0xffffff, 1.1, 18);
      topPointLight.position.set(0, -1.0, 6.5);
      scene.add(topPointLight);

      // 4. Construção do Poliedro Sólido com UVs por Face e Texturas 512x512
      const validSides = [4, 6, 8, 10, 12, 20].includes(Number(rollSnapshot.sides))
        ? Number(rollSnapshot.sides)
        : 20;
      const rollValue = Math.max(1, Math.min(validSides, Number(rollSnapshot.roll) || 1));

      const maxAnisotropy = renderer.capabilities?.getMaxAnisotropy
        ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
        : 1;

      const {
        diceGroup,
        faces,
        winningMaterial,
        textures,
        materials,
        geometries,
      } = buildPolyhedronDie(THREE, validSides, rollValue, rollSnapshot, maxAnisotropy);

      disposableTextures.push(...textures);
      disposableMaterials.push(...materials);
      disposableGeometries.push(...geometries);

      scene.add(diceGroup);

      // 5. Sombra de contato dinâmica projetada sobre o mapa (plano Z = -1.45)
      const shadowTexture = createSoftShadowTexture(THREE);
      if (shadowTexture) disposableTextures.push(shadowTexture);

      const shadowGeo = new THREE.PlaneGeometry(4.4, 4.4);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      });
      disposableGeometries.push(shadowGeo);
      disposableMaterials.push(shadowMat);

      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.position.set(0, 0, -1.48);
      scene.add(shadowMesh);

      // 6. Anel de choque arcano no repouso do dado
      const ringGeo = new THREE.RingGeometry(1.55, 1.82, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: rollSnapshot.is_max
          ? 0xfbbf24
          : rollSnapshot.is_fumble
          ? 0xf43f5e
          : 0x38bdf8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      disposableGeometries.push(ringGeo);
      disposableMaterials.push(ringMat);

      const groundRing = new THREE.Mesh(ringGeo, ringMat);
      groundRing.position.set(0, 0, -1.42);
      scene.add(groundRing);

      // 7. Cálculo Matricial Exato da Rotação Final (Face Sorteada de Frente e Número em Pé)
      const targetFace = faces.find((f) => f.faceNum === rollValue) || faces[0];

      // Eixo Z da câmera (da origem em direção à lente da câmera)
      const zCam = camera.position.clone().normalize();
      // Eixo Y da tela projetado ortogonalmente ao eixo de visão da câmera
      const worldUp = new THREE.Vector3(0, 1, 0);
      const yCam = worldUp
        .clone()
        .sub(zCam.clone().multiplyScalar(worldUp.dot(zCam)))
        .normalize();
      // Eixo X da tela (direita)
      const xCam = new THREE.Vector3().crossVectors(yCam, zCam).normalize();

      const matTarget = new THREE.Matrix4().makeBasis(xCam, yCam, zCam);
      const matFace = new THREE.Matrix4().makeBasis(
        targetFace.u,
        targetFace.v,
        targetFace.normal
      );
      const matFaceInv = matFace.clone().transpose();
      const matFinal = new THREE.Matrix4().multiplyMatrices(matTarget, matFaceInv);
      const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(matFinal);

      // 8. Parâmetros Determinísticos de Arremesso e Rotação baseados no seed
      const seed = Number(rollSnapshot.seed) || 0.5;
      const rand = (n) => {
        const x = Math.sin(seed * 9973 + n * 101.3) * 43758.5453;
        return x - Math.floor(x);
      };

      // O dado entra vindo de uma borda da mesa em direção ao centro (0, 0)
      const throwAngle = rand(1) * Math.PI * 2;
      const throwRadius = 2.9 + rand(2) * 0.6;
      const startX = Math.cos(throwAngle) * throwRadius;
      const startY = Math.sin(throwAngle) * (throwRadius * 0.72);
      const startHeight = 2.55; // Altura segura acima da mesa (câmera está em Z = 11.4)

      // Múltiplas voltas completas que desaceleram suavemente até 0 em t = 1
      const signX = rand(3) > 0.5 ? 1 : -1;
      const signY = rand(4) > 0.5 ? 1 : -1;
      const signZ = rand(5) > 0.5 ? 1 : -1;
      const totalSpinX = signX * (2 + Math.floor(rand(6) * 2)) * Math.PI * 2 + (rand(7) - 0.5) * 1.8;
      const totalSpinY = signY * (2 + Math.floor(rand(8) * 2)) * Math.PI * 2 + (rand(9) - 0.5) * 1.8;
      const totalSpinZ = signZ * (1 + Math.floor(rand(10) * 2)) * Math.PI * 2 + (rand(11) - 0.5) * 1.4;

      const tumbleEuler = new THREE.Euler(0, 0, 0, 'XYZ');
      const tumbleQuat = new THREE.Quaternion();

      const startTime = performance.now();
      const ROLL_DURATION = 1620; // Tempo total de queda, quiques e assentamento
      const TOTAL_DURATION = 5200; // Tempo total até fechar suavemente

      function animate(now) {
        if (disposed) return;
        const elapsed = now - startTime;

        if (elapsed < ROLL_DURATION) {
          const t = Math.min(1, Math.max(0, elapsed / ROLL_DURATION));

          // Deslocamento horizontal X/Y com desaceleração suave
          const horizEase = 1 - Math.pow(1 - t, 2.35);
          const curX = THREE.MathUtils.lerp(startX, 0, horizEase);
          const curY = THREE.MathUtils.lerp(startY, 0, horizEase);

          // Altura Z acima da mesa com 3 arcos parabólicos de gravidade
          let heightZ = 0;
          if (t < 0.42) {
            // Queda inicial até o primeiro impacto na mesa
            const p1 = t / 0.42;
            heightZ = startHeight * (1 - p1 * p1);
            if (p1 > 0.94 && !soundPlayed.bounce1) {
              soundPlayed.bounce1 = true;
              playDiceBounceSound(0.92);
            }
          } else if (t < 0.73) {
            // Primeiro quique parabólico
            const p2 = (t - 0.42) / 0.31;
            heightZ = 1.15 * 4 * p2 * (1 - p2);
            if (p2 > 0.92 && !soundPlayed.bounce2) {
              soundPlayed.bounce2 = true;
              playDiceBounceSound(0.54);
            }
          } else if (t < 0.91) {
            // Segundo quique menor
            const p3 = (t - 0.73) / 0.18;
            heightZ = 0.36 * 4 * p3 * (1 - p3);
            if (p3 > 0.9 && !soundPlayed.bounce3) {
              soundPlayed.bounce3 = true;
              playDiceBounceSound(0.26);
            }
          } else {
            // Micro-assentamento final na superfície
            const p4 = (t - 0.91) / 0.09;
            heightZ = 0.06 * 4 * p4 * (1 - p4);
          }

          diceGroup.position.set(curX, curY, heightZ);
          diceGroup.scale.setScalar(1.0);

          // Sombra de contato acompanha o dado e reage à altura Z
          shadowMesh.position.set(
            curX + heightZ * 0.16,
            curY - heightZ * 0.16,
            -1.48
          );
          const shadowScale = 0.88 + heightZ * 0.18;
          shadowMesh.scale.setScalar(shadowScale);
          shadowMat.opacity = Math.max(0.2, 0.72 - heightZ * 0.16);

          // Rotação contínua por quaternions que converge exatamente para targetQuaternion em t = 1
          const rem = 1 - t;
          const angleX = totalSpinX * Math.pow(rem, 2.65);
          const angleY = totalSpinY * Math.pow(rem, 2.45);
          const angleZ = totalSpinZ * Math.pow(rem, 2.25);

          tumbleEuler.set(angleX, angleY, angleZ, 'XYZ');
          tumbleQuat.setFromEuler(tumbleEuler);
          diceGroup.quaternion.multiplyQuaternions(tumbleQuat, targetQuaternion);
        } else {
          // Dado assentado na face vencedora
          diceGroup.position.set(0, 0, 0);
          diceGroup.quaternion.copy(targetQuaternion);

          if (!soundPlayed.settle) {
            soundPlayed.settle = true;
            playDiceSettleSound();
          }

          if (!soundPlayed.fanfare) {
            soundPlayed.fanfare = true;
            setPhase('settled');
            if (onSettledRef.current) {
              onSettledRef.current(rollSnapshot);
            }

            if (rollSnapshot.is_max) {
              playCriticalSuccessSound();
            } else if (rollSnapshot.is_fumble) {
              playCriticalFumbleSound();
            }
          }

          const postElapsed = elapsed - ROLL_DURATION;

          // Leve destaque de escala para leitura cristalina do resultado
          const presentProgress = Math.min(1, postElapsed / 320);
          const presentEase = 1 - Math.pow(1 - presentProgress, 3);
          const scaleVal = 1.0 + presentEase * 0.08;
          diceGroup.scale.setScalar(scaleVal);

          shadowMesh.position.set(0, 0, -1.48);
          shadowMesh.scale.setScalar(0.92);
          shadowMat.opacity = 0.75;

          // Pulso luminoso sutil na face vencedora e no anel de impacto
          const pulse = 0.5 + 0.5 * Math.sin(postElapsed * 0.006);
          if (winningMaterial) {
            winningMaterial.emissiveIntensity = 0.18 + pulse * 0.16;
          }

          ringMat.opacity = Math.max(0, (0.55 - postElapsed * 0.00012) * (0.75 + pulse * 0.25));
          groundRing.scale.setScalar(1 + Math.min(0.35, postElapsed * 0.00018));

          // Fade out suave nos últimos 600ms
          if (elapsed > TOTAL_DURATION - 600) {
            setPhase('fading');
            const fade = Math.max(0, (TOTAL_DURATION - elapsed) / 600);
            if (renderer.domElement) {
              renderer.domElement.style.opacity = String(fade);
            }
          }
        }

        renderer.render(scene, camera);

        if (elapsed < TOTAL_DURATION) {
          animId = requestAnimationFrame(animate);
        } else {
          setDisplayedRoll(null);
          if (onDismissRef.current) onDismissRef.current();
        }
      }

      animId = requestAnimationFrame(animate);

      const handleResize = () => {
        if (!mount || !renderer || disposed) return;
        const w = Math.max(mount.clientWidth || 640, 320);
        const h = Math.max(mount.clientHeight || 480, 280);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(mount);
      } else {
        window.addEventListener('resize', handleResize);
      }

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    const cleanupPromise = init3DDice();

    return () => {
      disposed = true;
      if (!soundPlayed.fanfare && onSettledRef.current) {
        soundPlayed.fanfare = true;
        onSettledRef.current(rollSnapshot);
      }
      if (animId) cancelAnimationFrame(animId);
      if (resizeObserver) resizeObserver.disconnect();
      cleanupPromise.then((cleanup) => {
        if (typeof cleanup === 'function') cleanup();
      });
      disposableTextures.forEach((tex) => tex?.dispose?.());
      disposableMaterials.forEach((mat) => mat?.dispose?.());
      disposableGeometries.forEach((geo) => geo?.dispose?.());
      if (renderer) {
        if (renderer.domElement && mountNode?.contains(renderer.domElement)) {
          mountNode.removeChild(renderer.domElement);
        }
        renderer.dispose();
      }
    };
    // Dependência estritamente na chave estável da rolagem para nunca reiniciar durante re-renders do mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  const activeRoll = displayedRoll || currentRoll;
  if (!activeRoll) return null;

  return (
    <div
      className={`absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center transition-opacity duration-300 ${
        phase === 'fading' ? 'opacity-0' : 'opacity-100'
      } ${className}`}
    >
      {/* CANVAS WEBGL TRIDIMENSIONAL DO DADO */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* BANNER REATIVO (EXIBIDO APENAS QUANDO O DADO PARA DE ROLAR) */}
      {(phase === 'settled' || phase === 'fading') && (
        <div
          className={`pointer-events-auto absolute top-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all duration-300 animate-in fade-in zoom-in-95 transform ${
            phase === 'settled'
              ? 'scale-105 shadow-[0_0_35px_rgba(255,255,255,0.14)]'
              : 'scale-100'
          } ${
            activeRoll.is_max
              ? 'bg-amber-950/85 border-amber-400/60 text-amber-200'
              : activeRoll.is_fumble
              ? 'bg-rose-950/85 border-rose-400/60 text-rose-200'
              : 'bg-[#0c101b]/90 border-white/20 text-white'
          }`}
        >
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center font-black font-mono text-xl shadow-inner ${
              activeRoll.is_max
                ? 'bg-amber-500/25 border border-amber-400/60 text-amber-300'
                : activeRoll.is_fumble
                ? 'bg-rose-500/25 border border-rose-400/60 text-rose-300'
                : 'bg-white/10 border border-white/15 text-white'
            }`}
          >
            {activeRoll.roll}
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[160px] font-bold text-white">
                {activeRoll.user_name || 'Aventureiro'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                (d{activeRoll.sides})
              </span>
            </div>

            <div className="text-sm font-black tracking-wide">
              {activeRoll.is_max ? (
                <span className="text-amber-300 flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  SUCESSO MÁXIMO! ({activeRoll.roll})
                </span>
              ) : activeRoll.is_fumble ? (
                <span className="text-rose-400 font-bold">
                  FALHA CRÍTICA! (1)
                </span>
              ) : (
                <span className="text-slate-100">
                  Rolou {activeRoll.roll} no d{activeRoll.sides}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDisplayedRoll(null);
              if (onDismissRef.current) onDismissRef.current();
            }}
            className="ml-2 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONSTRUTOR GEOMÉTRICO DE POLIEDROS 3D COM MAPEAMENTO UV POR FACE
// ============================================================================

function buildPolyhedronDie(THREE, sides, rollValue, rollData, maxAnisotropy) {
  const textures = [];
  const materials = [];
  const geometries = [];

  // 1. Geometria base de acordo com o tipo de dado
  let rawGeo;
  if (sides === 4) {
    rawGeo = new THREE.TetrahedronGeometry(1.75, 0);
  } else if (sides === 6) {
    rawGeo = new THREE.BoxGeometry(1.56, 1.56, 1.56);
  } else if (sides === 8) {
    rawGeo = new THREE.OctahedronGeometry(1.66, 0);
  } else if (sides === 10) {
    rawGeo = createCoplanarD10Geometry(THREE, 1.56, 1.5);
  } else if (sides === 12) {
    rawGeo = new THREE.DodecahedronGeometry(1.58, 0);
  } else {
    rawGeo = new THREE.IcosahedronGeometry(1.64, 0);
  }
  geometries.push(rawGeo);

  const nonIndexed = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (nonIndexed !== rawGeo) {
    geometries.push(nonIndexed);
  }

  // 2. Extração e agrupamento de triângulos coplanares em faces poligonais
  const posAttr = nonIndexed.attributes.position;
  const triCount = posAttr.count / 3;
  const rawTriangles = [];

  for (let i = 0; i < triCount; i++) {
    const a = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 0);
    const b = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 1);
    const c = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 2);

    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    const cross = new THREE.Vector3().crossVectors(ab, ac);
    const area = Math.max(1e-6, cross.length() * 0.5);
    const normal = cross.clone().normalize();
    const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);

    // Garante orientação estritamente voltada para fora do poliedro convexo
    if (normal.dot(centroid) < 0) {
      normal.negate();
      rawTriangles.push({ a, b: c, c: b, normal, centroid, area });
    } else {
      rawTriangles.push({ a, b, c, normal, centroid, area });
    }
  }

  const faceGroups = [];
  const used = new Set();

  for (let i = 0; i < rawTriangles.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const group = [rawTriangles[i]];
    const refNormal = rawTriangles[i].normal;

    for (let j = i + 1; j < rawTriangles.length; j++) {
      if (used.has(j)) continue;
      if (refNormal.dot(rawTriangles[j].normal) > 0.992) {
        used.add(j);
        group.push(rawTriangles[j]);
      }
    }
    faceGroups.push(group);
  }

  // 3. Montagem da geometria final com UVs precisos por face e grupos de material
  const finalPositions = [];
  const finalNormals = [];
  const finalUVs = [];
  const faces = [];
  const faceMaterials = [];
  let winningMaterial = null;
  let vertexCursor = 0;

  faceGroups.forEach((group, idx) => {
    const faceNum = (idx % sides) + 1;
    const isWinningFace = faceNum === rollValue;

    // Normal média ponderada pela área e centroide ponderado pela área
    const normal = new THREE.Vector3();
    const areaCentroid = new THREE.Vector3();
    let totalArea = 0;

    group.forEach((tri) => {
      normal.addScaledVector(tri.normal, tri.area);
      areaCentroid.addScaledVector(tri.centroid, tri.area);
      totalArea += tri.area;
    });
    normal.normalize();
    areaCentroid.divideScalar(totalArea || 1);

    // Coleta de vértices únicos do perímetro do polígono da face
    const uniqueVerts = [];
    group.forEach((tri) => {
      [tri.a, tri.b, tri.c].forEach((v) => {
        if (!uniqueVerts.some((u) => u.distanceToSquared(v) < 1e-5)) {
          uniqueVerts.push(v.clone());
        }
      });
    });

    // Base temporária no plano da face para ordenar os vértices em sentido anti-horário
    const tempRef =
      Math.abs(normal.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    const tempU = new THREE.Vector3().crossVectors(tempRef, normal).normalize();
    const tempV = new THREE.Vector3().crossVectors(normal, tempU).normalize();

    uniqueVerts.sort((p1, p2) => {
      const a1 = Math.atan2(
        p1.clone().sub(areaCentroid).dot(tempV),
        p1.clone().sub(areaCentroid).dot(tempU)
      );
      const a2 = Math.atan2(
        p2.clone().sub(areaCentroid).dot(tempV),
        p2.clone().sub(areaCentroid).dot(tempU)
      );
      return a1 - a2;
    });

    // Determinação do incentro óptico e do vetor "para cima" (v) da face
    let center = areaCentroid.clone();
    let vAxis = new THREE.Vector3();

    if (sides === 10 && uniqueVerts.length === 4) {
      // No D10 (pipa), identifica o ápice polar (maior |y|) e a ponta equatorial oposta
      let apexIdx = 0;
      let maxAbsY = -1;
      uniqueVerts.forEach((v, k) => {
        if (Math.abs(v.y) > maxAbsY) {
          maxAbsY = Math.abs(v.y);
          apexIdx = k;
        }
      });
      const apex = uniqueVerts[apexIdx];
      const side1 = uniqueVerts[(apexIdx + 1) % 4];
      const tip = uniqueVerts[(apexIdx + 2) % 4];

      // Incentro exato da pipa pelo Teorema da Bissetriz Interna
      const lenUp = apex.distanceTo(side1);
      const lenLow = tip.distanceTo(side1);
      center = new THREE.Vector3()
        .addScaledVector(apex, lenLow)
        .addScaledVector(tip, lenUp)
        .divideScalar(lenUp + lenLow || 1);

      vAxis.subVectors(apex, center).normalize();
    } else if (sides === 6 && uniqueVerts.length === 4) {
      // No D6 (quadrado), alinha o eixo vertical paralelamente às bordas do quadrado
      const edgeMid = new THREE.Vector3()
        .addVectors(uniqueVerts[0], uniqueVerts[1])
        .multiplyScalar(0.5);
      vAxis.subVectors(edgeMid, center).normalize();
    } else {
      // Em triângulos (D4, D8, D20) e pentágonos (D12), aponta do centro para o vértice ápice
      let bestVert = uniqueVerts[0];
      let bestScore = -Infinity;
      uniqueVerts.forEach((v) => {
        if (v.y > bestScore) {
          bestScore = v.y;
          bestVert = v;
        }
      });
      vAxis.subVectors(bestVert, center).normalize();
    }

    // Ortogonalização de Gram-Schmidt para formar base destra (u = direita, v = cima, normal = frente)
    vAxis.sub(normal.clone().multiplyScalar(vAxis.dot(normal))).normalize();
    const uAxis = new THREE.Vector3().crossVectors(vAxis, normal).normalize();
    vAxis.crossVectors(normal, uAxis).normalize();

    // Projeção 2D dos vértices do perímetro da face
    let maxRadius = 0;
    const poly2D = uniqueVerts.map((v) => {
      const rel = v.clone().sub(center);
      const x = rel.dot(uAxis);
      const y = rel.dot(vAxis);
      const r = Math.hypot(x, y);
      if (r > maxRadius) maxRadius = r;
      return { x, y };
    });

    const uvSpan = Math.max(1e-4, maxRadius * 2.06);

    // Cálculo do raio do círculo inscrito (distância mínima até as arestas do polígono)
    let minEdgeDist = maxRadius;
    for (let i = 0; i < poly2D.length; i++) {
      const p1 = poly2D[i];
      const p2 = poly2D[(i + 1) % poly2D.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const dist = Math.abs(p1.x * p2.y - p1.y * p2.x) / len;
      if (dist < minEdgeDist) minEdgeDist = dist;
    }

    // Geração dos atributos de vértice e UV para todos os triângulos desta face
    const groupStart = vertexCursor;
    group.forEach((tri) => {
      [tri.a, tri.b, tri.c].forEach((vert) => {
        finalPositions.push(vert.x, vert.y, vert.z);
        finalNormals.push(normal.x, normal.y, normal.z);

        const rel = vert.clone().sub(center);
        const u = 0.5 + rel.dot(uAxis) / uvSpan;
        const v = 0.5 + rel.dot(vAxis) / uvSpan;
        finalUVs.push(u, v);
        vertexCursor += 1;
      });
    });

    const groupCount = vertexCursor - groupStart;

    // Criação da textura 512x512 da face com moldura poligonal e numeral gravado
    const faceTexture = createFacePolygonTexture(
      THREE,
      faceNum,
      sides,
      isWinningFace,
      rollData,
      poly2D,
      uvSpan,
      minEdgeDist,
      maxAnisotropy
    );
    if (faceTexture) textures.push(faceTexture);

    const emissiveHex = isWinningFace
      ? rollData.is_max
        ? 0xf59e0b
        : rollData.is_fumble
        ? 0xf43f5e
        : 0x38bdf8
      : 0x000000;

    const mat = new THREE.MeshStandardMaterial({
      map: faceTexture,
      roughness: 0.26,
      metalness: 0.62,
      flatShading: true,
      emissive: new THREE.Color(emissiveHex),
      emissiveIntensity: isWinningFace ? 0.14 : 0,
    });
    materials.push(mat);
    faceMaterials.push(mat);

    if (isWinningFace) {
      winningMaterial = mat;
    }

    faces.push({
      faceNum,
      normal,
      center,
      u: uAxis,
      v: vAxis,
      groupStart,
      groupCount,
      materialIndex: idx,
    });
  });

  const diceGeometry = new THREE.BufferGeometry();
  diceGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(finalPositions, 3)
  );
  diceGeometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(finalNormals, 3)
  );
  diceGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUVs, 2));

  faces.forEach((f) => {
    diceGeometry.addGroup(f.groupStart, f.groupCount, f.materialIndex);
  });
  geometries.push(diceGeometry);

  const diceMesh = new THREE.Mesh(diceGeometry, faceMaterials);
  const diceGroup = new THREE.Group();
  diceGroup.add(diceMesh);

  // Arestas metálicas externas (threshold de 12 graus ignora diagonais internas de faces coplanares)
  const edgesGeo = new THREE.EdgesGeometry(rawGeo, 12);
  const edgesColor = rollData.is_max
    ? 0xfbbf24
    : rollData.is_fumble
    ? 0xf43f5e
    : 0x94a3b8;
  const edgesMat = new THREE.LineBasicMaterial({
    color: edgesColor,
    transparent: true,
    opacity: 0.85,
  });
  geometries.push(edgesGeo);
  materials.push(edgesMat);

  const edgeSegments = new THREE.LineSegments(edgesGeo, edgesMat);
  edgeSegments.scale.setScalar(1.003);
  diceGroup.add(edgeSegments);

  return {
    diceGroup,
    faces,
    winningMaterial,
    textures,
    materials,
    geometries,
  };
}

/**
 * Trapezoedro Pentagonal estritamente coplanar para o D10
 * Usa a relação exata d = H * (1 - cos(36°)) / (1 + cos(36°)) para que os 4 vértices
 * de cada uma das 10 faces pipa pertençam exatamente ao mesmo plano.
 */
function createCoplanarD10Geometry(THREE, radius = 1.56, height = 1.5) {
  const geom = new THREE.BufferGeometry();
  const alpha = Math.PI / 5; // 36 graus
  const cosA = Math.cos(alpha);
  const d = height * ((1 - cosA) / (1 + cosA));

  const topApex = new THREE.Vector3(0, height, 0);
  const bottomApex = new THREE.Vector3(0, -height, 0);
  const ring = [];

  for (let i = 0; i < 10; i++) {
    const angle = i * alpha;
    // Vértices pares formam as pontas inferiores das pipas de cima (-d)
    // Vértices ímpares formam as pontas superiores das pipas de baixo (+d)
    const y = i % 2 === 0 ? -d : d;
    ring.push(
      new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    );
  }

  const positions = [];

  for (let i = 0; i < 10; i++) {
    const next = (i + 1) % 10;
    const prev = (i + 9) % 10;

    if (i % 2 === 0) {
      // Face pipa superior (Apex = topApex, laterais = prev/next em +d, ponta = ring[i] em -d)
      positions.push(
        topApex.x, topApex.y, topApex.z,
        ring[i].x, ring[i].y, ring[i].z,
        ring[prev].x, ring[prev].y, ring[prev].z
      );
      positions.push(
        topApex.x, topApex.y, topApex.z,
        ring[next].x, ring[next].y, ring[next].z,
        ring[i].x, ring[i].y, ring[i].z
      );
    } else {
      // Face pipa inferior (Apex = bottomApex, laterais = prev/next em -d, ponta = ring[i] em +d)
      positions.push(
        bottomApex.x, bottomApex.y, bottomApex.z,
        ring[prev].x, ring[prev].y, ring[prev].z,
        ring[i].x, ring[i].y, ring[i].z
      );
      positions.push(
        bottomApex.x, bottomApex.y, bottomApex.z,
        ring[i].x, ring[i].y, ring[i].z,
        ring[next].x, ring[next].y, ring[next].z
      );
    }
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Gera a textura 512x512 de alta definição mapeada diretamente sobre a face poligonal
 */
function createFacePolygonTexture(
  THREE,
  number,
  sides,
  isWinningFace,
  rollData,
  poly2D,
  uvSpan,
  minEdgeDist,
  maxAnisotropy
) {
  if (typeof document === 'undefined') return null;

  const size = 512;
  const centerPx = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const isMax = rollData?.is_max && isWinningFace;
  const isFumble = rollData?.is_fumble && isWinningFace;

  // 1. Fundo sólido facetado (Obsidian / Astralis Silver-Slate)
  const bgGrad = ctx.createRadialGradient(
    centerPx,
    centerPx,
    24,
    centerPx,
    centerPx,
    centerPx
  );

  if (isMax) {
    bgGrad.addColorStop(0, '#3b280c');
    bgGrad.addColorStop(0.65, '#1f1608');
    bgGrad.addColorStop(1, '#0f0b05');
  } else if (isFumble) {
    bgGrad.addColorStop(0, '#3d101c');
    bgGrad.addColorStop(0.65, '#210910');
    bgGrad.addColorStop(1, '#100408');
  } else if (isWinningFace) {
    bgGrad.addColorStop(0, '#1e2b45');
    bgGrad.addColorStop(0.65, '#111827');
    bgGrad.addColorStop(1, '#090d16');
  } else {
    bgGrad.addColorStop(0, '#172033');
    bgGrad.addColorStop(0.65, '#0e1422');
    bgGrad.addColorStop(1, '#080b13');
  }

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // 2. Moldura poligonal interna acompanhando o formato exato da face (triângulo, quadrado, pipa, pentágono)
  const drawScaledPolygon = (scaleFactor) => {
    if (!poly2D || poly2D.length < 3) return;
    ctx.beginPath();
    poly2D.forEach((pt, idx) => {
      const px = centerPx + ((pt.x * scaleFactor) / uvSpan) * size;
      const py = centerPx - ((pt.y * scaleFactor) / uvSpan) * size;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };

  // Chanfro externo da face
  drawScaledPolygon(0.86);
  ctx.lineWidth = 4;
  ctx.strokeStyle = isMax
    ? 'rgba(251, 191, 36, 0.55)'
    : isFumble
    ? 'rgba(244, 63, 94, 0.55)'
    : 'rgba(148, 163, 184, 0.28)';
  ctx.stroke();

  // Filete rúnico interno
  drawScaledPolygon(0.76);
  ctx.lineWidth = isWinningFace ? 3.5 : 2.2;
  ctx.strokeStyle = isMax
    ? 'rgba(254, 240, 138, 0.85)'
    : isFumble
    ? 'rgba(253, 164, 175, 0.85)'
    : isWinningFace
    ? 'rgba(56, 189, 248, 0.75)'
    : 'rgba(203, 213, 225, 0.35)';
  ctx.stroke();

  // 3. Dimensionamento óptico do numeral baseado no raio do círculo inscrito da face
  const inradiusPx = (minEdgeDist / uvSpan) * size;
  const textStr = String(number);
  const isTwoDigits = textStr.length > 1;
  const fontSize = Math.round(
    Math.max(54, Math.min(148, inradiusPx * (isTwoDigits ? 0.86 : 1.06)))
  );

  ctx.save();
  ctx.font = `900 ${fontSize}px "Cinzel", "Georgia", "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Ajuste fino vertical para triângulos (D4, D8, D20)
  const yOffset = sides === 4 || sides === 8 || sides === 20 ? fontSize * 0.06 : 0;
  const textY = centerPx + yOffset;

  // Contorno profundo de entalhe na pedra/metal
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(8, Math.round(fontSize * 0.11));
  ctx.strokeStyle = '#030712';
  ctx.strokeText(textStr, centerPx, textY);

  // Preenchimento metálico/luminoso do numeral
  const textGrad = ctx.createLinearGradient(
    centerPx,
    textY - fontSize * 0.5,
    centerPx,
    textY + fontSize * 0.5
  );
  if (isMax) {
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(0.45, '#fef08a');
    textGrad.addColorStop(1, '#f59e0b');
  } else if (isFumble) {
    textGrad.addColorStop(0, '#fff1f2');
    textGrad.addColorStop(0.45, '#fecdd3');
    textGrad.addColorStop(1, '#f43f5e');
  } else if (isWinningFace) {
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(0.5, '#f8fafc');
    textGrad.addColorStop(1, '#7dd3fc');
  } else {
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(0.55, '#e2e8f0');
    textGrad.addColorStop(1, '#94a3b8');
  }

  ctx.fillStyle = textGrad;
  ctx.fillText(textStr, centerPx, textY);

  // Traço inferior clássico para diferenciar 6 e 9 em dados de 10, 12 e 20 faces
  if ((number === 6 || number === 9) && sides >= 10) {
    const barW = fontSize * 0.34;
    const barH = Math.max(4, fontSize * 0.065);
    const barY = textY + fontSize * 0.44;

    ctx.fillStyle = '#030712';
    ctx.fillRect(centerPx - barW / 2 - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = textGrad;
    ctx.fillRect(centerPx - barW / 2, barY, barW, barH);
  }

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Textura radial suave para a sombra projetada do dado sobre o mapa
 */
function createSoftShadowTexture(THREE) {
  if (typeof document === 'undefined') return null;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 118);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
