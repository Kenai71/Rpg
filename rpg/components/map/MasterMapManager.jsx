/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Image as ImageIcon,
  Link2,
  Plus,
  Skull,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  broadcastMapPing,
  broadcastMapDiceRoll,
  createMap,
  createMapToken,
  deleteMapWithTokens,
  deleteMapToken,
  setActiveMapTx,
  syncHeroTokensToMap,
  updateMap,
  updateMapTokenPosition,
  updateMapTokenStats,
} from '../../lib/rpg-service';
import { MAP_PRESETS } from '../../lib/map-presets';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormField, Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import {
  MonsterBestiaryModal,
  MonsterStatDetailModal,
  loadMonstersCatalog,
} from './MonsterBestiaryModal';
import { TacticalMapCanvas } from './TacticalMapCanvas';
import { cn } from '../../lib/utils';

export function MasterMapManager({
  maps = [],
  tokens = [],
  pings = [],
  diceRolls = [],
  players = [],
  currentUserId,
  currentUserName = 'Mestre',
}) {
  const [selectedMapId, setSelectedMapId] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [spawnMonsterModalOpen, setSpawnMonsterModalOpen] = useState(false);

  // Fonte do mapa no modal de criação ('upload' | 'preset' | 'url')
  const [mapSourceTab, setMapSourceTab] = useState('upload');
  const fileInputRef = useRef(null);
  const [uploadedPreview, setUploadedPreview] = useState(null);
  const [uploadedAsset, setUploadedAsset] = useState(null); // { imageUrl, hdDataUrl, fallbackImageUrl, width, height, qualityLabel }
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [compressingFile, setCompressingFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [selectedPreset, setSelectedPreset] = useState(MAP_PRESETS[0]);
  const [customUrl, setCustomUrl] = useState('');
  const [urlDimensions, setUrlDimensions] = useState(null); // { width, height }
  const [mapTitle, setMapTitle] = useState('');
  const [gridType, setGridType] = useState('square');
  const [creating, setCreating] = useState(false);
  const [syncingHeroes, setSyncingHeroes] = useState(false);

  // Detecta automaticamente as dimensões exatas em pixels quando o Mestre cola uma URL da Web
  useEffect(() => {
    if (mapSourceTab !== 'url') {
      setUrlDimensions(null);
      return;
    }
    const clean = customUrl.trim();
    if (!clean || (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('data:'))) {
      setUrlDimensions(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const probe = new Image();
      probe.onload = () => {
        if (!cancelled && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
          setUrlDimensions({ width: probe.naturalWidth, height: probe.naturalHeight });
        }
      };
      probe.onerror = () => {
        if (!cancelled) setUrlDimensions(null);
      };
      probe.src = clean;
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapSourceTab, customUrl]);

  // Inspeção rápida da ficha do Livro dos Monstros a partir de um token já no campo
  const [inspectedBookMonster, setInspectedBookMonster] = useState(null);

  // Mapa ativo atualmente entre todos os mapas (visível aos jogadores)
  const activeMap = useMemo(() => maps.find((m) => m.is_active) || null, [maps]);

  // Mapa atualmente inspecionado/visualizado pelo Mestre
  const currentMap = useMemo(() => {
    if (selectedMapId) {
      return maps.find((m) => m.id === selectedMapId) || activeMap || maps[0] || null;
    }
    return activeMap || maps[0] || null;
  }, [maps, selectedMapId, activeMap]);

  // Índice do mapa atual para navegação
  const currentMapIndex = useMemo(() => {
    if (!currentMap) return -1;
    return maps.findIndex((m) => m.id === currentMap.id);
  }, [maps, currentMap]);

  // Transitar entre mapas
  const handlePrevMap = () => {
    if (maps.length <= 1) return;
    const nextIdx = (currentMapIndex - 1 + maps.length) % maps.length;
    setSelectedMapId(maps[nextIdx].id);
  };

  const handleNextMap = () => {
    if (maps.length <= 1) return;
    const nextIdx = (currentMapIndex + 1) % maps.length;
    setSelectedMapId(maps[nextIdx].id);
  };

  // Tokens pertencentes a este mapa
  const currentTokens = useMemo(() => {
    if (!currentMap) return [];
    return tokens.filter((t) => t.map_id === currentMap.id);
  }, [tokens, currentMap]);

  // Processador de imagem em MÁXIMA QUALIDADE preservando dimensões exatas em pixels originais
  const processMapImageFile = (file) => {
    const SINGLE_DOC_BUDGET = 880000; // Seguro dentro do limite de 1 MiB do Firestore
    const HD_CHUNK_MAX_DATA_LEN = 10800000; // Até ~8 MB binários em chunks HD (ex: mapas 4K/8K)
    const PREVIEW_BUDGET = 175000; // Prévia leve instantânea para o carrossel enquanto o HD carrega

    const detectWebPSupport = () => {
      try {
        const test = document.createElement('canvas');
        test.width = 2;
        test.height = 2;
        return test.toDataURL('image/webp', 0.8).startsWith('data:image/webp');
      } catch {
        return false;
      }
    };

    const drawToDataUrl = (img, targetW, targetH, mime, quality) => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);
      return canvas.toDataURL(mime, quality);
    };

    const binarySearchQuality = (img, targetW, targetH, mime, minQ, maxQ, budget) => {
      // Testa primeiro qualidade máxima direto
      const maxAttempt = drawToDataUrl(img, targetW, targetH, mime, maxQ);
      if (maxAttempt.length <= budget) {
        return { dataUrl: maxAttempt, quality: maxQ };
      }
      // Testa qualidade mínima para saber se cabe nesta resolução
      const minAttempt = drawToDataUrl(img, targetW, targetH, mime, minQ);
      if (minAttempt.length > budget) {
        return null;
      }

      let lo = minQ;
      let hi = maxQ;
      let bestUrl = minAttempt;
      let bestQ = minQ;

      for (let step = 0; step < 6; step += 1) {
        const mid = Math.round(((lo + hi) / 2) * 1000) / 1000;
        const candidate = drawToDataUrl(img, targetW, targetH, mime, mid);
        if (candidate.length <= budget) {
          bestUrl = candidate;
          bestQ = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }

      return { dataUrl: bestUrl, quality: bestQ };
    };

    const buildBestSingleDocFallback = (img, origW, origH, bestMime) => {
      // Tenta primeiro manter exatamente 100% dos pixels originais
      const fullRes = binarySearchQuality(img, origW, origH, bestMime, 0.72, 0.98, SINGLE_DOC_BUDGET);
      if (fullRes) {
        return { dataUrl: fullRes.dataUrl, width: origW, height: origH, quality: fullRes.quality };
      }

      // Redução suave progressiva apenas se a imagem for gigantesca e precisar caber em 1 documento
      const scales = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.32];
      for (const scale of scales) {
        const w = Math.max(320, Math.round(origW * scale));
        const h = Math.max(320, Math.round(origH * scale));
        const attempt = binarySearchQuality(img, w, h, bestMime, 0.68, 0.92, SINGLE_DOC_BUDGET);
        if (attempt) {
          return { dataUrl: attempt.dataUrl, width: w, height: h, quality: attempt.quality };
        }
      }

      const safeW = Math.min(origW, 1600);
      const safeH = Math.round((origH * safeW) / origW);
      return {
        dataUrl: drawToDataUrl(img, safeW, safeH, bestMime, 0.65),
        width: safeW,
        height: safeH,
        quality: 0.65,
      };
    };

    const buildFastPreview = (img, origW, origH, bestMime) => {
      const maxPreviewDim = 1100;
      let pW = origW;
      let pH = origH;
      if (pW > maxPreviewDim || pH > maxPreviewDim) {
        const r = Math.min(maxPreviewDim / pW, maxPreviewDim / pH);
        pW = Math.max(200, Math.round(pW * r));
        pH = Math.max(200, Math.round(pH * r));
      }
      const attempt = binarySearchQuality(img, pW, pH, bestMime, 0.6, 0.84, PREVIEW_BUDGET);
      return attempt ? attempt.dataUrl : drawToDataUrl(img, pW, pH, bestMime, 0.6);
    };

    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Selecione um arquivo de imagem válido (PNG, JPG, WebP).'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const origW = img.naturalWidth || img.width || 1400;
          const origH = img.naturalHeight || img.height || 900;
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const bestMime = detectWebPSupport() ? 'image/webp' : 'image/jpeg';

          // CAMINHO 1: Arquivo original já cabe em 1 documento -> 100% ORIGINAL INTACTO (zero recompressão)
          if (typeof rawDataUrl === 'string' && rawDataUrl.length <= SINGLE_DOC_BUDGET) {
            resolve({
              previewUrl: rawDataUrl,
              imageUrl: rawDataUrl,
              hdDataUrl: null,
              fallbackImageUrl: rawDataUrl,
              width: origW,
              height: origH,
              qualityLabel: 'Original sem perdas',
              name: baseName,
            });
            return;
          }

          // Limite seguro de canvas do navegador (8192px) mantendo proporção exata caso exceda
          const MAX_CANVAS_DIM = 8192;
          let canvasW = origW;
          let canvasH = origH;
          if (canvasW > MAX_CANVAS_DIM || canvasH > MAX_CANVAS_DIM) {
            const ratio = Math.min(MAX_CANVAS_DIM / canvasW, MAX_CANVAS_DIM / canvasH);
            canvasW = Math.round(canvasW * ratio);
            canvasH = Math.round(canvasH * ratio);
          }

          // CAMINHO 2: Tenta WebP de altíssima qualidade (84% a 98%) mantendo 100% dos pixels exatos em 1 documento
          const exactSingleDoc = binarySearchQuality(
            img,
            canvasW,
            canvasH,
            bestMime,
            0.84,
            0.98,
            SINGLE_DOC_BUDGET
          );
          if (exactSingleDoc) {
            resolve({
              previewUrl: exactSingleDoc.dataUrl,
              imageUrl: exactSingleDoc.dataUrl,
              hdDataUrl: null,
              fallbackImageUrl: exactSingleDoc.dataUrl,
              width: origW,
              height: origH,
              qualityLabel: `Máxima (${Math.round(exactSingleDoc.quality * 100)}% HD)`,
              name: baseName,
            });
            return;
          }

          // CAMINHO 3: Mapa ultra-detalhado / 4K+ -> preserva 100% dos pixels originais em chunks HD
          let hdDataUrl = null;
          let qualityLabel = 'Original Ultra HD';

          if (typeof rawDataUrl === 'string' && rawDataUrl.length <= HD_CHUNK_MAX_DATA_LEN) {
            hdDataUrl = rawDataUrl;
            qualityLabel = 'Original Ultra HD';
          } else {
            const hdEncoded = binarySearchQuality(
              img,
              canvasW,
              canvasH,
              bestMime,
              0.86,
              0.96,
              HD_CHUNK_MAX_DATA_LEN
            );
            if (hdEncoded) {
              hdDataUrl = hdEncoded.dataUrl;
              qualityLabel = `Ultra HD (${Math.round(hdEncoded.quality * 100)}%)`;
            } else {
              hdDataUrl = drawToDataUrl(img, canvasW, canvasH, bestMime, 0.84);
              qualityLabel = 'Ultra HD Otimizado';
            }
          }

          const previewUrl = buildFastPreview(img, origW, origH, bestMime);
          const fallback = buildBestSingleDocFallback(img, canvasW, canvasH, bestMime);

          resolve({
            previewUrl,
            imageUrl: previewUrl,
            hdDataUrl,
            fallbackImageUrl: fallback.dataUrl,
            width: origW,
            height: origH,
            qualityLabel,
            name: baseName,
          });
        };
        img.onerror = () => reject(new Error('Falha ao processar arquivo de imagem.'));
        img.src = rawDataUrl;
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
      reader.readAsDataURL(file);
    });
  };

  const processSelectedFile = async (file) => {
    if (!file) return;
    setCompressingFile(true);
    try {
      const result = await processMapImageFile(file);
      setUploadedPreview(result.previewUrl);
      setUploadedAsset(result);
      setUploadedFileName(file.name);
      if (!mapTitle.trim()) {
        setMapTitle(result.name);
      }
      toast.success(
        `Mapa "${file.name}" carregado em ${result.width}×${result.height} px (${result.qualityLabel})!`
      );
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar arquivo de imagem.');
    } finally {
      setCompressingFile(false);
    }
  };

  // Upload de arquivo pelo Mestre (clique ou arrastar e soltar)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    await processSelectedFile(file);
  };

  const handleClearUploadedFile = () => {
    setUploadedPreview(null);
    setUploadedAsset(null);
    setUploadedFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Criar / Inserir Mapa (dimensões exatas automáticas, máxima qualidade, sem input manual de px)
  const handleCreateMap = async (e) => {
    e.preventDefault();
    let finalUrl = '';
    let hdDataUrl = null;
    let fallbackImageUrl = null;
    let naturalWidth = null;
    let naturalHeight = null;

    if (mapSourceTab === 'upload' && uploadedAsset) {
      finalUrl = uploadedAsset.imageUrl;
      hdDataUrl = uploadedAsset.hdDataUrl;
      fallbackImageUrl = uploadedAsset.fallbackImageUrl;
      naturalWidth = uploadedAsset.width;
      naturalHeight = uploadedAsset.height;
    } else if (mapSourceTab === 'url' && customUrl.trim()) {
      finalUrl = customUrl.trim();
      naturalWidth = urlDimensions?.width || null;
      naturalHeight = urlDimensions?.height || null;
    } else if (mapSourceTab === 'preset' && selectedPreset?.imageUrl) {
      finalUrl = selectedPreset.imageUrl;
      naturalWidth = 1200;
      naturalHeight = 800;
    } else if (uploadedAsset) {
      finalUrl = uploadedAsset.imageUrl;
      hdDataUrl = uploadedAsset.hdDataUrl;
      fallbackImageUrl = uploadedAsset.fallbackImageUrl;
      naturalWidth = uploadedAsset.width;
      naturalHeight = uploadedAsset.height;
    } else {
      finalUrl = customUrl.trim() || selectedPreset?.imageUrl;
    }

    const finalTitle =
      mapTitle.trim() ||
      (mapSourceTab === 'upload' ? uploadedFileName.replace(/\.[^/.]+$/, '') : null) ||
      selectedPreset?.title ||
      'Novo Mapa Tático';

    if (!finalUrl) {
      toast.error('Selecione uma imagem ou envie um arquivo para o mapa.');
      return;
    }

    setCreating(true);
    try {
      const newId = await createMap({
        title: finalTitle,
        imageUrl: finalUrl,
        hdDataUrl,
        fallbackImageUrl,
        naturalWidth,
        naturalHeight,
        gridType,
        autoGrid: true,
        gridOpacity: 0.25,
        scale: 1.0,
        is_active: maps.length === 0, // Se for o primeiro, ativa automaticamente
        is_locked: false,
      });

      setSelectedMapId(newId);
      setCreateModalOpen(false);
      setCustomUrl('');
      setUrlDimensions(null);
      setMapTitle('');
      setUploadedPreview(null);
      setUploadedAsset(null);
      setUploadedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Mapa tático adicionado na qualidade máxima!');
    } catch (err) {
      toast.error(err?.message || 'Erro ao criar mapa.');
    } finally {
      setCreating(false);
    }
  };

  // Definir como Mapa Principal (Ativo) para todos os jogadores
  const handleSetActive = async (mapId) => {
    try {
      await setActiveMapTx(mapId);
      toast.success('Este mapa agora é o Mapa Principal visível para todos os jogadores!');
    } catch (err) {
      toast.error('Erro ao definir mapa principal.');
    }
  };

  // Sincronizar todos os heróis da mesa para o mapa atual
  const handleSyncHeroes = async () => {
    if (!currentMap) return;
    setSyncingHeroes(true);
    try {
      const count = await syncHeroTokensToMap(currentMap.id, players, currentTokens);
      if (count > 0) {
        toast.success(`${count} herói(s) sincronizado(s) no mapa com sucesso!`);
      } else {
        toast.info('Todos os heróis já possuem bonequinhos neste mapa.');
      }
    } catch (err) {
      toast.error('Erro ao sincronizar heróis.');
    } finally {
      setSyncingHeroes(false);
    }
  };

  // Radar Ping emitido pelo Mestre
  const handlePing = async ({ x, y }) => {
    if (!currentMap) return;
    try {
      await broadcastMapPing({
        map_id: currentMap.id,
        user_id: currentUserId,
        user_name: currentUserName || 'Mestre',
        x,
        y,
        color: '#f59e0b',
      });
    } catch {}
  };

  // Rolagem de Dados 3D emitida pelo Mestre (unitário ou múltiplos dados, ex: 3d20, 4d4)
  const handleDiceRoll = async ({ sides, count = 1, results = null, roll, seed }) => {
    if (!currentMap) return;
    try {
      await broadcastMapDiceRoll({
        map_id: currentMap.id,
        user_id: currentUserId,
        user_name: currentUserName || 'Mestre',
        user_role: 'master',
        sides,
        count,
        results,
        roll,
        seed,
      });
    } catch {}
  };

  // Invocação de monstro do Livro dos Monstros ou NPC personalizado no mapa ativo
  const handleSpawnBestiaryToken = async (tokenPayload) => {
    if (!currentMap) return;
    await createMapToken({
      map_id: currentMap.id,
      ...tokenPayload,
    });
  };

  // Abrir estatísticas completas do Livro dos Monstros ao clicar no botão do token em campo
  const handleInspectMonsterById = async (monsterId) => {
    if (!monsterId) return;
    try {
      const list = await loadMonstersCatalog();
      const found = list.find((m) => m.id === monsterId);
      if (found) {
        setInspectedBookMonster(found);
      } else {
        toast.info('Criatura não localizada no catálogo do livro.');
      }
    } catch {
      toast.error('Erro ao carregar estatísticas do Livro dos Monstros.');
    }
  };

  // Excluir Mapa
  const handleDeleteMap = async (mapId) => {
    const targetMap = maps.find((m) => m.id === mapId);
    const mapName = targetMap?.title || 'este mapa';
    if (!confirm(`Deseja realmente excluir o mapa "${mapName}" e todos os seus tokens?`)) return;
    try {
      await deleteMapWithTokens(mapId);
      if (selectedMapId === mapId) {
        const remaining = maps.filter((m) => m.id !== mapId);
        setSelectedMapId(remaining[0]?.id || null);
      }
      toast.success('Mapa excluído da mesa.');
    } catch (err) {
      toast.error('Erro ao excluir mapa.');
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3.5">
      {/* Botões de Ação para o Mestre (sem cabeçalho redundante e sem botão Excluir duplicado) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {currentMap && !currentMap.is_active && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleSetActive(currentMap.id)}
            className="text-xs gap-1.5"
            title="Tornar este o mapa principal que todos os jogadores estão visualizando"
          >
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            Ativar p/ Jogadores
          </Button>
        )}

        <Button
          size="sm"
          variant="secondary"
          onClick={handleSyncHeroes}
          loading={syncingHeroes}
          disabled={!currentMap}
          className="text-xs gap-1.5"
          title="Adicionar automaticamente tokens de todos os heróis da mesa neste mapa"
        >
          <Users className="h-3.5 w-3.5 text-slate-300" />
          Sincronizar Heróis
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSpawnMonsterModalOpen(true)}
          disabled={!currentMap}
          className="text-xs gap-1.5"
        >
          <Skull className="h-3.5 w-3.5 text-rose-400" />
          + Monstro / NPC
        </Button>

        <Button
          size="sm"
          onClick={() => {
            setMapTitle('');
            setCustomUrl('');
            setUrlDimensions(null);
            setUploadedPreview(null);
            setUploadedAsset(null);
            setUploadedFileName('');
            setMapSourceTab('upload');
            setCreateModalOpen(true);
          }}
          className="text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Inserir Mapa
        </Button>
      </div>

      {/* SELETOR E NAVEGADOR DE MAPAS (TRANSIÇÃO ENTRE IMAGENS) */}
      {maps.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-[var(--surface-1)] border border-[var(--border-subtle)] overflow-hidden">
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePrevMap}
            disabled={maps.length <= 1}
            className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-white"
            title="Mapa anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 flex-1 scrollbar-thin">
            {maps.map((m, idx) => {
              const isCurrent = currentMap?.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMapId(m.id)}
                  className={cn(
                    'group relative flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all shrink-0 select-none',
                    isCurrent
                      ? 'bg-white/15 text-white border-white/30 shadow-md ring-1 ring-white/20'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20'
                  )}
                >
                  <div
                    className="h-7 w-9 rounded-md bg-cover bg-center shrink-0 border border-white/15 shadow-inner"
                    style={{ backgroundImage: `url(${m.imageUrl})` }}
                  />
                  <div className="min-w-0 pr-1">
                    <div className="font-bold truncate max-w-[150px] leading-snug">{m.title}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span>#{idx + 1}</span>
                      {m.is_active ? (
                        <span className="text-emerald-400 font-semibold">• Ativo</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetActive(m.id);
                          }}
                          className="hover:text-emerald-300 hover:underline"
                        >
                          • Ativar
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMap(m.id);
                    }}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-white/10 transition-colors ml-1"
                    title="Excluir este mapa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleNextMap}
            disabled={maps.length <= 1}
            className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-white"
            title="Próximo mapa"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* CANVAS TÁTICO INTERATIVO */}
      {currentMap ? (
        <TacticalMapCanvas
          map={currentMap}
          tokens={currentTokens}
          pings={pings}
          diceRolls={diceRolls}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isMaster={true}
          onUpdateTokenPosition={updateMapTokenPosition}
          onUpdateTokenStats={updateMapTokenStats}
          onDeleteToken={deleteMapToken}
          onUpdateMap={updateMap}
          onPing={handlePing}
          onDiceRoll={handleDiceRoll}
          onInspectMonsterId={handleInspectMonsterById}
        />
      ) : (
        <Card className="p-12 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
            <Compass className="h-8 w-8 text-slate-300" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-white">Nenhum Mapa Criado Ainda</h3>
            <p className="text-sm text-slate-400">
              Suba o seu próprio arquivo de imagem ou escolha um mapa da biblioteca para posicionar tokens, medir distâncias e guiar os aventureiros.
            </p>
          </div>
          <Button
            onClick={() => {
              setMapTitle('');
              setCustomUrl('');
              setUrlDimensions(null);
              setUploadedPreview(null);
              setUploadedAsset(null);
              setUploadedFileName('');
              setMapSourceTab('upload');
              setCreateModalOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Inserir Primeiro Mapa
          </Button>
        </Card>
      )}

      {/* MODAL PARA INSERIR MAPA (UPLOAD DE ARQUIVO, BIBLIOTECA OU URL) */}
      <Modal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Inserir Mapa Tático na Mesa"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateMap} className="space-y-4">
          {/* Seletor de Modo de Inserção */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => setMapSourceTab('upload')}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                mapSourceTab === 'upload'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              Subir Arquivo
            </button>
            <button
              type="button"
              onClick={() => setMapSourceTab('preset')}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                mapSourceTab === 'preset'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Biblioteca
            </button>
            <button
              type="button"
              onClick={() => setMapSourceTab('url')}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                mapSourceTab === 'url'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Link2 className="h-3.5 w-3.5" />
              URL da Web
            </button>
          </div>

          {/* ABA 1: SUBIR ARQUIVO DO DISPOSITIVO (MÁXIMA QUALIDADE + DIMENSÕES EXATAS) */}
          {mapSourceTab === 'upload' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />

              {!uploadedPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const dropped = e.dataTransfer?.files?.[0];
                    if (dropped) await processSelectedFile(dropped);
                  }}
                  className={cn(
                    'group rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3',
                    isDragOver
                      ? 'border-white/50 bg-white/15 scale-[1.01]'
                      : 'border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-slate-300 group-hover:scale-105 transition-transform">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Clique ou arraste a imagem do seu mapa aqui
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      PNG, JPG ou WebP — preserva a resolução exata em pixels e a maior qualidade possível
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={compressingFile}
                    className="pointer-events-none mt-1"
                  >
                    {compressingFile ? 'Processando em Máxima Qualidade...' : 'Selecionar Arquivo'}
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/20 bg-[#0c101b] overflow-hidden">
                  <div className="relative w-full max-h-56 bg-black/70 flex items-center justify-center overflow-hidden border-b border-white/10">
                    <img
                      src={uploadedPreview}
                      alt={uploadedFileName || 'Prévia do mapa'}
                      className="max-h-56 w-auto max-w-full object-contain"
                    />
                    {uploadedAsset?.width && uploadedAsset?.height && (
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/80 border border-white/15 text-[10px] font-mono font-bold text-slate-100 backdrop-blur-md">
                        {uploadedAsset.width} × {uploadedAsset.height} px
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {uploadedFileName || 'Imagem carregada'}
                      </div>
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Check className="h-3 w-3 shrink-0" />
                        <span>{uploadedAsset?.qualityLabel || 'Qualidade Máxima'}</span>
                        {uploadedAsset?.width && uploadedAsset?.height && (
                          <span className="text-slate-400 font-mono">
                            • Tamanho real automático ({uploadedAsset.width}×{uploadedAsset.height}px)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs"
                      >
                        Trocar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearUploadedFile}
                        className="text-slate-400 hover:text-rose-400 h-8 w-8 p-0"
                        title="Remover arquivo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: BIBLIOTECA DE MAPAS */}
          {mapSourceTab === 'preset' && (
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                Mapas Oficiais da Biblioteca (Clique para Escolher):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-1 scrollbar-thin">
                {MAP_PRESETS.map((p) => {
                  const selected = selectedPreset?.id === p.id && !uploadedPreview && !customUrl;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPreset(p);
                        setCustomUrl('');
                        setUploadedPreview(null);
                        setUploadedAsset(null);
                        setUploadedFileName('');
                        if (!mapTitle) setMapTitle(p.title);
                      }}
                      className={cn(
                        'group relative rounded-xl border overflow-hidden cursor-pointer transition-all aspect-video',
                        selected
                          ? 'border-white ring-2 ring-white/30 shadow-lg'
                          : 'border-white/10 hover:border-white/20 opacity-75 hover:opacity-100'
                      )}
                    >
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-2">
                        <span className="text-[11px] font-bold text-white leading-tight line-clamp-1">
                          {p.title}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ABA 3: URL DA WEB */}
          {mapSourceTab === 'url' && (
            <div className="space-y-2">
              <FormField label="URL da Imagem do Mapa:">
                <Input
                  placeholder="https://exemplo.com/meu-mapa-dnd.jpg"
                  value={customUrl}
                  onChange={(e) => {
                    setCustomUrl(e.target.value);
                    setUploadedPreview(null);
                    setUploadedAsset(null);
                  }}
                />
              </FormField>
              {urlDimensions && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono px-1">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Dimensão real detectada automaticamente: {urlDimensions.width} × {urlDimensions.height} px
                  </span>
                </div>
              )}
            </div>
          )}

          {/* DETALHES GERAIS DO MAPA (DIMENSÕES EM PX DETECTADAS AUTOMATICAMENTE) */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <FormField label="Título do Mapa:">
              <Input
                placeholder={
                  mapSourceTab === 'upload' && uploadedFileName
                    ? uploadedFileName.replace(/\.[^/.]+$/, '')
                    : selectedPreset?.title || 'Nome da Masmorra ou Taverna'
                }
                value={mapTitle}
                onChange={(e) => setMapTitle(e.target.value)}
              />
            </FormField>

            <FormField label="Tipo de Grade:">
              <Select value={gridType} onChange={(e) => setGridType(e.target.value)}>
                <option value="square">Quadrados Táticos (5ft / 1.5m)</option>
                <option value="none">Sem Grade</option>
              </Select>
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={creating}>
              Adicionar Mapa à Mesa
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL DO LIVRO DOS MONSTROS (ORDEM ALFABÉTICA, FOTOS CIRCULARES E ESTATÍSTICAS) + NPC PERSONALIZADO */}
      <MonsterBestiaryModal
        open={spawnMonsterModalOpen}
        onOpenChange={setSpawnMonsterModalOpen}
        onSpawnToken={handleSpawnBestiaryToken}
        hasActiveMap={Boolean(currentMap)}
      />

      {/* MODAL DE INSPEÇÃO DA FICHA DO LIVRO DOS MONSTROS A PARTIR DE UM TOKEN JÁ NO CAMPO */}
      <MonsterStatDetailModal
        monster={inspectedBookMonster}
        open={Boolean(inspectedBookMonster)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setInspectedBookMonster(null);
        }}
        canAddToMap={false}
      />
    </div>
  );
}
