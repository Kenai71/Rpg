/* eslint-disable @next/next/no-img-element */
'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Image as ImageIcon,
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
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [compressingFile, setCompressingFile] = useState(false);

  const [selectedPreset, setSelectedPreset] = useState(MAP_PRESETS[0]);
  const [customUrl, setCustomUrl] = useState('');
  const [mapTitle, setMapTitle] = useState('');
  const [gridSize, setGridSize] = useState(48);
  const [gridType, setGridType] = useState('square');
  const [creating, setCreating] = useState(false);
  const [syncingHeroes, setSyncingHeroes] = useState(false);

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

  // Compressor de arquivo de imagem no cliente (Canvas -> JPEG máx 1920px com alta qualidade e preservação de proporção)
  const compressImageFile = (file) => {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Selecione um arquivo de imagem válido (PNG, JPG, WebP).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let maxDim = 1920;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          // Garante que o tamanho final fique seguro dentro do limite do Firestore (máx 820KB)
          while (dataUrl.length > 820000 && quality > 0.45) {
            quality -= 0.05;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Se ainda exceder, reduz dimensões levemente
          if (dataUrl.length > 820000) {
            const downscaled = document.createElement('canvas');
            const scaleFactor = 0.8;
            downscaled.width = Math.round(width * scaleFactor);
            downscaled.height = Math.round(height * scaleFactor);
            const dCtx = downscaled.getContext('2d');
            dCtx.drawImage(canvas, 0, 0, downscaled.width, downscaled.height);
            dataUrl = downscaled.toDataURL('image/jpeg', 0.8);
            width = downscaled.width;
            height = downscaled.height;
          }

          resolve({
            dataUrl,
            width,
            height,
            name: file.name.replace(/\.[^/.]+$/, ''),
          });
        };
        img.onerror = () => reject(new Error('Falha ao processar arquivo de imagem.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
      reader.readAsDataURL(file);
    });
  };

  // Upload de arquivo pelo Mestre
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressingFile(true);
    try {
      const result = await compressImageFile(file);
      setUploadedPreview(result.dataUrl);
      setUploadedFileName(file.name);
      setCustomUrl(result.dataUrl);
      if (!mapTitle.trim()) {
        setMapTitle(result.name);
      }
      toast.success(`Imagem "${file.name}" processada com sucesso!`);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar arquivo de imagem.');
    } finally {
      setCompressingFile(false);
    }
  };

  const handleClearUploadedFile = () => {
    setUploadedPreview(null);
    setUploadedFileName('');
    setCustomUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Criar / Inserir Mapa
  const handleCreateMap = async (e) => {
    e.preventDefault();
    let finalUrl = '';
    if (mapSourceTab === 'upload' && uploadedPreview) {
      finalUrl = uploadedPreview;
    } else if (mapSourceTab === 'url' && customUrl.trim()) {
      finalUrl = customUrl.trim();
    } else if (mapSourceTab === 'preset' && selectedPreset?.imageUrl) {
      finalUrl = selectedPreset.imageUrl;
    } else {
      finalUrl = customUrl.trim() || uploadedPreview || selectedPreset?.imageUrl;
    }

    const finalTitle =
      mapTitle.trim() ||
      (mapSourceTab === 'upload' ? uploadedFileName : null) ||
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
        gridType,
        gridSize: Number(gridSize) || 48,
        gridOpacity: 0.25,
        scale: 1.0,
        is_active: maps.length === 0, // Se for o primeiro, ativa automaticamente
        is_locked: false,
      });

      setSelectedMapId(newId);
      setCreateModalOpen(false);
      setCustomUrl('');
      setMapTitle('');
      setUploadedPreview(null);
      setUploadedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Mapa tático adicionado à mesa!');
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

  // Rolagem de Dados 3D emitida pelo Mestre
  const handleDiceRoll = async ({ sides, roll, seed }) => {
    if (!currentMap) return;
    try {
      await broadcastMapDiceRoll({
        map_id: currentMap.id,
        user_id: currentUserId,
        user_name: currentUserName || 'Mestre',
        user_role: 'master',
        sides,
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
            setUploadedPreview(null);
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
              setUploadedPreview(null);
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
              <span>🔗</span>
              URL da Web
            </button>
          </div>

          {/* ABA 1: SUBIR ARQUIVO DO DISPOSITIVO */}
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
                  className="group rounded-2xl border-2 border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
                >
                  <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-slate-300 group-hover:scale-105 transition-transform">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Clique para escolher a imagem do seu mapa
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Suporta PNG, JPG, JPEG e WebP (otimização e compactação automática)
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={compressingFile}
                    className="pointer-events-none mt-1"
                  >
                    Selecionar Arquivo
                  </Button>
                </div>
              ) : (
                <div className="relative rounded-2xl border border-white/20 bg-black/40 p-3 flex items-center gap-3">
                  <div
                    className="h-16 w-24 rounded-xl bg-cover bg-center shrink-0 border border-white/15"
                    style={{ backgroundImage: `url(${uploadedPreview})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {uploadedFileName || 'Imagem carregada'}
                    </div>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <Check className="h-3 w-3" />
                      Pronto para adicionar à mesa
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
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
                        setUploadedFileName('');
                        if (!mapTitle) setMapTitle(p.title);
                        setGridSize(p.gridSize);
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
            <FormField label="URL da Imagem do Mapa:">
              <Input
                placeholder="https://exemplo.com/meu-mapa-dnd.jpg"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setUploadedPreview(null);
                }}
              />
            </FormField>
          )}

          {/* DETALHES GERAIS DO MAPA */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <FormField label="Título do Mapa:">
              <Input
                placeholder={
                  mapSourceTab === 'upload' && uploadedFileName
                    ? uploadedFileName
                    : selectedPreset?.title || 'Nome da Masmorra ou Taverna'
                }
                value={mapTitle}
                onChange={(e) => setMapTitle(e.target.value)}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tipo de Grade:">
                <Select value={gridType} onChange={(e) => setGridType(e.target.value)}>
                  <option value="square">Quadrados Táticos (5ft / 1.5m)</option>
                  <option value="none">Sem Grade</option>
                </Select>
              </FormField>

              <FormField label="Tamanho da Célula (px):">
                <Input
                  type="number"
                  min="20"
                  max="120"
                  value={gridSize}
                  onChange={(e) => setGridSize(e.target.value)}
                />
              </FormField>
            </div>
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
