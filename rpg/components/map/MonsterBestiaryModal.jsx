/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Compass,
  Eye,
  EyeOff,
  Footprints,
  Heart,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Skull,
  Sword,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { TOKEN_SIZES } from '../../lib/map-presets';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField, Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';

// Cache em memória do catálogo completo do Livro dos Monstros (evita refetch a cada abertura)
let cachedMonsters = null;
let cachedMonstersPromise = null;

export async function loadMonstersCatalog() {
  if (cachedMonsters) return cachedMonsters;
  if (!cachedMonstersPromise) {
    cachedMonstersPromise = fetch('/data/monsters-catalog.json')
      .then((res) => {
        if (!res.ok) throw new Error('Não foi possível carregar o Livro dos Monstros.');
        return res.json();
      })
      .then((data) => {
        cachedMonsters = Array.isArray(data) ? data : [];
        return cachedMonsters;
      })
      .catch((err) => {
        cachedMonstersPromise = null;
        throw err;
      });
  }
  return cachedMonstersPromise;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const CR_FILTERS = [
  { value: 'ALL', label: 'Todos ND' },
  { value: '0-0.5', label: 'ND 0 – 1/2' },
  { value: '1-4', label: 'ND 1 – 4' },
  { value: '5-10', label: 'ND 5 – 10' },
  { value: '11-16', label: 'ND 11 – 16' },
  { value: '17-30', label: 'ND 17 – 30' },
];

const ABILITY_META = [
  { key: 'for', label: 'FOR' },
  { key: 'des', label: 'DES' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'sab', label: 'SAB' },
  { key: 'car', label: 'CAR' },
];

function normalizeLetter(name) {
  const ch = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
}

function normalizeQuery(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getCrBadgeTone(crNum) {
  const n = Number(crNum) || 0;
  if (n >= 17) return 'bg-rose-500/20 text-rose-200 border-rose-400/40';
  if (n >= 11) return 'bg-amber-500/20 text-amber-200 border-amber-400/40';
  if (n >= 5) return 'bg-purple-500/20 text-purple-200 border-purple-400/40';
  if (n >= 1) return 'bg-sky-500/15 text-sky-200 border-sky-400/35';
  return 'bg-white/10 text-slate-200 border-white/15';
}

function getTokenColorForType(creatureType) {
  const t = normalizeQuery(creatureType);
  if (t.includes('dragao')) return '#dc2626';
  if (t.includes('morto')) return '#8b5cf6';
  if (t.includes('corruptor')) return '#b91c1c';
  if (t.includes('celestial')) return '#f59e0b';
  if (t.includes('elemental')) return '#0ea5e9';
  if (t.includes('feerico') || t.includes('planta')) return '#10b981';
  if (t.includes('aberracao') || t.includes('limo')) return '#a855f7';
  if (t.includes('constructo')) return '#94a3b8';
  if (t.includes('gigante')) return '#ea580c';
  if (t.includes('humanoide')) return '#6366f1';
  if (t.includes('fera')) return '#84cc16';
  return '#ef4444';
}

function compressCustomTokenImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecione uma imagem válida (PNG, JPG ou WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const size = 224;
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const minSide = Math.min(srcW, srcH);
        const sx = Math.floor((srcW - minSide) / 2);
        const sy = Math.floor((srcH - minSide) / 2);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        let q = 0.84;
        let out = canvas.toDataURL('image/webp', q);
        if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', q);
        while (out.length > 72000 && q > 0.4) {
          q -= 0.08;
          out = out.startsWith('data:image/webp')
            ? canvas.toDataURL('image/webp', q)
            : canvas.toDataURL('image/jpeg', q);
        }
        resolve(out);
      };
      img.onerror = () => reject(new Error('Falha ao processar imagem.'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

function StatSectionBlock({ title, entries }) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 border-b border-white/12 pb-1 flex items-center gap-1.5">
        <Sword className="h-3.5 w-3.5 text-slate-300" />
        {title}
      </h4>
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div
            key={`${title}-${idx}`}
            className="rounded-xl bg-white/[0.03] border border-white/10 p-3 text-xs leading-relaxed text-slate-200"
          >
            {entry.name && (
              <span className="font-extrabold text-white italic mr-1.5">{entry.name}.</span>
            )}
            <span className="text-slate-300">{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Modal de Estatísticas Completas do Monstro (Livro dos Monstros) + Botão "Adicionar ao Campo"
 */
export function MonsterStatDetailModal({
  monster,
  open,
  onOpenChange,
  onAddToMap,
  canAddToMap = true,
  spawning = false,
  onBackToList,
}) {
  const [customName, setCustomName] = useState('');
  const [spawnCount, setSpawnCount] = useState(1);
  const [spawnMoveLimit, setSpawnMoveLimit] = useState(9);
  const [startHidden, setStartHidden] = useState(false);
  const [startHiddenName, setStartHiddenName] = useState(true);
  const [startAsAlly, setStartAsAlly] = useState(false);

  useEffect(() => {
    if (monster) {
      setCustomName(monster.name || '');
      setSpawnCount(1);
      setSpawnMoveLimit(9);
      setStartHidden(false);
      setStartHiddenName(true);
      setStartAsAlly(false);
    }
  }, [monster]);

  if (!monster) return null;

  const sizeInfo = TOKEN_SIZES[monster.sizeCode] || TOKEN_SIZES.M;

  const handleConfirmSpawn = async () => {
    if (!onAddToMap || !canAddToMap) return;
    const safeMoveLimit = Math.max(
      0,
      Math.min(200, Math.round((Number(spawnMoveLimit) || 9) * 10) / 10)
    );
    await onAddToMap(monster, {
      name: customName.trim() || monster.name,
      count: Math.max(1, Math.min(10, Number(spawnCount) || 1)),
      hidden: startHidden,
      name_hidden: startHiddenName,
      is_ally: startAsAlly,
      move_limit: safeMoveLimit,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={monster.name}
      description={monster.subtitle || `${monster.creatureType} ${monster.sizeLabel}`}
      maxWidth="max-w-3xl"
      footer={
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {onBackToList && (
              <Button type="button" variant="ghost" size="sm" onClick={onBackToList} className="gap-1.5">
                <ArrowLeft className="h-4 w-4 text-slate-300" />
                Voltar à Lista
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>

          {canAddToMap && onAddToMap && (
            <Button
              type="button"
              onClick={handleConfirmSpawn}
              loading={spawning}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              {Number(spawnCount) > 1
                ? `Adicionar ${spawnCount} ao Campo`
                : 'Adicionar ao Campo'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Cabeçalho Visual: Foto Circular + Metadados Principais */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-[#0c101b] border border-white/12">
          <div
            className="h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden shrink-0 border-2 shadow-2xl bg-[#070a12] flex items-center justify-center relative"
            style={{
              borderColor: getTokenColorForType(monster.creatureType),
              boxShadow: `0 0 24px ${getTokenColorForType(monster.creatureType)}44`,
            }}
          >
            {monster.avatar ? (
              <img
                src={monster.avatar}
                alt={monster.name}
                className="h-full w-full object-cover rounded-full"
              />
            ) : (
              <Skull className="h-10 w-10 text-slate-400" />
            )}
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div>
              <h3 className="text-xl font-black text-white leading-tight">{monster.name}</h3>
              <p className="text-xs text-slate-400 italic mt-0.5">
                {monster.subtitle || `${monster.creatureType} ${monster.sizeLabel}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              <Badge className={cn('font-mono text-[11px]', getCrBadgeTone(monster.crNum))}>
                ND {monster.cr} • {monster.xp} XP
              </Badge>
              <Badge className="bg-white/10 text-slate-200 border-white/15 font-mono text-[11px]">
                BP {monster.pb || '+2'}
              </Badge>
              <Badge className="bg-white/5 text-slate-300 border-white/10 text-[11px]">
                {monster.creatureType}
              </Badge>
              <Badge className="bg-white/5 text-slate-300 border-white/10 text-[11px]">
                {sizeInfo.label}
              </Badge>
              {monster.bookPage && (
                <Badge className="bg-white/5 text-slate-400 border-white/10 font-mono text-[10px]">
                  <BookOpen className="h-3 w-3 text-slate-300" /> p. {monster.bookPage}
                </Badge>
              )}
            </div>

            {(monster.habitat || monster.treasure) && (
              <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1">
                {monster.habitat && (
                  <span>
                    <strong className="text-slate-300">Habitat:</strong> {monster.habitat}
                  </span>
                )}
                {monster.treasure && (
                  <span>
                    <strong className="text-slate-300">Tesouro:</strong> {monster.treasure}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Destaques de Combate: CA, PV, Iniciativa, Deslocamento */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-blue-400" /> Armadura
            </div>
            <div className="text-lg font-black font-mono text-white mt-0.5">{monster.ac} CA</div>
          </div>

          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-rose-400" /> Pontos de Vida
            </div>
            <div className="text-lg font-black font-mono text-white mt-0.5">{monster.hp}</div>
            {monster.hpFormula && (
              <div className="text-[10px] font-mono text-slate-400 truncate">({monster.hpFormula})</div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Iniciativa
            </div>
            <div className="text-base font-black font-mono text-white mt-0.5">
              {monster.initiative || '+0 (10)'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              <Footprints className="h-3.5 w-3.5 text-slate-300" /> Deslocamento
            </div>
            <div className="text-xs font-bold text-white mt-1 leading-snug">
              {monster.speed || '9 m'}
            </div>
          </div>
        </div>

        {/* Grade de 6 Atributos (Valor / MOD / SALV) */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ABILITY_META.map(({ key, label }) => {
            const ab = monster.abilities?.[key] || { score: 10, mod: '+0', save: '+0' };
            return (
              <div
                key={key}
                className="rounded-xl bg-[#0c101b] border border-white/12 p-2.5 text-center space-y-1"
              >
                <div className="text-[10px] font-black tracking-wider text-slate-400">{label}</div>
                <div className="text-lg font-black font-mono text-white leading-none">{ab.score}</div>
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono pt-0.5 border-t border-white/10">
                  <span className="text-slate-300" title="Modificador">
                    {ab.mod}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span
                    className={cn(
                      ab.save !== ab.mod ? 'text-emerald-300 font-bold' : 'text-slate-400'
                    )}
                    title="Salvaguarda"
                  >
                    {ab.save}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalhes de Defesas, Sentidos, Perícias e Idiomas */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3.5 space-y-1.5 text-xs">
          {monster.skills && (
            <div>
              <span className="font-bold text-white">Perícias: </span>
              <span className="text-slate-300">{monster.skills}</span>
            </div>
          )}
          {monster.vulnerabilities && (
            <div>
              <span className="font-bold text-amber-300">Vulnerabilidades: </span>
              <span className="text-slate-300">{monster.vulnerabilities}</span>
            </div>
          )}
          {monster.resistances && (
            <div>
              <span className="font-bold text-sky-300">Resistências: </span>
              <span className="text-slate-300">{monster.resistances}</span>
            </div>
          )}
          {monster.immunities && (
            <div>
              <span className="font-bold text-emerald-300">Imunidades: </span>
              <span className="text-slate-300">{monster.immunities}</span>
            </div>
          )}
          {monster.gear && (
            <div>
              <span className="font-bold text-white">Equipamento: </span>
              <span className="text-slate-300">{monster.gear}</span>
            </div>
          )}
          {monster.senses && (
            <div>
              <span className="font-bold text-white">Sentidos: </span>
              <span className="text-slate-300">{monster.senses}</span>
            </div>
          )}
          <div>
            <span className="font-bold text-white">Idiomas: </span>
            <span className="text-slate-300">{monster.languages || 'Nenhum'}</span>
          </div>
        </div>

        {/* Traços, Ações, Ações Bônus, Reações e Ações Lendárias */}
        <div className="space-y-4">
          <StatSectionBlock title="Traços" entries={monster.traits} />
          <StatSectionBlock title="Ações" entries={monster.actions} />
          <StatSectionBlock title="Ações Bônus" entries={monster.bonusActions} />
          <StatSectionBlock title="Reações" entries={monster.reactions} />
          <StatSectionBlock title="Ações Lendárias" entries={monster.legendaryActions} />
        </div>

        {/* Opções Rápidas de Posicionamento no Campo */}
        {canAddToMap && onAddToMap && (
          <div className="rounded-2xl bg-[#0c101b] border border-white/15 p-3.5 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-slate-300" />
              Opções ao Adicionar no Campo
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="col-span-2">
                <FormField label="Nome do Token no Mapa">
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={monster.name}
                    maxLength={80}
                  />
                </FormField>
              </div>
              <FormField label="Quantidade">
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={spawnCount}
                  onChange={(e) => setSpawnCount(e.target.value)}
                />
              </FormField>
              <FormField label="Deslocamento (m)">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="200"
                  value={spawnMoveLimit}
                  onChange={(e) => setSpawnMoveLimit(e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStartHidden((v) => !v)}
                className={cn(
                  'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all',
                  startHidden
                    ? 'bg-violet-500/15 border-violet-400/45 text-violet-100'
                    : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                )}
              >
                {startHidden ? (
                  <EyeOff className="h-4 w-4 text-violet-300 shrink-0" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-300 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">
                    {startHidden ? 'Oculto p/ Jogadores' : 'Visível no Mapa'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {startHidden
                      ? 'Fora do mapa e dos turnos'
                      : 'Aparece quando no campo de visão'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStartHiddenName((v) => !v)}
                className={cn(
                  'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all',
                  startHiddenName
                    ? 'bg-amber-500/10 border-amber-400/35 text-amber-100'
                    : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                )}
              >
                {startHiddenName ? (
                  <EyeOff className="h-4 w-4 text-amber-300 shrink-0" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-300 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">
                    {startHiddenName ? 'Nome Oculto' : 'Nome Visível'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {startHiddenName ? 'Entra como "???"' : 'Jogadores veem o nome'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStartAsAlly((v) => !v)}
                className={cn(
                  'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all',
                  startAsAlly
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                    : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                )}
              >
                {startAsAlly ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" />
                ) : (
                  <Users className="h-4 w-4 text-slate-300 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">
                    {startAsAlly ? 'Iniciar como Aliado' : 'Iniciar como Inimigo'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {startAsAlly ? 'Barra de vida visível' : 'Vida oculta p/ jogadores'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Modal Principal "+ Monstro / NPC": Bestiário Alfabético Completo do Livro + Criação de NPC Personalizado
 */
export function MonsterBestiaryModal({
  open,
  onOpenChange,
  onSpawnToken,
  hasActiveMap = true,
}) {
  const [activeTab, setActiveTab] = useState('bestiary'); // 'bestiary' | 'custom'
  const [monsters, setMonsters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Filtros do Bestiário
  const [search, setSearch] = useState('');
  const [selectedLetter, setSelectedLetter] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedCrRange, setSelectedCrRange] = useState('ALL');
  const [visibleLimit, setVisibleLimit] = useState(60);
  const sentinelRef = useRef(null);

  // Monstro selecionado para abrir a modal de estatísticas do livro
  const [detailMonster, setDetailMonster] = useState(null);
  const [spawning, setSpawning] = useState(false);

  // Formulário de NPC / Monstro Personalizado
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('npc');
  const [customSize, setCustomSize] = useState('M');
  const [customHp, setCustomHp] = useState(30);
  const [customAc, setCustomAc] = useState(14);
  const [customMana, setCustomMana] = useState(0);
  const [customMoveLimit, setCustomMoveLimit] = useState(9);
  const [customColor, setCustomColor] = useState('#ef4444');
  const [customAvatar, setCustomAvatar] = useState('');
  const [customHidden, setCustomHidden] = useState(false);
  const [customIsAlly, setCustomIsAlly] = useState(false);
  const [customNameHidden, setCustomNameHidden] = useState(true);
  const [compressingAvatar, setCompressingAvatar] = useState(false);
  const customFileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setLoadError('');
    loadMonstersCatalog()
      .then((list) => {
        if (alive) setMonsters(list);
      })
      .catch((err) => {
        if (alive) setLoadError(err?.message || 'Erro ao carregar bestiário.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  // Tipos únicos de criatura disponíveis no livro
  const creatureTypes = useMemo(() => {
    const set = new Set();
    for (const m of monsters) {
      if (m.creatureType) set.add(m.creatureType);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [monsters]);

  // Letras disponíveis no catálogo
  const availableLetters = useMemo(() => {
    const set = new Set();
    for (const m of monsters) set.add(normalizeLetter(m.name));
    return set;
  }, [monsters]);

  // Lista filtrada e estritamente em ordem alfabética PT-BR
  const filteredMonsters = useMemo(() => {
    const q = normalizeQuery(search);
    return monsters.filter((m) => {
      if (selectedLetter !== 'ALL' && normalizeLetter(m.name) !== selectedLetter) return false;
      if (selectedType !== 'ALL' && m.creatureType !== selectedType) return false;
      if (selectedCrRange !== 'ALL') {
        const [minCr, maxCr] = selectedCrRange.split('-').map(Number);
        const n = Number(m.crNum) || 0;
        if (n < minCr || n > maxCr) return false;
      }
      if (q) {
        const hay = `${m.name} ${m.creatureType} ${m.habitat || ''} nd ${m.cr}`;
        if (!normalizeQuery(hay).includes(q)) return false;
      }
      return true;
    });
  }, [monsters, search, selectedLetter, selectedType, selectedCrRange]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleLimit(60);
  }, [search, selectedLetter, selectedType, selectedCrRange, open]);

  // Infinite scroll suave dentro da lista do bestiário
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleLimit >= filteredMonsters.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleLimit((prev) => Math.min(filteredMonsters.length, prev + 60));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleLimit, filteredMonsters.length]);

  const visibleMonsters = useMemo(
    () => filteredMonsters.slice(0, visibleLimit),
    [filteredMonsters, visibleLimit]
  );

  // Adicionar monstro do livro ao campo
  const handleAddBookMonster = async (monster, opts) => {
    if (!onSpawnToken || !hasActiveMap) return;
    const count = Math.max(1, Math.min(10, Number(opts?.count) || 1));
    const baseName = opts?.name || monster.name;
    setSpawning(true);
    try {
      for (let i = 0; i < count; i++) {
        const angle = (i / Math.max(1, count)) * Math.PI * 2;
        const radius = count === 1 ? 0 : 4.5;
        const offsetX = count === 1 ? (Math.random() * 8 - 4) : Math.cos(angle) * radius;
        const offsetY = count === 1 ? (Math.random() * 8 - 4) : Math.sin(angle) * radius;
        await onSpawnToken({
          name: count > 1 ? `${baseName} #${i + 1}` : baseName,
          type: 'monster',
          color: getTokenColorForType(monster.creatureType),
          avatar: monster.avatar || null,
          size: monster.sizeCode || 'M',
          hp: Number(monster.hp) || 10,
          max_hp: Number(monster.hp) || 10,
          ac: Number(monster.ac) || 10,
          mana: 0,
          max_mana: 0,
          conditions: [],
          initiative: 0,
          hidden: Boolean(opts?.hidden),
          is_ally: Boolean(opts?.is_ally),
          name_hidden: opts?.name_hidden !== undefined ? Boolean(opts.name_hidden) : true,
          monster_id: monster.id,
          move_limit:
            opts?.move_limit !== undefined && Number.isFinite(Number(opts.move_limit))
              ? Math.max(0, Math.min(200, Math.round(Number(opts.move_limit) * 10) / 10))
              : 9,
          move_used: 0,
          x: Math.max(5, Math.min(95, 50 + offsetX)),
          y: Math.max(5, Math.min(95, 45 + offsetY)),
        });
      }
      toast.success(
        count > 1
          ? `${count}x "${baseName}" posicionados no campo${opts?.hidden ? ' (ocultos)' : ''}!`
          : `"${baseName}" posicionado no campo${opts?.hidden ? ' (oculto)' : ''}!`
      );
      setDetailMonster(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao adicionar criatura ao campo.');
    } finally {
      setSpawning(false);
    }
  };

  // Upload de imagem para NPC personalizado
  const handleCustomAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingAvatar(true);
    try {
      const dataUrl = await compressCustomTokenImage(file);
      setCustomAvatar(dataUrl);
      toast.success('Foto circular carregada!');
    } catch (err) {
      toast.error(err?.message || 'Erro ao processar foto.');
    } finally {
      setCompressingAvatar(false);
      if (customFileRef.current) customFileRef.current.value = '';
    }
  };

  const handleSpawnCustom = async (e) => {
    e.preventDefault();
    if (!onSpawnToken || !hasActiveMap) return;
    if (!customName.trim()) {
      toast.error('Informe o nome do monstro ou NPC.');
      return;
    }
    setSpawning(true);
    try {
      await onSpawnToken({
        name: customName.trim(),
        type: customType,
        color: customColor,
        avatar: customAvatar || null,
        size: customSize,
        hp: Math.max(1, Number(customHp) || 20),
        max_hp: Math.max(1, Number(customHp) || 20),
        ac: Math.max(0, Number(customAc) || 12),
        mana: Math.max(0, Number(customMana) || 0),
        max_mana: Math.max(0, Number(customMana) || 0),
        conditions: [],
        initiative: 0,
        hidden: customHidden,
        is_ally: customIsAlly,
        name_hidden: customNameHidden,
        monster_id: null,
        move_limit: Math.max(0, Math.min(200, Math.round((Number(customMoveLimit) || 9) * 10) / 10)),
        move_used: 0,
        x: 45 + (Math.random() * 10 - 5),
        y: 40 + (Math.random() * 10 - 5),
      });
      toast.success(
        `"${customName.trim()}" posicionado no campo${customHidden ? ' (oculto)' : ''}!`
      );
      setCustomName('');
      setCustomAvatar('');
      setCustomHidden(false);
      setCustomMoveLimit(9);
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao posicionar token.');
    } finally {
      setSpawning(false);
    }
  };

  return (
    <>
      <Modal
        open={open && !detailMonster}
        onOpenChange={onOpenChange}
        title="Livro dos Monstros & NPCs"
        description={
          monsters.length > 0
            ? `${monsters.length} criaturas oficiais em ordem alfabética. Clique em um monstro para ver as estatísticas completas e adicionar ao campo.`
            : 'Escolha um monstro do livro ou crie um NPC personalizado.'
        }
        maxWidth="max-w-4xl"
      >
        <div className="space-y-3.5">
          {/* Seletor de Aba: Bestiário Oficial vs NPC / Personalizado */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('bestiary')}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                activeTab === 'bestiary'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <BookOpen className="h-3.5 w-3.5 text-slate-300" />
              Livro dos Monstros ({monsters.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                activeTab === 'custom'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <UserPlus className="h-3.5 w-3.5 text-slate-300" />
              Monstro / NPC Personalizado
            </button>
          </div>

          {activeTab === 'bestiary' ? (
            <div className="space-y-3">
              {/* Barra de Busca e Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <Input
                    icon={Search}
                    placeholder="Buscar monstro por nome, tipo ou habitat..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Buscar monstro"
                    className="h-10"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Select
                    aria-label="Filtrar por tipo de criatura"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="h-10 text-xs"
                  >
                    <option value="ALL">Todos os Tipos</option>
                    {creatureTypes.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <Select
                    aria-label="Filtrar por Nível de Desafio"
                    value={selectedCrRange}
                    onChange={(e) => setSelectedCrRange(e.target.value)}
                    className="h-10 text-xs"
                  >
                    {CR_FILTERS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Índice Alfabético Rápido (A–Z) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setSelectedLetter('ALL')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shrink-0',
                    selectedLetter === 'ALL'
                      ? 'bg-white/15 text-white border-white/25'
                      : 'bg-white/[0.03] text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
                  )}
                >
                  Todos
                </button>
                {ALPHABET.map((letter) => {
                  const enabled = availableLetters.has(letter);
                  const active = selectedLetter === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!enabled}
                      onClick={() => setSelectedLetter(active ? 'ALL' : letter)}
                      className={cn(
                        'h-7 w-7 rounded-lg text-[11px] font-mono font-bold border transition-all shrink-0 flex items-center justify-center',
                        active
                          ? 'bg-white/15 text-white border-white/30'
                          : enabled
                          ? 'bg-white/[0.03] text-slate-300 border-white/10 hover:text-white hover:bg-white/10'
                          : 'bg-transparent text-slate-700 border-transparent cursor-not-allowed'
                      )}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              {/* Contador de Resultados */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>
                  Exibindo <strong className="text-white">{filteredMonsters.length}</strong> de{' '}
                  {monsters.length} criaturas (ordem alfabética A–Z)
                </span>
                {(search || selectedLetter !== 'ALL' || selectedType !== 'ALL' || selectedCrRange !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSelectedLetter('ALL');
                      setSelectedType('ALL');
                      setSelectedCrRange('ALL');
                    }}
                    className="text-slate-300 hover:text-white underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Lista / Grade Alfabética de Monstros com Foto Circular */}
              {loading ? (
                <div className="py-14 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                  <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span>Carregando o Livro dos Monstros...</span>
                </div>
              ) : loadError ? (
                <div className="py-12 text-center text-xs text-rose-300">{loadError}</div>
              ) : filteredMonsters.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Nenhuma criatura encontrada com os filtros atuais.
                </div>
              ) : (
                <div className="max-h-[52vh] overflow-y-auto pr-1 scrollbar-thin">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {visibleMonsters.map((monster) => {
                      const ringColor = getTokenColorForType(monster.creatureType);
                      return (
                        <button
                          key={monster.id}
                          type="button"
                          onClick={() => setDetailMonster(monster)}
                          className="group flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/10 border border-white/10 hover:border-white/25 transition-all text-left"
                        >
                          {/* Foto Circular do Monstro (mesmo avatar do token no campo) */}
                          <div
                            className="h-12 w-12 rounded-full overflow-hidden shrink-0 border-2 bg-[#0c101b] flex items-center justify-center transition-transform group-hover:scale-105"
                            style={{ borderColor: `${ringColor}aa` }}
                          >
                            {monster.avatar ? (
                              <img
                                src={monster.avatar}
                                alt={monster.name}
                                loading="lazy"
                                className="h-full w-full object-cover rounded-full"
                              />
                            ) : (
                              <Skull className="h-5 w-5 text-slate-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="text-xs font-extrabold text-white truncate leading-snug">
                              {monster.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {monster.creatureType} • {monster.sizeLabel}
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span
                                className={cn(
                                  'px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border',
                                  getCrBadgeTone(monster.crNum)
                                )}
                              >
                                ND {monster.cr}
                              </span>
                              <span className="text-[10px] font-mono text-rose-300">
                                {monster.hp} PV
                              </span>
                              <span className="text-[10px] font-mono text-sky-300">
                                {monster.ac} CA
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {visibleLimit < filteredMonsters.length && (
                    <div ref={sentinelRef} className="py-4 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setVisibleLimit((prev) => Math.min(filteredMonsters.length, prev + 80))
                        }
                        className="text-xs"
                      >
                        Carregar mais criaturas ({filteredMonsters.length - visibleLimit} restantes)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ABA 2: CRIAR MONSTRO / NPC PERSONALIZADO */
            <form onSubmit={handleSpawnCustom} className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div
                  className="h-20 w-20 rounded-full overflow-hidden shrink-0 border-2 bg-[#0c101b] flex items-center justify-center"
                  style={{ borderColor: customColor }}
                >
                  {customAvatar ? (
                    <img
                      src={customAvatar}
                      alt={customName || 'Token'}
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-lg font-black text-white">
                      {(customName || 'NP').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="text-xs font-bold text-white">Foto Circular do Token (Opcional)</div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <input
                      ref={customFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={handleCustomAvatarUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={compressingAvatar}
                      onClick={() => customFileRef.current?.click()}
                      className="text-xs gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5 text-slate-300" />
                      Subir Foto
                    </Button>
                    {customAvatar && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setCustomAvatar('')}
                        className="text-xs text-rose-300"
                      >
                        <X className="h-3.5 w-3.5" />
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Nome do Monstro / NPC" required>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ex: Guarda da Taverna ou Chefe Bandido"
                    maxLength={80}
                  />
                </FormField>

                <FormField label="Tipo de Token">
                  <Select value={customType} onChange={(e) => setCustomType(e.target.value)}>
                    <option value="monster">Monstro</option>
                    <option value="npc">NPC</option>
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <FormField label="Vida (PV)">
                  <Input
                    type="number"
                    min="1"
                    value={customHp}
                    onChange={(e) => setCustomHp(e.target.value)}
                  />
                </FormField>
                <FormField label="Armadura (CA)">
                  <Input
                    type="number"
                    min="0"
                    value={customAc}
                    onChange={(e) => setCustomAc(e.target.value)}
                  />
                </FormField>
                <FormField label="Mana">
                  <Input
                    type="number"
                    min="0"
                    value={customMana}
                    onChange={(e) => setCustomMana(e.target.value)}
                  />
                </FormField>
                <FormField label="Desloc. (m)">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="200"
                    value={customMoveLimit}
                    onChange={(e) => setCustomMoveLimit(e.target.value)}
                  />
                </FormField>
                <FormField label="Tamanho">
                  <Select value={customSize} onChange={(e) => setCustomSize(e.target.value)}>
                    {Object.entries(TOKEN_SIZES).map(([k, cfg]) => (
                      <option key={k} value={k}>
                        {cfg.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCustomHidden((v) => !v)}
                  className={cn(
                    'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all',
                    customHidden
                      ? 'bg-violet-500/15 border-violet-400/45 text-violet-100'
                      : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                  )}
                >
                  {customHidden ? (
                    <EyeOff className="h-4 w-4 text-violet-300 shrink-0" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-300 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">
                      {customHidden ? 'Oculto p/ Jogadores' : 'Visível no Mapa'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {customHidden
                        ? 'Fora do mapa e dos turnos'
                        : 'Aparece quando visível'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomNameHidden((v) => !v)}
                  className={cn(
                    'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all',
                    customNameHidden
                      ? 'bg-amber-500/10 border-amber-400/35 text-amber-100'
                      : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                  )}
                >
                  {customNameHidden ? (
                    <EyeOff className="h-4 w-4 text-amber-300 shrink-0" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-300 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">
                      {customNameHidden ? 'Nome Oculto' : 'Nome Visível'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {customNameHidden ? 'Entra como "???"' : 'Jogadores veem o nome'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomIsAlly((v) => !v)}
                  className={cn(
                    'p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all',
                    customIsAlly
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                      : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                  )}
                >
                  {customIsAlly ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" />
                  ) : (
                    <Users className="h-4 w-4 text-slate-300 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">
                      {customIsAlly ? 'Marcar como Aliado' : 'Iniciar como Inimigo'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {customIsAlly ? 'Barra de vida visível' : 'Vida oculta p/ jogadores'}
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={spawning} disabled={!hasActiveMap} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Adicionar ao Campo
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Modal de Estatísticas Completas do Monstro Selecionado + Botão Adicionar ao Campo */}
      <MonsterStatDetailModal
        monster={detailMonster}
        open={Boolean(detailMonster)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDetailMonster(null);
        }}
        onAddToMap={handleAddBookMonster}
        canAddToMap={hasActiveMap}
        spawning={spawning}
        onBackToList={() => setDetailMonster(null)}
      />
    </>
  );
}
