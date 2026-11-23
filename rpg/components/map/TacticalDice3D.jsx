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
 * Suporta rolagem unitária (1d20, 1d6, etc.) e rolagem simultânea de múltiplos dados
 * (ex: 3d20, 4d4, 8d6 — até 20 dados simultâneos em cena):
 * - Compartilhamento eficiente de geometria e texturas neutras entre dados do mesmo arremesso
 * - Formação espacial sem colisões com enquadramento dinâmico de câmera (desktop, tablet e mobile)
 * - Alinhamento matricial ortonormal individual voltado exatamente para a câmera (100% legível e em pé)
 * - D10 construído como Trapezoedro Pentagonal estritamente coplanar
 * - Física parabólica escalonada com sombras de contato individuais, anéis de impacto e áudio procedural
 *
 * Zero ícones de estrela em estrita conformidade com as diretrizes do projeto.
 */
export function TacticalDice3D({
  currentRoll,
  onSettled,
  onDismiss,
  showBanner = false,
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
    ? `${currentRoll.seed || currentRoll.id}_${currentRoll.count || 1}d${currentRoll.sides}_${currentRoll.roll}`
    : null;

  useEffect(() => {
    if (!currentRoll || !rollKey) return;

    const mountNode = mountRef.current;
    const rollSnapshot = { ...currentRoll };
    setDisplayedRoll(rollSnapshot);
    setPhase('rolling');

    let fanfarePlayed = false;
    let settlePlayed = false;
    let lastBounceSoundMs = 0;

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

      const validSides = [4, 6, 8, 10, 12, 20].includes(Number(rollSnapshot.sides))
        ? Number(rollSnapshot.sides)
        : 20;

      const rawResults =
        Array.isArray(rollSnapshot.results) && rollSnapshot.results.length > 0
          ? rollSnapshot.results.slice(0, 20)
          : [Number(rollSnapshot.roll) || 1];

      const rollValues = rawResults.map((v) =>
        Math.max(1, Math.min(validSides, Math.floor(Number(v)) || 1))
      );
      const diceCount = rollValues.length;

      // Gerador determinístico baseado no seed
      const seed = Number(rollSnapshot.seed) || 0.5;
      const rand = (n) => {
        const x = Math.sin(seed * 9973 + n * 101.3) * 43758.5453;
        return x - Math.floor(x);
      };

      // 1. Formação espacial balanceada (zero sobreposição entre os dados)
      const { slots, dieScale, maxAbsX, maxAbsY } = computeDiceFormation(diceCount, rand);
      const dieBoundingRadius = 1.92 * dieScale;

      // 2. Cena e Câmera com auto-enquadramento dinâmico para qualquer quantidade de dados e viewport
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, width / height, 0.5, 140);
      const camDir = new THREE.Vector3(0, -2.5, 11.4).normalize();

      const updateCameraFraming = (w, h) => {
        const aspect = Math.max(0.45, w / Math.max(1, h));
        const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const tanHalfH = tanHalfV * aspect;

        let camDist = 11.68;
        if (diceCount === 1) {
          const minHorizDist = 2.45 / tanHalfH;
          camDist = Math.max(11.68, minHorizDist);
        } else {
          const padV = 1.44;
          const padH = 1.36;
          const distV = ((maxAbsY + dieBoundingRadius) * padV) / tanHalfV;
          const distH = ((maxAbsX + dieBoundingRadius) * padH) / tanHalfH;
          camDist = Math.max(12.2, distV, distH);
        }

        camera.aspect = aspect;
        camera.position.copy(camDir).multiplyScalar(camDist);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      };

      updateCameraFraming(width, height);

      // 3. Renderizador WebGL com antialiasing e tone mapping cinematográfico
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

      // 4. Iluminação de estúdio tridimensional
      const ambientLight = new THREE.AmbientLight(0x1e293b, 2.25);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 3.25);
      keyLight.position.set(5.5, 7.5, 12.0);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.65);
      fillLight.position.set(-7.0, -3.5, 6.5);
      scene.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0x94a3b8, 1.7);
      rimLight.position.set(0, 6.0, -5.0);
      scene.add(rimLight);

      const topPointLight = new THREE.PointLight(0xffffff, 1.15, 32);
      topPointLight.position.set(0, -1.0, 9.0);
      scene.add(topPointLight);

      // 5. Blueprint compartilhado do poliedro (geometria + texturas neutras construídas 1 única vez)
      const maxAnisotropy = renderer.capabilities?.getMaxAnisotropy
        ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
        : 1;
      const textureSize = diceCount <= 3 ? 512 : 256;

      const blueprint = buildPolyhedronBlueprint(THREE, validSides, textureSize, maxAnisotropy);
      disposableGeometries.push(...blueprint.geometries);
      disposableTextures.push(...blueprint.textures);

      // Recursos compartilhados de sombra e anel de impacto
      const shadowTexture = createSoftShadowTexture(THREE);
      if (shadowTexture) disposableTextures.push(shadowTexture);

      const shadowGeo = new THREE.PlaneGeometry(4.4 * dieScale, 4.4 * dieScale);
      const ringGeo = new THREE.RingGeometry(1.52 * dieScale, 1.8 * dieScale, 48);
      disposableGeometries.push(shadowGeo, ringGeo);

      const settledTextureCache = new Map();
      const worldUp = new THREE.Vector3(0, 1, 0);
      const floorZ = -1.48 * dieScale;
      const ringZ = -1.42 * dieScale;

      // 6. Instanciação de cada dado com trajetória, rotação e destaque próprios
      const diceActors = rollValues.map((dieValue, idx) => {
        const slot = slots[idx];
        const dieIsMax = dieValue === validSides;
        const dieIsFumble = validSides === 20 && dieValue === 1;
        const dieRollMeta = { is_max: dieIsMax, is_fumble: dieIsFumble };

        const targetFace = blueprint.faces.find((f) => f.faceNum === dieValue) || blueprint.faces[0];

        // Textura vencedora deduplicada por (valor + estado)
        const settledKey = `${dieValue}_${dieIsMax ? 'max' : dieIsFumble ? 'fumble' : 'normal'}`;
        let settledWinningTexture = settledTextureCache.get(settledKey) || null;
        if (!settledWinningTexture && targetFace) {
          settledWinningTexture = createFacePolygonTexture(
            THREE,
            dieValue,
            validSides,
            true,
            dieRollMeta,
            targetFace.poly2D,
            targetFace.uvSpan,
            targetFace.minEdgeDist,
            maxAnisotropy,
            textureSize
          );
          if (settledWinningTexture) {
            settledTextureCache.set(settledKey, settledWinningTexture);
            disposableTextures.push(settledWinningTexture);
          }
        }

        let winningMaterial = null;
        const faceMaterials = blueprint.faces.map((face, fIdx) => {
          const mat = new THREE.MeshStandardMaterial({
            map: blueprint.neutralTextures[fIdx] || null,
            roughness: 0.26,
            metalness: 0.62,
            flatShading: true,
            emissive: new THREE.Color(0x000000),
            emissiveIntensity: 0,
          });
          disposableMaterials.push(mat);
          if (face.faceNum === dieValue && !winningMaterial) {
            winningMaterial = mat;
          }
          return mat;
        });

        const diceMesh = new THREE.Mesh(blueprint.diceGeometry, faceMaterials);
        const diceGroup = new THREE.Group();
        diceGroup.add(diceMesh);

        const edgesMat = new THREE.LineBasicMaterial({
          color: 0x94a3b8,
          transparent: true,
          opacity: 0.85,
        });
        disposableMaterials.push(edgesMat);

        const edgeSegments = new THREE.LineSegments(blueprint.edgesGeo, edgesMat);
        edgeSegments.scale.setScalar(1.003);
        diceGroup.add(edgeSegments);

        diceGroup.scale.setScalar(dieScale);
        scene.add(diceGroup);

        // Sombra individual na mesa
        const shadowMat = new THREE.MeshBasicMaterial({
          map: shadowTexture,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        disposableMaterials.push(shadowMat);
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.position.set(slot.x, slot.y, floorZ);
        scene.add(shadowMesh);

        // Anel arcano individual ao pousar
        const ringMat = new THREE.MeshBasicMaterial({
          color: dieIsMax ? 0xfbbf24 : dieIsFumble ? 0xf43f5e : 0x38bdf8,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        disposableMaterials.push(ringMat);
        const groundRing = new THREE.Mesh(ringGeo, ringMat);
        groundRing.position.set(slot.x, slot.y, ringZ);
        scene.add(groundRing);

        // Orientação final matricial exata voltada para a câmera a partir da posição do dado
        const targetPosVec = new THREE.Vector3(slot.x, slot.y, 0);
        const zCam = camera.position.clone().sub(targetPosVec).normalize();
        const yCam = worldUp
          .clone()
          .sub(zCam.clone().multiplyScalar(worldUp.dot(zCam)))
          .normalize();
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

        // Parâmetros de arremesso únicos por dado
        const rBase = idx * 17 + 1;
        const throwAngle =
          diceCount === 1
            ? rand(rBase) * Math.PI * 2
            : Math.atan2(slot.y || (rand(rBase) - 0.5), slot.x || (rand(rBase + 1) - 0.5)) +
              (rand(rBase + 2) - 0.5) * 0.9;
        const throwDist = (2.8 + rand(rBase + 3) * 1.1) * Math.max(0.85, dieScale);
        const startX = slot.x + Math.cos(throwAngle) * throwDist;
        const startY = slot.y + Math.sin(throwAngle) * (throwDist * 0.78);
        const startHeight = (2.5 + rand(rBase + 4) * 0.55) * Math.max(0.85, dieScale);

        const signX = rand(rBase + 5) > 0.5 ? 1 : -1;
        const signY = rand(rBase + 6) > 0.5 ? 1 : -1;
        const signZ = rand(rBase + 7) > 0.5 ? 1 : -1;
        const totalSpinX =
          signX * (2 + Math.floor(rand(rBase + 8) * 2)) * Math.PI * 2 +
          (rand(rBase + 9) - 0.5) * 1.8;
        const totalSpinY =
          signY * (2 + Math.floor(rand(rBase + 10) * 2)) * Math.PI * 2 +
          (rand(rBase + 11) - 0.5) * 1.8;
        const totalSpinZ =
          signZ * (1 + Math.floor(rand(rBase + 12) * 2)) * Math.PI * 2 +
          (rand(rBase + 13) - 0.5) * 1.4;

        const maxStagger = diceCount === 1 ? 0 : Math.min(320, (diceCount - 1) * 45);
        const delay =
          diceCount === 1
            ? 0
            : Math.round((idx / Math.max(1, diceCount - 1)) * maxStagger);
        const duration =
          diceCount === 1
            ? 1620
            : Math.round(1460 + rand(rBase + 14) * 240);

        return {
          idx,
          dieValue,
          dieIsMax,
          dieIsFumble,
          targetX: slot.x,
          targetY: slot.y,
          startX,
          startY,
          startHeight,
          totalSpinX,
          totalSpinY,
          totalSpinZ,
          delay,
          duration,
          diceGroup,
          faceMaterials,
          winningMaterial,
          settledWinningTexture,
          edgesMat,
          shadowMesh,
          shadowMat,
          groundRing,
          ringMat,
          targetQuaternion,
          settled: false,
          bounces: { b1: false, b2: false, b3: false },
        };
      });

      const ALL_SETTLED_TIME = Math.max(
        ...diceActors.map((a) => a.delay + a.duration),
        1620
      );
      const TOTAL_DURATION = ALL_SETTLED_TIME + (diceCount > 1 ? 3900 : 3580);

      const tumbleEuler = new THREE.Euler(0, 0, 0, 'XYZ');
      const tumbleQuat = new THREE.Quaternion();
      const startTime = performance.now();

      const triggerThrottledBounce = (intensity, nowMs) => {
        if (nowMs - lastBounceSoundMs >= 52) {
          lastBounceSoundMs = nowMs;
          playDiceBounceSound(intensity);
        }
      };

      function animate(now) {
        if (disposed) return;
        const elapsed = now - startTime;

        for (let i = 0; i < diceActors.length; i += 1) {
          const actor = diceActors[i];
          const localElapsed = elapsed - actor.delay;

          if (localElapsed < 0) {
            actor.diceGroup.visible = false;
            actor.shadowMesh.visible = false;
            actor.groundRing.visible = false;
            continue;
          }

          actor.diceGroup.visible = true;
          actor.shadowMesh.visible = true;
          actor.groundRing.visible = true;

          if (localElapsed < actor.duration) {
            const t = Math.min(1, Math.max(0, localElapsed / actor.duration));
            const horizEase = 1 - Math.pow(1 - t, 2.35);
            const curX = THREE.MathUtils.lerp(actor.startX, actor.targetX, horizEase);
            const curY = THREE.MathUtils.lerp(actor.startY, actor.targetY, horizEase);

            let heightZ = 0;
            if (t < 0.42) {
              const p1 = t / 0.42;
              heightZ = actor.startHeight * (1 - p1 * p1);
              if (p1 > 0.93 && !actor.bounces.b1) {
                actor.bounces.b1 = true;
                triggerThrottledBounce(0.9, now);
              }
            } else if (t < 0.73) {
              const p2 = (t - 0.42) / 0.31;
              heightZ = 1.12 * dieScale * 4 * p2 * (1 - p2);
              if (p2 > 0.91 && !actor.bounces.b2) {
                actor.bounces.b2 = true;
                triggerThrottledBounce(0.52, now);
              }
            } else if (t < 0.91) {
              const p3 = (t - 0.73) / 0.18;
              heightZ = 0.34 * dieScale * 4 * p3 * (1 - p3);
              if (p3 > 0.89 && !actor.bounces.b3) {
                actor.bounces.b3 = true;
                triggerThrottledBounce(0.25, now);
              }
            } else {
              const p4 = (t - 0.91) / 0.09;
              heightZ = 0.06 * dieScale * 4 * p4 * (1 - p4);
            }

            actor.diceGroup.position.set(curX, curY, heightZ);
            actor.diceGroup.scale.setScalar(dieScale);

            actor.shadowMesh.position.set(
              curX + heightZ * 0.16,
              curY - heightZ * 0.16,
              floorZ
            );
            const shadowScale = 0.88 + (heightZ / Math.max(0.4, dieScale)) * 0.18;
            actor.shadowMesh.scale.setScalar(shadowScale);
            actor.shadowMat.opacity = Math.max(0.2, 0.72 - heightZ * 0.15);

            const rem = 1 - t;
            const angleX = actor.totalSpinX * Math.pow(rem, 2.65);
            const angleY = actor.totalSpinY * Math.pow(rem, 2.45);
            const angleZ = actor.totalSpinZ * Math.pow(rem, 2.25);

            tumbleEuler.set(angleX, angleY, angleZ, 'XYZ');
            tumbleQuat.setFromEuler(tumbleEuler);
            actor.diceGroup.quaternion.multiplyQuaternions(tumbleQuat, actor.targetQuaternion);
          } else {
            // Dado individual assentado na face vencedora
            actor.diceGroup.position.set(actor.targetX, actor.targetY, 0);
            actor.diceGroup.quaternion.copy(actor.targetQuaternion);

            if (!actor.settled) {
              actor.settled = true;

              if (actor.winningMaterial && actor.settledWinningTexture) {
                actor.winningMaterial.map = actor.settledWinningTexture;
                actor.winningMaterial.needsUpdate = true;
              }

              if (actor.dieIsMax) {
                actor.edgesMat.color.setHex(0xfbbf24);
                actor.edgesMat.opacity = 1.0;
                actor.faceMaterials.forEach((mat) => {
                  mat.emissive.setHex(0xf59e0b);
                  mat.emissiveIntensity = mat === actor.winningMaterial ? 0.34 : 0.14;
                });
              } else if (actor.dieIsFumble) {
                actor.edgesMat.color.setHex(0xf43f5e);
                actor.edgesMat.opacity = 1.0;
                actor.faceMaterials.forEach((mat) => {
                  mat.emissive.setHex(0xf43f5e);
                  mat.emissiveIntensity = mat === actor.winningMaterial ? 0.36 : 0.16;
                });
              } else if (actor.winningMaterial) {
                actor.winningMaterial.emissive.setHex(0x38bdf8);
                actor.winningMaterial.emissiveIntensity = 0.18;
              }
            }

            const postElapsed = localElapsed - actor.duration;
            const presentProgress = Math.min(1, postElapsed / 320);
            const presentEase = 1 - Math.pow(1 - presentProgress, 3);
            actor.diceGroup.scale.setScalar(dieScale * (1.0 + presentEase * 0.08));

            actor.shadowMesh.position.set(actor.targetX, actor.targetY, floorZ);
            actor.shadowMesh.scale.setScalar(0.92);
            actor.shadowMat.opacity = 0.75;

            const pulse = 0.5 + 0.5 * Math.sin(postElapsed * 0.006);
            if (actor.winningMaterial) {
              const baseEmissive = actor.dieIsMax || actor.dieIsFumble ? 0.24 : 0.14;
              actor.winningMaterial.emissiveIntensity = baseEmissive + pulse * 0.18;
            }

            actor.ringMat.opacity = Math.max(
              0,
              (0.55 - postElapsed * 0.00012) * (0.75 + pulse * 0.25)
            );
            actor.groundRing.scale.setScalar(1 + Math.min(0.35, postElapsed * 0.00018));
          }
        }

        // Quando TODOS os dados terminarem de rolar, dispara consolidação + fanfarra + transmissão
        if (elapsed >= ALL_SETTLED_TIME) {
          if (!settlePlayed) {
            settlePlayed = true;
            playDiceSettleSound();
          }

          if (!fanfarePlayed) {
            fanfarePlayed = true;
            setPhase('settled');

            if (rollSnapshot.is_max) {
              rimLight.color.setHex(0xf59e0b);
              rimLight.intensity = 3.0;
              playCriticalSuccessSound();
            } else if (rollSnapshot.is_fumble) {
              rimLight.color.setHex(0xf43f5e);
              rimLight.intensity = 3.0;
              playCriticalFumbleSound();
            }

            if (onSettledRef.current) {
              onSettledRef.current(rollSnapshot);
            }
          }

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
        updateCameraFraming(w, h);
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
      if (!fanfarePlayed && onSettledRef.current) {
        fanfarePlayed = true;
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

  const activeCount = Number(activeRoll.count) || (Array.isArray(activeRoll.results) ? activeRoll.results.length : 1);
  const activeFormula = activeRoll.formula || (activeCount > 1 ? `${activeCount}d${activeRoll.sides}` : `d${activeRoll.sides}`);
  const activeResults = Array.isArray(activeRoll.results) && activeRoll.results.length > 0 ? activeRoll.results : [activeRoll.roll];

  return (
    <div
      className={`absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center transition-opacity duration-300 ${
        phase === 'fading' ? 'opacity-0' : 'opacity-100'
      } ${className}`}
    >
      {/* CANVAS WEBGL TRIDIMENSIONAL DOS DADOS */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* BANNER REATIVO INTERNO (SE ATIVADO) */}
      {showBanner && (phase === 'settled' || phase === 'fading') && (
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
            className={`min-w-[2.75rem] h-11 px-2 rounded-xl flex items-center justify-center font-black font-mono text-xl shadow-inner ${
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
                ({activeFormula})
              </span>
            </div>

            <div className="text-sm font-black tracking-wide">
              {activeRoll.is_max ? (
                <span className="text-amber-300 flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  {activeCount > 1 && !activeRoll.all_max
                    ? `CRÍTICO NO ${activeFormula}! (${activeRoll.roll})`
                    : `SUCESSO MÁXIMO! (${activeRoll.roll})`}
                </span>
              ) : activeRoll.is_fumble ? (
                <span className="text-rose-400 font-bold">
                  FALHA CRÍTICA! ({activeRoll.roll})
                </span>
              ) : (
                <span className="text-slate-100">
                  Rolou {activeRoll.roll} em {activeFormula}
                </span>
              )}
            </div>

            {activeResults.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {activeResults.map((val, i) => (
                  <span
                    key={i}
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${
                      val === activeRoll.sides
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : activeRoll.sides === 20 && val === 1
                        ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                        : 'bg-white/10 border-white/15 text-slate-200'
                    }`}
                  >
                    {val}
                  </span>
                ))}
              </div>
            )}
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
// LAYOUT ESPACIAL SEM COLISÃO PARA 1 A 20 DADOS SIMULTÂNEOS
// ============================================================================

function computeDiceFormation(count, rand) {
  if (count <= 1) {
    return {
      slots: [{ x: 0, y: 0 }],
      dieScale: 1.0,
      maxAbsX: 0,
      maxAbsY: 0,
    };
  }

  let cols = 2;
  let dieScale = 0.88;
  let stepX = 3.6;
  let stepY = 3.4;

  if (count === 2) {
    cols = 2;
    dieScale = 0.92;
    stepX = 3.75;
    stepY = 3.4;
  } else if (count === 3) {
    cols = 3;
    dieScale = 0.84;
    stepX = 3.4;
    stepY = 3.2;
  } else if (count === 4) {
    cols = 2;
    dieScale = 0.8;
    stepX = 3.4;
    stepY = 3.25;
  } else if (count <= 6) {
    cols = 3;
    dieScale = 0.74;
    stepX = 3.15;
    stepY = 3.0;
  } else if (count <= 9) {
    cols = 3;
    dieScale = 0.66;
    stepX = 2.85;
    stepY = 2.72;
  } else if (count <= 12) {
    cols = 4;
    dieScale = 0.59;
    stepX = 2.6;
    stepY = 2.52;
  } else if (count <= 16) {
    cols = 4;
    dieScale = 0.53;
    stepX = 2.38;
    stepY = 2.32;
  } else {
    cols = 5;
    dieScale = 0.48;
    stepX = 2.18;
    stepY = 2.15;
  }

  const rows = Math.ceil(count / cols);
  const slots = [];
  let maxAbsX = 0;
  let maxAbsY = 0;

  for (let i = 0; i < count; i += 1) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const itemsInRow = r === rows - 1 ? count - r * cols : cols;

    const baseX = (c - (itemsInRow - 1) / 2) * stepX;
    const baseY = ((rows - 1) / 2 - r) * stepY;

    // Micro-variação orgânica mantendo distância segura entre peças
    const jitterX = (rand(i * 5 + 31) - 0.5) * (stepX * 0.1);
    const jitterY = (rand(i * 5 + 32) - 0.5) * (stepY * 0.1);

    const x = baseX + jitterX;
    const y = baseY + jitterY;
    slots.push({ x, y });

    if (Math.abs(x) > maxAbsX) maxAbsX = Math.abs(x);
    if (Math.abs(y) > maxAbsY) maxAbsY = Math.abs(y);
  }

  return { slots, dieScale, maxAbsX, maxAbsY };
}

// ============================================================================
// CONSTRUTOR GEOMÉTRICO COMPARTILHADO DE POLIEDROS 3D COM MAPEAMENTO UV POR FACE
// ============================================================================

function buildPolyhedronBlueprint(THREE, sides, textureSize, maxAnisotropy) {
  const textures = [];
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

  for (let i = 0; i < triCount; i += 1) {
    const a = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 0);
    const b = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 1);
    const c = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 2);

    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    const cross = new THREE.Vector3().crossVectors(ab, ac);
    const area = Math.max(1e-6, cross.length() * 0.5);
    const normal = cross.clone().normalize();
    const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);

    if (normal.dot(centroid) < 0) {
      normal.negate();
      rawTriangles.push({ a, b: c, c: b, normal, centroid, area });
    } else {
      rawTriangles.push({ a, b, c, normal, centroid, area });
    }
  }

  const faceGroups = [];
  const used = new Set();

  for (let i = 0; i < rawTriangles.length; i += 1) {
    if (used.has(i)) continue;
    used.add(i);
    const group = [rawTriangles[i]];
    const refNormal = rawTriangles[i].normal;

    for (let j = i + 1; j < rawTriangles.length; j += 1) {
      if (used.has(j)) continue;
      if (refNormal.dot(rawTriangles[j].normal) > 0.992) {
        used.add(j);
        group.push(rawTriangles[j]);
      }
    }
    faceGroups.push(group);
  }

  // 3. Montagem da geometria final com UVs precisos por face e texturas neutras compartilhadas
  const finalPositions = [];
  const finalNormals = [];
  const finalUVs = [];
  const faces = [];
  const neutralTextures = [];
  let vertexCursor = 0;

  faceGroups.forEach((group, idx) => {
    const faceNum = (idx % sides) + 1;

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

    const uniqueVerts = [];
    group.forEach((tri) => {
      [tri.a, tri.b, tri.c].forEach((v) => {
        if (!uniqueVerts.some((u) => u.distanceToSquared(v) < 1e-5)) {
          uniqueVerts.push(v.clone());
        }
      });
    });

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

    let center = areaCentroid.clone();
    let vAxis = new THREE.Vector3();

    if (sides === 10 && uniqueVerts.length === 4) {
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

      const lenUp = apex.distanceTo(side1);
      const lenLow = tip.distanceTo(side1);
      center = new THREE.Vector3()
        .addScaledVector(apex, lenLow)
        .addScaledVector(tip, lenUp)
        .divideScalar(lenUp + lenLow || 1);

      vAxis.subVectors(apex, center).normalize();
    } else if (sides === 6 && uniqueVerts.length === 4) {
      const edgeMid = new THREE.Vector3()
        .addVectors(uniqueVerts[0], uniqueVerts[1])
        .multiplyScalar(0.5);
      vAxis.subVectors(edgeMid, center).normalize();
    } else {
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

    vAxis.sub(normal.clone().multiplyScalar(vAxis.dot(normal))).normalize();
    const uAxis = new THREE.Vector3().crossVectors(vAxis, normal).normalize();
    vAxis.crossVectors(normal, uAxis).normalize();

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

    let minEdgeDist = maxRadius;
    for (let i = 0; i < poly2D.length; i += 1) {
      const p1 = poly2D[i];
      const p2 = poly2D[(i + 1) % poly2D.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const dist = Math.abs(p1.x * p2.y - p1.y * p2.x) / len;
      if (dist < minEdgeDist) minEdgeDist = dist;
    }

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

    const neutralTexture = createFacePolygonTexture(
      THREE,
      faceNum,
      sides,
      false,
      null,
      poly2D,
      uvSpan,
      minEdgeDist,
      maxAnisotropy,
      textureSize
    );
    if (neutralTexture) textures.push(neutralTexture);
    neutralTextures.push(neutralTexture);

    faces.push({
      faceNum,
      normal,
      center,
      u: uAxis,
      v: vAxis,
      poly2D,
      uvSpan,
      minEdgeDist,
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

  const edgesGeo = new THREE.EdgesGeometry(rawGeo, 12);
  geometries.push(edgesGeo);

  return {
    diceGeometry,
    edgesGeo,
    faces,
    neutralTextures,
    textures,
    geometries,
  };
}

/**
 * Trapezoedro Pentagonal estritamente coplanar para o D10
 */
function createCoplanarD10Geometry(THREE, radius = 1.56, height = 1.5) {
  const geom = new THREE.BufferGeometry();
  const alpha = Math.PI / 5;
  const cosA = Math.cos(alpha);
  const d = height * ((1 - cosA) / (1 + cosA));

  const topApex = new THREE.Vector3(0, height, 0);
  const bottomApex = new THREE.Vector3(0, -height, 0);
  const ring = [];

  for (let i = 0; i < 10; i += 1) {
    const angle = i * alpha;
    const y = i % 2 === 0 ? -d : d;
    ring.push(
      new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    );
  }

  const positions = [];

  for (let i = 0; i < 10; i += 1) {
    const next = (i + 1) % 10;
    const prev = (i + 9) % 10;

    if (i % 2 === 0) {
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
 * Gera a textura de alta definição mapeada diretamente sobre a face poligonal
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
  maxAnisotropy,
  size = 512
) {
  if (typeof document === 'undefined') return null;

  const scale = size / 512;
  const centerPx = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const isMax = Boolean(rollData?.is_max) && isWinningFace;
  const isFumble = Boolean(rollData?.is_fumble) && isWinningFace;

  const bgGrad = ctx.createRadialGradient(
    centerPx,
    centerPx,
    24 * scale,
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

  drawScaledPolygon(0.86);
  ctx.lineWidth = Math.max(2, 4 * scale);
  ctx.strokeStyle = isMax
    ? 'rgba(251, 191, 36, 0.55)'
    : isFumble
    ? 'rgba(244, 63, 94, 0.55)'
    : 'rgba(148, 163, 184, 0.28)';
  ctx.stroke();

  drawScaledPolygon(0.76);
  ctx.lineWidth = Math.max(1.5, (isWinningFace ? 3.5 : 2.2) * scale);
  ctx.strokeStyle = isMax
    ? 'rgba(254, 240, 138, 0.85)'
    : isFumble
    ? 'rgba(253, 164, 175, 0.85)'
    : isWinningFace
    ? 'rgba(56, 189, 248, 0.75)'
    : 'rgba(203, 213, 225, 0.35)';
  ctx.stroke();

  const inradiusPx = (minEdgeDist / uvSpan) * size;
  const textStr = String(number);
  const isTwoDigits = textStr.length > 1;
  const fontSize = Math.round(
    Math.max(28 * scale, Math.min(148 * scale, inradiusPx * (isTwoDigits ? 0.86 : 1.06)))
  );

  ctx.save();
  ctx.font = `900 ${fontSize}px "Cinzel", "Georgia", "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const yOffset = sides === 4 || sides === 8 || sides === 20 ? fontSize * 0.06 : 0;
  const textY = centerPx + yOffset;

  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, Math.round(fontSize * 0.11));
  ctx.strokeStyle = '#030712';
  ctx.strokeText(textStr, centerPx, textY);

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

  if ((number === 6 || number === 9) && sides >= 10) {
    const barW = fontSize * 0.34;
    const barH = Math.max(2.5, fontSize * 0.065);
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
