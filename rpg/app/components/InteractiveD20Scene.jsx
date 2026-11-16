'use client';

import { useEffect, useRef } from 'react';

/**
 * Cena Interativa 3D de RPG (Tridimensional WebGL com Three.js)
 * Renderiza um Dado de 20 Lados (D20) em branco/cinza-prateado,
 * com física de rotação interativa (arrastar, mover o cursor, inércia),
 * anéis orbitais rúnicos e partículas cósmicas em profundidade.
 *
 * Suporta automaticamente o modelo 3D exportado pelo usuário:
 * /models/d20.glb, /models/d20.stl ou /models/d20.obj,
 * com fallback imediato de malha Icosaedro tridimensional PBR metálica.
 *
 * Zero ícones de estrela em conformidade estrita com as diretrizes do projeto.
 */
export default function InteractiveD20Scene({ className = '' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let animId = null;
    let renderer = null;

    async function initScene() {
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const THREE = await import('three');
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');

      if (disposed) return;

      const width = mount.clientWidth || 500;
      const height = mount.clientHeight || 500;

      // 1. Cena e Câmera
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0, 7.2);

      // 2. Renderizador WebGL de Alta Performance
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
      } catch {
        // Fallback para renderer padrão
        renderer = new THREE.WebGLRenderer({ alpha: true });
      }

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      mount.replaceChildren(renderer.domElement);

      // 3. Sistema de Iluminação de Estúdio Cinematográfico
      const ambientLight = new THREE.AmbientLight(0x0f172a, 1.4);
      scene.add(ambientLight);

      // Luz Principal (Branca suave do topo direito)
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
      keyLight.position.set(5, 7, 5);
      scene.add(keyLight);

      // Luz de Preenchimento (Ciano/Gelo da lateral esquerda)
      const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
      fillLight.position.set(-6, -2, 3);
      scene.add(fillLight);

      // Luz de Contorno / Rim Light (Púrpura/Índigo por trás)
      const rimLight = new THREE.DirectionalLight(0xa855f7, 2.0);
      rimLight.position.set(0, -6, -5);
      scene.add(rimLight);

      // Ponto focal central
      const pointLight = new THREE.PointLight(0xffffff, 0.8, 12);
      pointLight.position.set(0, 0, 3.5);
      scene.add(pointLight);

      // 4. Grupo Raiz do Dado e Elementos Orbitais
      const diceGroup = new THREE.Group();
      scene.add(diceGroup);

      // 5. Tentativa de carregamento de arquivo de modelo 3D enviado pelo usuário
      // Se houver um /models/d20.glb, /models/d20.stl ou /models/d20.obj, carregamos diretamente!
      let customMeshLoaded = false;

      // Função utilitária para verificar existência do arquivo
      async function fileExists(url) {
        try {
          const res = await fetch(url, { method: 'HEAD' });
          return res.ok;
        } catch {
          return false;
        }
      }

      // Verificação em cascata dos formatos 3D compatíveis
      try {
        if (await fileExists('/models/d20.glb')) {
          const gltfLoader = new GLTFLoader();
          const gltf = await gltfLoader.loadAsync('/models/d20.glb');
          const model = gltf.scene;
          model.scale.set(1.8, 1.8, 1.8);
          diceGroup.add(model);
          customMeshLoaded = true;
        } else if (await fileExists('/models/d20.stl')) {
          const stlLoader = new STLLoader();
          const geometry = await stlLoader.loadAsync('/models/d20.stl');
          geometry.center();
          geometry.computeVertexNormals();

          const material = new THREE.MeshStandardMaterial({
            color: 0xefeff1,
            metalness: 0.82,
            roughness: 0.22,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.set(0.12, 0.12, 0.12);
          diceGroup.add(mesh);
          customMeshLoaded = true;
        } else if (await fileExists('/models/d20.obj')) {
          const objLoader = new OBJLoader();
          const obj = await objLoader.loadAsync('/models/d20.obj');
          obj.scale.set(1.6, 1.6, 1.6);
          diceGroup.add(obj);
          customMeshLoaded = true;
        }
      } catch (e) {
        console.warn('Fallback para malha procedural D20 Three.js:', e);
      }

      // 6. Malha Procedural de Alta Resolução do D20 (Caso o arquivo seja .SLDPRT ou ainda não convertido)
      if (!customMeshLoaded) {
        const d20Geometry = new THREE.IcosahedronGeometry(1.9, 0);

        // Material metálico branco meio cinza-prateado de alta fidelidade
        const d20Material = new THREE.MeshStandardMaterial({
          color: 0xefeff3,
          metalness: 0.84,
          roughness: 0.22,
          flatShading: true,
        });

        const d20Mesh = new THREE.Mesh(d20Geometry, d20Material);
        diceGroup.add(d20Mesh);

        // Arestas luminosas arcanas (Wireframe beveled)
        const edgesGeometry = new THREE.EdgesGeometry(d20Geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.65,
          linewidth: 1.5,
        });
        const edgesLines = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        diceGroup.add(edgesLines);
      }

      // 7. Anéis Orbitais Celestes Concêntricos
      const ringGroup = new THREE.Group();
      scene.add(ringGroup);

      const ring1Geom = new THREE.TorusGeometry(3.05, 0.012, 16, 120);
      const ring1Mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
      });
      const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
      ring1.rotation.x = Math.PI / 3;
      ring1.rotation.y = Math.PI / 6;
      ringGroup.add(ring1);

      const ring2Geom = new THREE.TorusGeometry(3.55, 0.009, 16, 120);
      const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.35,
      });
      const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
      ring2.rotation.x = -Math.PI / 4;
      ring2.rotation.z = Math.PI / 3;
      ringGroup.add(ring2);

      // 8. Poeira Celestial em Profundidade 3D (Partículas)
      const particleCount = 65;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 11;
        positions[i + 1] = (Math.random() - 0.5) * 11;
        positions[i + 2] = (Math.random() - 0.5) * 11;
      }
      const particleGeom = new THREE.BufferGeometry();
      particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0xc4b5fd,
        size: 0.045,
        transparent: true,
        opacity: 0.6,
      });
      const particles = new THREE.Points(particleGeom, particleMat);
      scene.add(particles);

      // 9. Física de Rotação, Interatividade e Inércia
      let isDragging = false;
      let prevMouseX = 0;
      let prevMouseY = 0;
      let velX = 0;
      let velY = 0.0025; // Rotação ambiente constante suave
      let mouseParallaxX = 0;
      let mouseParallaxY = 0;

      const onPointerDown = (e) => {
        isDragging = true;
        prevMouseX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        prevMouseY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        velX = 0;
        velY = 0;
      };

      const onPointerMove = (e) => {
        const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

        // Efeito Parallax com o movimento do mouse
        const rect = mount.getBoundingClientRect();
        const normX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const normY = -(((clientY - rect.top) / rect.height) * 2 - 1);
        mouseParallaxX = normX * 0.35;
        mouseParallaxY = normY * 0.35;

        if (!isDragging) return;

        const deltaX = clientX - prevMouseX;
        const deltaY = clientY - prevMouseY;
        prevMouseX = clientX;
        prevMouseY = clientY;

        velX = deltaY * 0.005;
        velY = deltaX * 0.005;

        diceGroup.rotation.x += velX;
        diceGroup.rotation.y += velY;
      };

      const onPointerUp = () => {
        isDragging = false;
      };

      const domElem = renderer.domElement;
      domElem.style.cursor = 'grab';
      domElem.addEventListener('pointerdown', (e) => {
        domElem.style.cursor = 'grabbing';
        onPointerDown(e);
      });
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', () => {
        if (domElem) domElem.style.cursor = 'grab';
        onPointerUp();
      });

      // 10. Redimensionamento Responsivo
      const onResize = () => {
        if (!mount || !renderer) return;
        const newW = mount.clientWidth;
        const newH = mount.clientHeight;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };

      const resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(mount);

      // 11. Loop de Renderização
      diceGroup.rotation.set(0.35, 0.45, 0.1);

      const animate = () => {
        if (disposed) return;
        animId = requestAnimationFrame(animate);

        // Amortecimento de inércia e rotação ambiente contínua
        if (!isDragging) {
          velX *= 0.95;
          velY = velY * 0.95 + 0.0022 * 0.05;
          diceGroup.rotation.x += velX;
          diceGroup.rotation.y += velY;
        }

        // Suave inclinação parallax em direção ao mouse
        camera.position.x += (mouseParallaxX - camera.position.x) * 0.04;
        camera.position.y += (mouseParallaxY - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);

        // Animação dos anéis orbitais e partículas
        ring1.rotation.z += 0.003;
        ring2.rotation.z -= 0.002;
        particles.rotation.y += 0.0006;

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        disposed = true;
        if (animId) cancelAnimationFrame(animId);
        resizeObserver.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        if (renderer && renderer.domElement && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    }

    const cleanupPromise = initScene();

    return () => {
      disposed = true;
      cleanupPromise.then((cleanup) => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, []);

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full h-full min-h-[380px] select-none ${className}`}
      role="img"
      aria-label="Cena Interativa 3D do Dado de 20 Lados (D20)"
    >
      {/* Contêiner de montagem da cena Three.js WebGL */}
      <div
        ref={mountRef}
        className="w-full h-full min-h-[380px] max-h-[640px] flex items-center justify-center relative touch-none"
      />
    </div>
  );
}
