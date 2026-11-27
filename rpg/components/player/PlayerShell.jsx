'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  Crown,
  Dices,
  Link2,
  LogOut,
  Pencil,
  Shield,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import {
  GiBackpack,
  GiCoinsPile,
  GiScrollUnfurled,
  GiSwapBag,
  GiTreasureMap,
} from 'react-icons/gi';
import { toast } from 'sonner';
import Logo from '../../app/components/Logo';
import { getRankMeta, getXpProgress } from '../../lib/constants';
import { updateHeroProfile } from '../../lib/rpg-service';
import {
  MAX_AVATAR_UPLOAD_BYTES,
  sanitizeMediaUrl,
  validateSafeImageDimensions,
  validateSafeImageFile,
} from '../../lib/upload-security';
import { cn, formatNumber } from '../../lib/utils';
import { Badge, RankBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField, Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { UserAvatar } from '../ui/UserAvatar';
import { TabletopMusicTriggerButton } from '../music/TabletopMusicWidget';
import { PlayerImmersionBar } from '../tabletop/TabletopImmersionModals';

// Comprime e recorta (quadrado central) a imagem de perfil em formato circular-ready (< 75 KB)
// com proteção contra Zip Bomb, SVG/XSS e Image Decompression Bomb.
async function compressAvatarFile(file) {
  await validateSafeImageFile(file, { maxBytes: MAX_AVATAR_UPLOAD_BYTES });
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const dimCheck = validateSafeImageDimensions(srcW, srcH, file.size);
        if (!dimCheck.ok) {
          reject(new Error(dimCheck.reason));
          return;
        }
        const size = 256;
        const minSide = Math.min(srcW, srcH);
        const sx = Math.floor((srcW - minSide) / 2);
        const sy = Math.floor((srcH - minSide) / 2);

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        while (dataUrl.length > 72000 && quality > 0.4) {
          quality -= 0.08;
          dataUrl = dataUrl.startsWith('data:image/webp')
            ? canvas.toDataURL('image/webp', quality)
            : canvas.toDataURL('image/jpeg', quality);
        }
        canvas.width = 0;
        canvas.height = 0;
        resolve(dataUrl);
      } catch {
        reject(new Error('Falha ao processar a imagem selecionada.'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Falha ao processar a imagem selecionada.'));
    };
    img.src = objectUrl;
  });
}

const TABS = [
  { id: 'map', label: 'Mesa & Mapa', icon: GiTreasureMap },
  { id: 'missions', label: 'Mural', icon: GiScrollUnfurled },
  { id: 'shop', label: 'Loja', icon: GiSwapBag },
  { id: 'players', label: 'Aliados', icon: Users },
  { id: 'inv', label: 'Personagem', icon: GiBackpack },
];

