'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  Briefcase,
  Check,
  Compass,
  Eye,
  Heart,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Shield,
  StickyNote,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { GiHoodedFigure } from 'react-icons/gi';
import { toast } from 'sonner';
import { auth } from '../../lib/firebase';
import {
  createMapToken,
  createNpc,
  deleteNpc,
  removeNpcTokensFromMap,
  updateNpc,
} from '../../lib/rpg-service';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { FormField, Input, Select, Textarea } from '../ui/Input';
import { ConfirmDialog, Modal } from '../ui/Modal';

const ATTITUDE_OPTIONS = [
  { id: 'Aliado', label: 'Aliado', color: '#34d399', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { id: 'Neutro', label: 'Neutro', color: '#38bdf8', badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  { id: 'Misterioso', label: 'Misterioso', color: '#a78bfa', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { id: 'Hostil', label: 'Hostil', color: '#fb7185', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
];

function getAttitudeMeta(attitude) {
  return ATTITUDE_OPTIONS.find((a) => a.id === attitude) || ATTITUDE_OPTIONS[1];
}

const EMPTY_MANUAL_FORM = {
  name: '',
  profession: '',
  race: 'Humano',
  attitude: 'Neutro',
  story_context: '',
  appearance: '',
  personality: '',
  story_hook: '',
  secret: '',
  description: '',
  notes: '',
  hp: 22,
  ac: 12,
  mana: 0,
  speed: 9,
};

export function MasterNpcs({
  npcs = [],
  maps = [],
  tokens = [],
  missions = [],
  currentUserId,
}) {
  // Mapa alvo para adicionar / remover tokens de NPCs (padrão = Mapa Ativo)
  const activeMap = useMemo(() => maps.find((m) => m.is_active) || maps[0] || null, [maps]);
  const [targetMapId, setTargetMapId] = useState(activeMap?.id || '');

  useEffect(() => {
    if (!targetMapId && activeMap?.id) {
      setTargetMapId(activeMap.id);
    } else if (targetMapId && maps.length > 0 && !maps.some((m) => m.id === targetMapId)) {
      setTargetMapId(activeMap?.id || '');
    }
  }, [activeMap?.id, maps, targetMapId]);

  const targetMap = useMemo(
    () => maps.find((m) => m.id === targetMapId) || activeMap || null,
    [maps, targetMapId, activeMap]
  );

  // Formulário do Gerador de NPC Atrelado à História (IA)
  const [storyContext, setStoryContext] = useState('');
  const [genProfession, setGenProfession] = useState('');
  const [genAttitude, setGenAttitude] = useState('');
  const [genRace, setGenRace] = useState('');
  const [generating, setGenerating] = useState(false);

  // Filtros da biblioteca de cards
  const [search, setSearch] = useState('');
  const [attitudeFilter, setAttitudeFilter] = useState('ALL');
  const [onlyOnMap, setOnlyOnMap] = useState(false);

  // Modal de detalhes do NPC (abre ao clicar no card)
  const [selectedNpcId, setSelectedNpcId] = useState(null);
  const selectedNpc = useMemo(
    () => npcs.find((n) => n.id === selectedNpcId) || null,
    [npcs, selectedNpcId]
  );

  // Modal de criar/editar NPC manualmente
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingNpcId, setEditingNpcId] = useState(null);
  const [formState, setFormState] = useState(EMPTY_MANUAL_FORM);
  const [savingForm, setSavingForm] = useState(false);

  // Confirmação de exclusão
  const [confirmDeleteNpc, setConfirmDeleteNpc] = useState(null);
  const [deletingNpc, setDeletingNpc] = useState(false);

  // Estado de carregamento de ações no mapa por NPC
  const [mapBusyId, setMapBusyId] = useState(null);

  // Anotações inline em tempo real nos cards e no modal (com auto-save debounce)
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNoteIds, setSavingNoteIds] = useState({});
  const noteTimersRef = useRef({});

  useEffect(() => {
    const timers = noteTimersRef.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  const getNpcNoteValue = (npc) => {
    if (!npc) return '';
    return npc.id in noteDrafts ? noteDrafts[npc.id] : npc.notes || '';
  };

  const handleNoteChange = (npcId, nextValue) => {
    setNoteDrafts((prev) => ({ ...prev, [npcId]: nextValue }));
    if (noteTimersRef.current[npcId]) {
      clearTimeout(noteTimersRef.current[npcId]);
    }
    noteTimersRef.current[npcId] = setTimeout(async () => {
      delete noteTimersRef.current[npcId];
      setSavingNoteIds((prev) => ({ ...prev, [npcId]: true }));
      try {
        await updateNpc(npcId, { notes: nextValue });
      } catch {
        toast.error('Erro ao salvar anotação do NPC.');
      } finally {
        setSavingNoteIds((prev) => {
          const copy = { ...prev };
          delete copy[npcId];
          return copy;
        });
      }
    }, 550);
  };

  const flushNpcNote = async (npcId) => {
    if (!(npcId in noteDrafts)) return;
    if (noteTimersRef.current[npcId]) {
      clearTimeout(noteTimersRef.current[npcId]);
      delete noteTimersRef.current[npcId];
    }
    const val = noteDrafts[npcId];
    setSavingNoteIds((prev) => ({ ...prev, [npcId]: true }));
    try {
      await updateNpc(npcId, { notes: val });
    } catch {
      toast.error('Erro ao salvar anotação do NPC.');
    } finally {
      setSavingNoteIds((prev) => {
        const copy = { ...prev };
        delete copy[npcId];
        return copy;
      });
    }
  };

  // Mapeia quais NPCs estão presentes no mapa alvo e em outros mapas
  const npcMapPresence = useMemo(() => {
    const byNpc = new Map();
    tokens.forEach((tok) => {
      if (!tok.npc_id) return;
      const list = byNpc.get(tok.npc_id) || [];
      list.push(tok);
      byNpc.set(tok.npc_id, list);
    });
    return byNpc;
  }, [tokens]);

  const filteredNpcs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return npcs.filter((npc) => {
      if (attitudeFilter !== 'ALL' && (npc.attitude || 'Neutro') !== attitudeFilter) return false;
      if (onlyOnMap) {
        const present = (npcMapPresence.get(npc.id) || []).some(
          (t) => !targetMap || t.map_id === targetMap.id
        );
        if (!present) return false;
      }
      if (q) {
        const hay = `${npc.name || ''} ${npc.profession || ''} ${npc.race || ''} ${npc.story_hook || ''} ${npc.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [npcs, search, attitudeFilter, onlyOnMap, npcMapPresence, targetMap]);

  const npcsOnTargetMapCount = useMemo(() => {
    if (!targetMap) return 0;
    return npcs.filter((n) =>
      (npcMapPresence.get(n.id) || []).some((t) => t.map_id === targetMap.id)
    ).length;
  }, [npcs, npcMapPresence, targetMap]);

  // Geração de NPC atrelado à história via IA (/api/npc-generate)
  const handleGenerateNpcAI = async (e) => {
    e.preventDefault();
    if (!auth?.currentUser) return;
    setGenerating(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const missionHints = missions
        .filter((m) => m.status === 'open' || m.status === 'in_progress')
        .slice(0, 6)
        .map((m) => m.title);

      const res = await fetch('/api/npc-generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storyContext,
          profession: genProfession,
          attitude: genAttitude,
          race: genRace,
          activeMapTitle: targetMap?.title || '',
          missionHints,
          existingNpcNames: npcs.slice(0, 30).map((n) => n.name),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success || !data?.npc) {
        throw new Error(data?.error || 'Não foi possível gerar o NPC.');
      }

      const newId = await createNpc({
        ...data.npc,
        story_context: storyContext.trim(),
        notes: '',
        created_by: currentUserId || null,
      });

      setSelectedNpcId(newId);
      setGenProfession('');
      setGenRace('');
    } catch (err) {
      toast.error(err?.message || 'Erro ao gerar NPC.');
    } finally {
      setGenerating(false);
    }
  };

  const openCreateManual = () => {
    setEditingNpcId(null);
    setFormState({
      ...EMPTY_MANUAL_FORM,
      story_context: storyContext.trim(),
    });
    setFormModalOpen(true);
  };

  const openEditNpc = (npc) => {
    setEditingNpcId(npc.id);
    setFormState({
      name: npc.name || '',
      profession: npc.profession || '',
      race: npc.race || 'Humano',
      attitude: npc.attitude || 'Neutro',
      story_context: npc.story_context || '',
      appearance: npc.appearance || '',
      personality: npc.personality || '',
      story_hook: npc.story_hook || '',
      secret: npc.secret || '',
      description: npc.description || '',
      notes: getNpcNoteValue(npc),
      hp: Number(npc.max_hp ?? npc.hp ?? 22),
      ac: Number(npc.ac ?? 12),
      mana: Number(npc.max_mana ?? npc.mana ?? 0),
      speed: Number(npc.speed ?? 9),
    });
    setFormModalOpen(true);
  };

  const handleSaveManualForm = async (e) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.profession.trim()) return;
    setSavingForm(true);
    try {
      const attMeta = getAttitudeMeta(formState.attitude);
      const payload = {
        name: formState.name.trim(),
        profession: formState.profession.trim(),
        race: formState.race.trim() || 'Humano',
        attitude: attMeta.id,
        story_context: formState.story_context.trim(),
        appearance: formState.appearance.trim(),
        personality: formState.personality.trim(),
        story_hook: formState.story_hook.trim(),
        secret: formState.secret.trim(),
        description: formState.description.trim(),
        notes: formState.notes,
        hp: Math.max(1, Math.floor(Number(formState.hp) || 22)),
        max_hp: Math.max(1, Math.floor(Number(formState.hp) || 22)),
        ac: Math.max(1, Math.floor(Number(formState.ac) || 12)),
        mana: Math.max(0, Math.floor(Number(formState.mana) || 0)),
        max_mana: Math.max(0, Math.floor(Number(formState.mana) || 0)),
        speed: Math.max(0, Math.round((Number(formState.speed) || 9) * 10) / 10),
        avatar_color: attMeta.color,
        created_by: currentUserId || null,
      };

      if (editingNpcId) {
        await updateNpc(editingNpcId, payload);
        setNoteDrafts((prev) => {
          const copy = { ...prev };
          delete copy[editingNpcId];
          return copy;
        });
      } else {
        await createNpc(payload);
      }
      setFormModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar NPC.');
    } finally {
      setSavingForm(false);
    }
  };

  // Adiciona o NPC diretamente na lista de tokens do mapa selecionado
  const handleAddNpcToMap = async (npc) => {
    if (!targetMap) {
      toast.error('Crie ou selecione um mapa na aba Mesa & Mapas primeiro.');
      return;
    }
    setMapBusyId(npc.id);
    try {
      const attMeta = getAttitudeMeta(npc.attitude);
      const offsetX = Math.round((46 + Math.random() * 10) * 100) / 100;
      const offsetY = Math.round((46 + Math.random() * 10) * 100) / 100;
      await createMapToken({
        map_id: targetMap.id,
        name: npc.name,
        type: 'npc',
        npc_id: npc.id,
        npc_profession: npc.profession,
        npc_role: npc.attitude || 'Neutro',
        color: npc.avatar_color || attMeta.color,
        size: 'M',
        x: offsetX,
        y: offsetY,
        hp: Number(npc.hp ?? npc.max_hp ?? 22),
        max_hp: Number(npc.max_hp ?? npc.hp ?? 22),
        ac: Number(npc.ac ?? 12),
        mana: Number(npc.mana ?? npc.max_mana ?? 0),
        max_mana: Number(npc.max_mana ?? npc.mana ?? 0),
        move_limit: Number(npc.speed ?? 9),
        is_ally: npc.attitude === 'Aliado',
        name_hidden: false,
        hidden: false,
      });
    } catch (err) {
      toast.error(err?.message || 'Erro ao adicionar NPC ao mapa.');
    } finally {
      setMapBusyId(null);
    }
  };

  // Remove o token do NPC do mapa selecionado (mantendo o card salvo na biblioteca da história)
  const handleRemoveNpcFromMap = async (npc) => {
    if (!targetMap) return;
    setMapBusyId(npc.id);
    try {
      await removeNpcTokensFromMap(npc.id, targetMap.id);
    } catch (err) {
      toast.error(err?.message || 'Erro ao retirar NPC do mapa.');
    } finally {
      setMapBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteNpc) return;
    setDeletingNpc(true);
    try {
      await removeNpcTokensFromMap(confirmDeleteNpc.id);
      await deleteNpc(confirmDeleteNpc.id);
      if (selectedNpcId === confirmDeleteNpc.id) {
        setSelectedNpcId(null);
      }
      setConfirmDeleteNpc(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir NPC.');
    } finally {
      setDeletingNpc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho + Seletor de Mapa Alvo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <GiHoodedFigure className="h-5 w-5 text-slate-300" />
            Gerador &amp; Biblioteca de NPCs da História
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Crie personagens conectados à trama atual, registre anotações nos cards e coloque ou retire seus tokens no mapa em 1 clique.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {maps.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-1)] border border-white/12">
              <Compass className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                Mapa Alvo:
              </span>
              <select
                aria-label="Selecionar mapa alvo para tokens de NPCs"
                value={targetMap?.id || ''}
                onChange={(e) => setTargetMapId(e.target.value)}
                className="h-7 rounded-lg px-2 text-xs font-semibold border border-white/15 bg-[#0c101b] text-white"
              >
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} {m.is_active ? '(Ativo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button variant="secondary" size="sm" onClick={openCreateManual}>
            <Plus className="h-4 w-4 text-slate-300" />
            Criar Manualmente
          </Button>
        </div>
      </div>

      {/* Painel do Gerador de NPC Atrelado à História (IA) */}
      <Card className="relative overflow-hidden border-white/12">
        <div
          aria-hidden="true"
          className="h-[3px] w-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400"
        />
        <form onSubmit={handleGenerateNpcAI} className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-white/[0.06] border border-white/12 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-slate-300" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Gerar NPC Atrelado à História (IA)</h3>
                <p className="text-[11px] text-slate-400">
                  Descreva o momento da campanha, local ou gancho narrativo — a IA cria nome, profissão, aparência, conexão com a história e segredo do Mestre.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span>{npcs.length} NPC(s)</span>
              <span>•</span>
              <span className="text-emerald-300">{npcsOnTargetMapCount} no mapa</span>
            </div>
          </div>

          <FormField
            label="Contexto da História / Cena / Local"
            htmlFor="npc-story-context"
          >
            <Textarea
              id="npc-story-context"
              rows={2}
              placeholder="Ex: Os aventureiros estão investigando desaparecimentos no porto durante uma tempestade e precisam de alguém que conheça os túneis de contrabando..."
              value={storyContext}
              onChange={(e) => setStoryContext(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
            <FormField label="Profissão (opcional)" htmlFor="npc-gen-prof">
              <Input
                id="npc-gen-prof"
                placeholder="Ex: Ferreiro, Taverneira, Alquimista"
                value={genProfession}
                onChange={(e) => setGenProfession(e.target.value)}
                className="h-10"
              />
            </FormField>

            <FormField label="Raça (opcional)" htmlFor="npc-gen-race">
              <Input
                id="npc-gen-race"
                placeholder="Ex: Anão, Elfo, Tiefling"
                value={genRace}
                onChange={(e) => setGenRace(e.target.value)}
                className="h-10"
              />
            </FormField>

            <FormField label="Papel / Atitude" htmlFor="npc-gen-att">
              <Select
                id="npc-gen-att"
                value={genAttitude}
                onChange={(e) => setGenAttitude(e.target.value)}
                className="h-10"
              >
                <option value="">Automático pela história</option>
                {ATTITUDE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <Button type="submit" loading={generating} className="h-10 w-full">
              {!generating && <Bot className="h-4 w-4 text-slate-300" />}
              {generating ? 'Forjando NPC...' : 'Gerar NPC da História'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Barra de Busca e Filtros dos Cards */}
      <div className="rounded-2xl surface-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            icon={Search}
            placeholder="Buscar por nome, profissão ou nota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar NPC"
            className="h-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filtrar por atitude"
            value={attitudeFilter}
            onChange={(e) => setAttitudeFilter(e.target.value)}
            className="w-auto min-w-[140px] h-10"
          >
            <option value="ALL">Todas Atitudes</option>
            {ATTITUDE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Button
            variant={onlyOnMap ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setOnlyOnMap((v) => !v)}
            className="h-10"
          >
            <MapPin className="h-3.5 w-3.5 text-slate-300" />
            {onlyOnMap ? 'Apenas no Mapa' : 'Filtrar no Mapa'}
          </Button>
        </div>
      </div>

      {/* Grade de Cards de NPCs */}
      {filteredNpcs.length === 0 ? (
        <EmptyState
          icon={GiHoodedFigure}
          title={npcs.length === 0 ? 'Nenhum NPC gerado ainda' : 'Nenhum NPC corresponde aos filtros'}
          description={
            npcs.length === 0
              ? 'Informe o contexto da história acima e clique em "Gerar NPC da História" ou crie um NPC manualmente.'
              : 'Limpe a busca ou altere o filtro de atitude/mapa.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredNpcs.map((npc) => {
            const attMeta = getAttitudeMeta(npc.attitude);
            const allInstances = npcMapPresence.get(npc.id) || [];
            const targetInstances = targetMap
              ? allInstances.filter((t) => t.map_id === targetMap.id)
              : [];
            const isOnTargetMap = targetInstances.length > 0;
            const busy = mapBusyId === npc.id;
            const noteValue = getNpcNoteValue(npc);
            const isSavingNote = Boolean(savingNoteIds[npc.id]);

            return (
              <Card
                key={npc.id}
                interactive
                onClick={() => setSelectedNpcId(npc.id)}
                className="relative flex flex-col justify-between overflow-hidden cursor-pointer group border-white/10 hover:border-white/25"
              >
                {/* Linha superior de destaque por atitude */}
                <div
                  aria-hidden="true"
                  className="h-[4px] w-full shrink-0"
                  style={{ backgroundColor: npc.avatar_color || attMeta.color }}
                />

                <div>
                  <CardHeader className="pt-4 pb-2.5">
                    <div className="min-w-0 space-y-1.5 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={attMeta.badge}>{attMeta.label}</Badge>
                        {npc.race && (
                          <Badge className="bg-white/[0.05] text-slate-300 border-white/10 text-[10px]">
                            {npc.race}
                          </Badge>
                        )}
                        {isOnTargetMap && (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/35 text-[10px]">
                            <MapPin className="h-2.5 w-2.5" />
                            No Mapa {targetInstances.length > 1 ? `(${targetInstances.length})` : ''}
                          </Badge>
                        )}
                      </div>

                      <CardTitle className="text-base text-white group-hover:text-slate-100 transition-colors truncate">
                        {npc.name}
                      </CardTitle>

                      {/* Profissão destacada no card */}
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{npc.profession || 'Sem profissão'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNpcId(npc.id);
                      }}
                      title="Abrir descrição completa do NPC"
                      aria-label={`Ver descrição de ${npc.name}`}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3.5">
                    {(npc.story_hook || npc.description) && (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {npc.story_hook || npc.description}
                      </p>
                    )}

                    {/* Mini stats de ficha do NPC */}
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10">
                        <Heart className="h-3 w-3 text-rose-400" />
                        {npc.max_hp || npc.hp || 22} PV
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10">
                        <Shield className="h-3 w-3 text-slate-300" />
                        CA {npc.ac || 12}
                      </span>
                    </div>

                    {/* Campo de Anotações Rápidas direto no Card */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="space-y-1 pt-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`npc-note-${npc.id}`}
                          className="text-[10px] font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1"
                        >
                          <StickyNote className="h-3 w-3 text-slate-400" />
                          Anotações do Mestre
                        </label>
                        {isSavingNote ? (
                          <span className="text-[10px] font-mono text-slate-400 inline-flex items-center gap-1">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            Salvando...
                          </span>
                        ) : (
                          npc.id in noteDrafts && (
                            <span className="text-[10px] font-mono text-emerald-400 inline-flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" />
                              Salvo
                            </span>
                          )
                        )}
                      </div>
                      <textarea
                        id={`npc-note-${npc.id}`}
                        rows={2}
                        placeholder="Anote pistas, promessas, localização ou o que aconteceu com este NPC..."
                        value={noteValue}
                        onChange={(e) => handleNoteChange(npc.id, e.target.value)}
                        onBlur={() => flushNpcNote(npc.id)}
                        className="w-full rounded-xl border border-white/15 bg-[#0c101b] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 resize-none focus:outline-none focus:border-white/30"
                      />
                    </div>
                  </CardContent>
                </div>

                {/* Ações do Card: Adicionar na lista de tokens do mapa & Tirar do mapa */}
                <CardFooter
                  onClick={(e) => e.stopPropagation()}
                  className="justify-between gap-2 flex-wrap"
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Button
                      size="sm"
                      variant={isOnTargetMap ? 'secondary' : 'primary'}
                      disabled={!targetMap || busy}
                      loading={busy && !isOnTargetMap}
                      onClick={() => handleAddNpcToMap(npc)}
                      title={
                        targetMap
                          ? `Adicionar token de ${npc.name} em "${targetMap.title}"`
                          : 'Crie um mapa primeiro'
                      }
                      className="flex-1 text-xs h-8 px-2.5"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      <span className="truncate">
                        {isOnTargetMap ? '+ Mapa' : 'Adicionar ao Mapa'}
                      </span>
                    </Button>

                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!isOnTargetMap || busy}
                      loading={busy && isOnTargetMap}
                      onClick={() => handleRemoveNpcFromMap(npc)}
                      title={
                        isOnTargetMap
                          ? `Remover ${npc.name} do mapa "${targetMap?.title || ''}"`
                          : 'Este NPC não está no mapa selecionado'
                      }
                      className="flex-1 text-xs h-8 px-2.5"
                    >
                      <UserMinus className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Tirar do Mapa</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-8 w-8"
                      onClick={() => openEditNpc(npc)}
                      title="Editar ficha do NPC"
                      aria-label={`Editar ${npc.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                      onClick={() => setConfirmDeleteNpc(npc)}
                      title="Excluir NPC"
                      aria-label={`Excluir ${npc.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL DE DESCRIÇÃO COMPLETA DO NPC (ABRE AO CLICAR NO CARD) */}
      <Modal
        open={Boolean(selectedNpc)}
        onOpenChange={(open) => {
          if (!open) {
            if (selectedNpc) flushNpcNote(selectedNpc.id);
            setSelectedNpcId(null);
          }
        }}
        title={selectedNpc?.name || 'Detalhes do NPC'}
        description={
          selectedNpc
            ? `${selectedNpc.profession || 'Sem profissão'} • ${selectedNpc.race || 'Humano'}`
            : ''
        }
        maxWidth="max-w-2xl"
        footer={
          selectedNpc && (() => {
            const onMap = targetMap
              ? (npcMapPresence.get(selectedNpc.id) || []).some((t) => t.map_id === targetMap.id)
              : false;
            const busy = mapBusyId === selectedNpc.id;
            return (
              <div className="w-full flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEditNpc(selectedNpc)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmDeleteNpc(selectedNpc)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={onMap ? 'secondary' : 'primary'}
                    disabled={!targetMap || busy}
                    onClick={() => handleAddNpcToMap(selectedNpc)}
                  >
                    <UserPlus className="h-3.5 w-3.5 text-slate-300" />
                    Adicionar ao Mapa
                  </Button>
                  {onMap && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => handleRemoveNpcFromMap(selectedNpc)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Tirar do Mapa
                    </Button>
                  )}
                </div>
              </div>
            );
          })()
        }
      >
        {selectedNpc && (() => {
          const attMeta = getAttitudeMeta(selectedNpc.attitude);
          return (
            <div className="space-y-4">
              {/* Badges + Status rápidos */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={attMeta.badge}>{attMeta.label}</Badge>
                  <Badge className="bg-white/[0.05] text-slate-200 border-white/10">
                    <Briefcase className="h-3 w-3 text-slate-300" />
                    {selectedNpc.profession}
                  </Badge>
                  {selectedNpc.race && (
                    <Badge className="bg-white/[0.05] text-slate-300 border-white/10">
                      {selectedNpc.race}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                  <span className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                    PV {selectedNpc.max_hp || selectedNpc.hp || 22}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                    CA {selectedNpc.ac || 12}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                    {selectedNpc.speed || 9}m
                  </span>
                </div>
              </div>

              {selectedNpc.description && (
                <div className="rounded-xl bg-[var(--surface-0)]/75 border border-white/10 p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-slate-300" />
                    Descrição &amp; Apresentação
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedNpc.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedNpc.appearance && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Aparência &amp; Trejeitos
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                      {selectedNpc.appearance}
                    </p>
                  </div>
                )}

                {selectedNpc.personality && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Personalidade
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                      {selectedNpc.personality}
                    </p>
                  </div>
                )}
              </div>

              {selectedNpc.story_hook && (
                <div className="rounded-xl bg-white/[0.03] border border-white/12 p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block">
                    Conexão com a História
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedNpc.story_hook}
                  </p>
                </div>
              )}

              {selectedNpc.secret && (
                <div className="rounded-xl bg-violet-500/[0.06] border border-violet-400/25 p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 block">
                    Segredo Exclusivo do Mestre
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedNpc.secret}
                  </p>
                </div>
              )}

              {/* Anotações do Mestre sincronizadas com o Card */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="npc-modal-notes"
                    className="text-xs font-bold uppercase tracking-wider text-slate-300 inline-flex items-center gap-1.5"
                  >
                    <StickyNote className="h-3.5 w-3.5 text-slate-300" />
                    Anotações do Mestre sobre {selectedNpc.name}
                  </label>
                  {savingNoteIds[selectedNpc.id] && (
                    <span className="text-[11px] font-mono text-slate-400 inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Salvando...
                    </span>
                  )}
                </div>
                <Textarea
                  id="npc-modal-notes"
                  rows={4}
                  placeholder="Registre interações com o grupo, acordos, segredos revelados ou planos futuros..."
                  value={getNpcNoteValue(selectedNpc)}
                  onChange={(e) => handleNoteChange(selectedNpc.id, e.target.value)}
                  onBlur={() => flushNpcNote(selectedNpc.id)}
                />
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* MODAL CRIAR / EDITAR NPC MANUALMENTE */}
      <Modal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        title={editingNpcId ? 'Editar NPC' : 'Criar NPC Manualmente'}
        description="Defina nome, profissão, história e estatísticas para usar na campanha e no mapa."
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="npc-manual-form" loading={savingForm}>
              {editingNpcId ? 'Salvar Alterações' : 'Criar NPC'}
            </Button>
          </>
        }
      >
        <form id="npc-manual-form" onSubmit={handleSaveManualForm} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Nome do NPC" htmlFor="m-npc-name" required>
              <Input
                id="m-npc-name"
                required
                placeholder="Ex: Capitão Aldric"
                value={formState.name}
                onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Profissão" htmlFor="m-npc-prof" required>
              <Input
                id="m-npc-prof"
                required
                placeholder="Ex: Guarda do Portão, Ferreiro"
                value={formState.profession}
                onChange={(e) => setFormState((s) => ({ ...s, profession: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Raça" htmlFor="m-npc-race">
              <Input
                id="m-npc-race"
                value={formState.race}
                onChange={(e) => setFormState((s) => ({ ...s, race: e.target.value }))}
              />
            </FormField>
            <FormField label="Atitude" htmlFor="m-npc-att">
              <Select
                id="m-npc-att"
                value={formState.attitude}
                onChange={(e) => setFormState((s) => ({ ...s, attitude: e.target.value }))}
              >
                {ATTITUDE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="PV Máx." htmlFor="m-npc-hp">
              <Input
                id="m-npc-hp"
                type="number"
                min="1"
                value={formState.hp}
                onChange={(e) => setFormState((s) => ({ ...s, hp: e.target.value }))}
              />
            </FormField>
            <FormField label="CA" htmlFor="m-npc-ac">
              <Input
                id="m-npc-ac"
                type="number"
                min="1"
                value={formState.ac}
                onChange={(e) => setFormState((s) => ({ ...s, ac: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Descrição Completa" htmlFor="m-npc-desc">
            <Textarea
              id="m-npc-desc"
              rows={2}
              value={formState.description}
              onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Aparência" htmlFor="m-npc-app">
              <Textarea
                id="m-npc-app"
                rows={2}
                value={formState.appearance}
                onChange={(e) => setFormState((s) => ({ ...s, appearance: e.target.value }))}
              />
            </FormField>
            <FormField label="Personalidade" htmlFor="m-npc-pers">
              <Textarea
                id="m-npc-pers"
                rows={2}
                value={formState.personality}
                onChange={(e) => setFormState((s) => ({ ...s, personality: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Conexão com a História" htmlFor="m-npc-hook">
            <Textarea
              id="m-npc-hook"
              rows={2}
              value={formState.story_hook}
              onChange={(e) => setFormState((s) => ({ ...s, story_hook: e.target.value }))}
            />
          </FormField>

          <FormField label="Segredo do Mestre" htmlFor="m-npc-secret">
            <Textarea
              id="m-npc-secret"
              rows={2}
              value={formState.secret}
              onChange={(e) => setFormState((s) => ({ ...s, secret: e.target.value }))}
            />
          </FormField>

          <FormField label="Anotações" htmlFor="m-npc-notes">
            <Textarea
              id="m-npc-notes"
              rows={2}
              value={formState.notes}
              onChange={(e) => setFormState((s) => ({ ...s, notes: e.target.value }))}
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDeleteNpc)}
        onOpenChange={(open) => !open && setConfirmDeleteNpc(null)}
        title="Excluir NPC"
        description={`Tem certeza que deseja excluir "${confirmDeleteNpc?.name}" da biblioteca e remover eventuais tokens dele dos mapas?`}
        confirmLabel="Excluir NPC"
        loading={deletingNpc}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