export function PlayerShell({
  profile,
  myParty,
  activeTab,
  onSelectTab,
  pendingTradesCount = 0,
  commandItems = [],
  onRequestSpin,
  requestingSpin = false,
  onOpenRoulette,
  onLogout,
  children,
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhotoURL, setNewPhotoURL] = useState('');
  const [showPhotoUrlInput, setShowPhotoUrlInput] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const avatarFileInputRef = useRef(null);

  const xpData = getXpProgress(profile?.level, profile?.xp);
  const rankMeta = getRankMeta(profile?.rank);
  const isPartyLeader = Boolean(myParty && myParty.leader_id === profile?.uid);
  const isMapTab = activeTab === 'map';
  const gachaGiftsCount = (profile?.inventory || [])
    .filter((i) => i.name === 'Gacha Gift')
    .reduce((acc, i) => acc + (Number(i.qty) || 1), 0);

  const openRenameModal = () => {
    setNewName(profile?.username || '');
    setNewPhotoURL(profile?.photoURL || '');
    setShowPhotoUrlInput(false);
    setRenameOpen(true);
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await compressAvatarFile(file);
      setNewPhotoURL(dataUrl);
      toast.success('Foto carregada! Clique em "Salvar Perfil" para aplicar.');
    } catch (err) {
      toast.error(err?.message || 'Erro ao processar imagem.');
    } finally {
      setUploadingPhoto(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Informe um nome válido.');
      return;
    }
    setRenaming(true);
    try {
      const trimmedPhoto = newPhotoURL ? newPhotoURL.trim() : '';
      const safePhoto = trimmedPhoto ? sanitizeMediaUrl(trimmedPhoto) : null;
      if (trimmedPhoto && !safePhoto) {
        toast.error('URL de imagem inválida ou bloqueada por segurança. Use HTTPS ou envie uma imagem.');
        setRenaming(false);
        return;
      }
      await updateHeroProfile(profile.uid, {
        username: newName,
        photoURL: safePhoto,
      });
      toast.success('Perfil do personagem atualizado!');
      setRenameOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao atualizar perfil.');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div
      className={cn(
        'realm-backdrop flex flex-col',
        isMapTab ? 'h-[100dvh] overflow-hidden' : 'min-h-screen pb-20 md:pb-6'
      )}
    >
      {/* Top Navbar — Always full-width spread across all Player sections (matching Map view) */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-[#080a11]/90 backdrop-blur-2xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.75)]">
        <div className="w-full max-w-none mx-auto px-3 sm:px-5 xl:px-8 h-14 xl:h-16 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 lg:gap-5 min-w-0">
            <Logo size={32} subtitle="Guilda" />

            {/* Desktop / Notebook Navigation Tabs */}
            <nav
              className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07]"
              aria-label="Navegação Principal"
            >
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                const showBadge = t.id === 'players' && pendingTradesCount > 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTab(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-lg text-xs lg:text-sm font-semibold transition-all relative whitespace-nowrap',
                      active
                        ? 'bg-white/12 text-white border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                    )}
                  >
                    <Icon
                      className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-slate-300 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{t.label}</span>
                    {showBadge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500 text-slate-950">
                        {pendingTradesCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PlayerImmersionBar />
            <TabletopMusicTriggerButton />
            <ThemeSwitcher className="hidden sm:inline-flex" />

            {profile?.role === 'master' && (
              <Link href="/master">
                <Button variant="outline" size="sm">
                  <Shield className="h-3.5 w-3.5 text-slate-300" />
                  <span className="hidden sm:inline">Painel Mestre</span>
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onLogout}
              title="Sair da conta"
              aria-label="Sair da conta"
              className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/15"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content: Fullscreen immersive canvas on Map tab; Hero Status HUD + container on other tabs */}
      {isMapTab ? (
        <main className="flex-1 min-h-0 w-full flex flex-col pb-[60px] md:pb-0 overflow-hidden">
          {children}
        </main>
      ) : (
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-5 xl:px-8 pt-4 sm:pt-5 space-y-4 sm:space-y-5">
          <section
            aria-label="Resumo do personagem"
            className="rounded-2xl surface-card relative overflow-hidden transition-all p-4 sm:p-5"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
              {/* Identity */}
              <div className="flex items-center gap-3.5 min-w-0">
                <button
                  type="button"
                  onClick={openRenameModal}
                  aria-label="Editar foto e nome do personagem"
                  title="Alterar foto e nome do personagem"
                  className="group relative rounded-full shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <UserAvatar
                    src={profile?.photoURL}
                    name={profile?.username}
                    className="rounded-full shrink-0 h-12 w-12 sm:h-14 sm:w-14 text-base sm:text-lg"
                    borderColor={`${rankMeta.color}66`}
                  />
                  <span className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="h-4 w-4 text-white" aria-hidden="true" />
                  </span>
                </button>

                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
                      {profile?.username}
                    </h1>
                    <button
                      type="button"
                      onClick={openRenameModal}
                      aria-label="Editar perfil do personagem"
                      title="Alterar nome e foto de perfil"
                      className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {isPartyLeader && (
                      <Badge className="bg-white/[0.06] text-slate-200 border-white/15">
                        <Crown className="h-3 w-3 text-amber-400" /> Líder
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <RankBadge rank={profile?.rank || 'F'} />
                    <Badge className="bg-white/[0.05] text-slate-200 border-white/10 font-mono text-[11px]">
                      LVL {profile?.level || 1}
                    </Badge>
                    {myParty && (
                      <Badge className="bg-emerald-500/12 text-emerald-300 border-emerald-500/25 text-[11px]">
                        {myParty.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats & Quick Action */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 lg:gap-5">
                <div className="flex items-center gap-3.5 sm:gap-4 flex-1">
                  {/* Gold Readout — Clean neutral glass, zero yellow background */}
                  <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 space-y-0.5 shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                      Ouro
                    </span>
                    <div className="flex items-center gap-1.5 text-base sm:text-lg font-extrabold font-mono text-white tabular-nums leading-tight">
                      <GiCoinsPile className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
                      <span>{formatNumber(profile?.gold || 0)}</span>
                      <span className="text-xs font-semibold text-slate-400">G</span>
                    </div>
                  </div>

                  {/* Experience Progress — Clean typography, zero lightning icon */}
                  <div className="flex-1 sm:w-48 xl:w-56 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-400 font-semibold tracking-wide">
                        Experiência
                      </span>
                      <span className="font-mono text-slate-200 tabular-nums">
                        {xpData.text}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(xpData.percent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Progresso de experiência"
                      className="h-2 w-full rounded-full bg-[#090c14] border border-white/10 overflow-hidden"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-slate-300 via-white to-slate-100 shadow-[0_0_10px_rgba(255,255,255,0.25)] transition-all duration-500"
                        style={{ width: `${xpData.percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onOpenRoulette || onRequestSpin}
                  className="border-white/15 hover:border-white/25 hover:bg-white/10 whitespace-nowrap shrink-0 h-10 px-3.5"
                  title="Girar a Roleta de Runas Arcanas"
                >
                  <Dices className="h-4 w-4 text-slate-300" aria-hidden="true" />
                  <span>Roleta Arcana</span>
                  {gachaGiftsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/15 text-white border border-white/20">
                      {gachaGiftsCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </section>

          {/* Active Tab Content */}
          <main>{children}</main>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navegação Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--surface-1)]/95 backdrop-blur-xl px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] grid grid-cols-5 gap-1"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          const showBadge = t.id === 'players' && pendingTradesCount > 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[44px] rounded-xl text-[10px] sm:text-[11px] font-semibold transition-colors relative touch-manipulation',
                active ? 'text-white bg-white/10' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Icon
                className="h-4 w-4 text-slate-300 shrink-0"
                aria-hidden="true"
              />
              <span className="truncate max-w-full px-0.5">{t.label}</span>
              {showBadge && (
                <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Edit Profile (Name + Circular Photo) Modal */}
      <Modal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Perfil do Personagem"
        description="Personalize a foto circular e o nome como outros aventureiros e o Mestre verão você."
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="rename-hero-form" loading={renaming}>
              Salvar Perfil
            </Button>
          </>
        }
      >
        <form id="rename-hero-form" onSubmit={handleRename} className="space-y-4">
          {/* Circular Avatar Preview + Upload Controls */}
          <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="relative group">
              <UserAvatar
                src={newPhotoURL || null}
                name={newName || profile?.username || 'Aventureiro'}
                className="h-24 w-24 rounded-full text-2xl border-2 border-white/20 shadow-xl"
              />
              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={uploadingPhoto}
                title="Escolher nova foto de perfil"
                aria-label="Escolher nova foto de perfil"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[#0c101b] border border-white/25 hover:bg-white/15 text-slate-200 hover:text-white flex items-center justify-center shadow-lg transition-colors"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
              onChange={handleAvatarFileChange}
              className="hidden"
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={uploadingPhoto}
                onClick={() => avatarFileInputRef.current?.click()}
                className="text-xs gap-1.5"
              >
                <Upload className="h-3.5 w-3.5 text-slate-300" />
                Enviar Foto
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowPhotoUrlInput((v) => !v)}
                className="text-xs gap-1.5"
              >
                <Link2 className="h-3.5 w-3.5 text-slate-300" />
                Usar Link
              </Button>

              {newPhotoURL && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setNewPhotoURL('')}
                  className="text-xs gap-1.5 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </Button>
              )}
            </div>

            {showPhotoUrlInput && (
              <div className="w-full pt-1">
                <FormField label="Link da Imagem (URL)" htmlFor="hero-photo-url">
                  <Input
                    id="hero-photo-url"
                    type="url"
                    placeholder="https://exemplo.com/avatar.png"
                    value={newPhotoURL?.startsWith('data:') ? '' : newPhotoURL || ''}
                    onChange={(e) => setNewPhotoURL(e.target.value)}
                  />
                </FormField>
              </div>
            )}

            <p className="text-[11px] text-slate-400 text-center">
              A foto é exibida em formato circular no perfil, aliados e token do mapa.
            </p>
          </div>

          <FormField label="Nome do Herói" htmlFor="hero-rename" required>
            <Input
              id="hero-rename"
              maxLength={40}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
