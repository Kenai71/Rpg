"use client"
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './player.module.css';
import Logo from '../components/Logo'; 
import { 
  User, Shield, ShoppingBag, Scroll, Package, LogOut, 
  RefreshCw, Sparkles, Coins, Gift, Plus, X, Check, Hexagon,
  Shirt, Crown, Hand, Footprints, Gem, Glasses, RectangleHorizontal, Circle
} from 'lucide-react';

const RANK_COLORS = {
  'F': '#9ca3af', 'E': '#4ade80', 'D': '#60a5fa',
  'C': '#a78bfa', 'B': '#f87171', 'A': '#fbbf24', 'S': '#22d3ee'
};

const RARITIES = [
  { name: 'COMUM', color: '#9ca3af', chance: 50 },
  { name: 'INCOMUM', color: '#4ade80', chance: 30 },
  { name: 'RARO', color: '#60a5fa', chance: 15 },
  { name: 'ÉPICO', color: '#a78bfa', chance: 4 },
  { name: 'LENDÁRIO', color: '#fbbf24', chance: 0.9 },
  { name: 'MÍTICO', color: '#ef4444', chance: 0.1 }
];

const XP_TABLE = [
  { lvl: 1, xp: 0 }, { lvl: 2, xp: 300 }, { lvl: 3, xp: 900 }, { lvl: 4, xp: 2700 },
  { lvl: 5, xp: 6500 }, { lvl: 6, xp: 14000 }, { lvl: 7, xp: 23000 }, { lvl: 8, xp: 34000 },
  { lvl: 9, xp: 48000 }, { lvl: 10, xp: 64000 }, { lvl: 11, xp: 85000 }, { lvl: 12, xp: 100000 },
  { lvl: 13, xp: 120000 }, { lvl: 14, xp: 140000 }, { lvl: 15, xp: 165000 }, { lvl: 16, xp: 195000 },
  { lvl: 17, xp: 225000 }, { lvl: 18, xp: 265000 }, { lvl: 19, xp: 305000 }, { lvl: 20, xp: 355000 }
];

const themes = [
    { id: 'purple', color: '#8b5cf6', label: 'Nebula Violet' },
    { id: 'green',  color: '#10b981', label: 'Toxic Emerald' },
    { id: 'blue',   color: '#0ea5e9', label: 'Cyber Sky' },
    { id: 'red',    color: '#ef4444', label: 'Crimson Core' },
];

export default function PlayerPanel() {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState('purple');
  
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [shop, setShop] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [myParty, setMyParty] = useState(null); 
  
  const [tab, setTab] = useState('missions');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);

  const [rouletteState, setRouletteState] = useState('idle'); 
  const [currentRarityDisplay, setCurrentRarityDisplay] = useState(RARITIES[0]);
  const [finalResult, setFinalResult] = useState(null);

  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [selectedItemToBuy, setSelectedItemToBuy] = useState(null);
  const [playerHasRune, setPlayerHasRune] = useState(false);

  const [tooltipData, setTooltipData] = useState(null);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferType, setTransferType] = useState('gold'); 
  const [transferAmount, setTransferAmount] = useState('');
  const [transferItemIdx, setTransferItemIdx] = useState(0);
  const [transferItemQty, setTransferItemQty] = useState(1);

  const [showLevelUp, setShowLevelUp] = useState(false);
  const [leveledUpTo, setLeveledUpTo] = useState(1);
  
  const prevLevelRef = useRef(1);
  const profileRef = useRef(null);

  const RANK_VALUES = { 'F': 0, 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };

  const [draggedItemIdx, setDraggedItemIdx] = useState(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    loadData();
    const channel = supabase.channel('player-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_items' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadData())
      .subscribe();
    const interval = setInterval(loadData, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profRes, missionsRes, shopRes, playersRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('missions').select('*').eq('status', 'open'),
        supabase.from('shop_items').select('*').gt('quantity', 0).order('item_name', { ascending: true }),
        supabase.from('profiles').select('*').eq('role', 'player')
    ]);

    const prof = profRes.data;
    if (prof) {
      if (!prof.equipment) {
          prof.equipment = { face: null, head: null, neck: null, body: null, hands: null, waist: null, feet: null, ring1: null, ring2: null };
      }

      if (prevLevelRef.current === 1 && prof.level > 1 && !profile) prevLevelRef.current = prof.level;
      else if (prof.level > prevLevelRef.current) {
        setLeveledUpTo(prof.level); setShowLevelUp(true); prevLevelRef.current = prof.level;
      }
      if (rouletteState === 'idle') setProfile(prof);
      if (prof.party_id) {
        const { data: party } = await supabase.from('parties').select('*').eq('id', prof.party_id).single();
        setMyParty(party);
      } else setMyParty(null);
    }
    setMissions(missionsRes.data || []);
    setShop(shopRes.data || []);
    setAllPlayers(playersRes.data || []);
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const handleMouseEnter = (e, title, desc, color) => {
    if (!title) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipData({ x: rect.right + 15, y: rect.top, title, desc: cleanDescription(desc), color });
  };
  
  const handleMouseLeave = () => {
    setTooltipData(null); 
  };

  function getRarityFromItem(item) {
    const match = item.description?.match(/<([^>]+)>/);
    if (match) return match[1];
    if (item.name?.includes("Runa")) return item.name.split(" ")[1];
    return "COMUM";
  }

  function getRarityColor(rarityName) {
    const upper = rarityName?.toUpperCase();
    const found = RARITIES.find(r => r.name === upper);
    return found ? found.color : '#fff';
  }

  function cleanDescription(desc) {
    return desc?.replace(/<[^>]+>/, '').trim() || desc || "Sem descrição.";
  }

  function getItemType(item) {
    if (item.type) return item.type;
    const name = item.name.toLowerCase();
    if (name.includes("anel")) return "ring";
    if (name.includes("colar") || name.includes("amuleto") || name.includes("pingente")) return "neck";
    if (name.includes("capacete") || name.includes("elmo") || name.includes("chapéu") || name.includes("coroa")) return "head";
    if (name.includes("armadura") || name.includes("manto") || name.includes("túnica") || name.includes("traje")) return "body";
    if (name.includes("luva") || name.includes("manopla") || name.includes("bracelete")) return "hands";
    if (name.includes("bota") || name.includes("sapato") || name.includes("greva")) return "feet";
    if (name.includes("cinto") || name.includes("faixa") || name.includes("algibeira")) return "waist";
    if (name.includes("óculos") || name.includes("mascara") || name.includes("brinco")) return "face";
    return "consumable";
  }

  // --- DRAG AND DROP (Modificado para bloquear Runas) ---
  const handleDragStart = (e, index) => { 
      const item = profile.inventory[index];
      
      // BLOQUEIO DE RUNA: Se for Runa, não deixa arrastar
      if (item && item.name.includes("Runa")) {
          e.preventDefault();
          return;
      }

      setTooltipData(null);
      setDraggedItemIdx(index); 
      e.dataTransfer.effectAllowed = "move"; 
  };
  
  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = async (e, slotName) => {
    e.preventDefault();
    if (draggedItemIdx === null) return;

    const item = profile.inventory[draggedItemIdx];
    const itemType = getItemType(item);

    let isValid = false;
    if (slotName === 'ring1' || slotName === 'ring2') isValid = (itemType === 'ring');
    else isValid = (itemType === slotName);

    if (!isValid) {
        alert(`Este item (${itemType}) não cabe no slot ${slotName.toUpperCase()}!`);
        setDraggedItemIdx(null);
        return;
    }

    const newInv = [...profile.inventory];
    const newEquip = { ...profile.equipment };
    
    const itemToEquip = newInv[draggedItemIdx];
    if (itemToEquip.qty > 1) {
        newInv[draggedItemIdx].qty--;
        itemToEquip.qty = 1; 
    } else {
        newInv.splice(draggedItemIdx, 1);
    }

    if (newEquip[slotName]) {
        newInv.push(newEquip[slotName]);
    }

    newEquip[slotName] = { ...itemToEquip, qty: 1 };

    setProfile(prev => ({ ...prev, inventory: newInv, equipment: newEquip }));
    await supabase.from('profiles').update({ inventory: newInv, equipment: newEquip }).eq('id', profile.id);
    setDraggedItemIdx(null);
  };

  const handleUnequip = async (slotName) => {
    const item = profile.equipment[slotName];
    if (!item) return;

    const maxSlots = profile.slots || 10;
    if ((profile.inventory?.length || 0) >= maxSlots) {
        return alert("MOCHILA CHEIA! Você não tem espaço para desequipar.");
    }

    const newInv = [...profile.inventory];
    const newEquip = { ...profile.equipment };

    newEquip[slotName] = null;
    
    const existingIdx = newInv.findIndex(i => i.name === item.name);
    if (existingIdx >= 0) newInv[existingIdx].qty++;
    else newInv.push(item);

    setProfile(prev => ({ ...prev, inventory: newInv, equipment: newEquip }));
    await supabase.from('profiles').update({ inventory: newInv, equipment: newEquip }).eq('id', profile.id);
  };

  function openBuyModal(item) {
    const rarity = getRarityFromItem(item);
    const runeName = `Runa ${rarity}`;
    const hasRune = profile.inventory?.some(i => i.name === runeName && i.qty > 0);
    setSelectedItemToBuy(item); setPlayerHasRune(hasRune); setBuyModalOpen(true);
  }

  async function confirmBuy(useRune) {
    if (!selectedItemToBuy) return;
    const item = selectedItemToBuy;
    const inv = [...(profile.inventory || [])];
    const maxSlots = profile.slots || 10;
    const itemIdx = inv.findIndex(i => i.name === item.item_name);
    const isStacking = itemIdx >= 0;

    if (!isStacking && inv.length >= maxSlots) return alert("MOCHILA CHEIA!");

    const itemToSave = { name: item.item_name, qty: 1, description: item.description, type: item.type }; 

    if (useRune) {
      const rarity = getRarityFromItem(item);
      const runeName = `Runa ${rarity}`;
      const runeIdx = inv.findIndex(i => i.name === runeName);
      if (runeIdx === -1 || inv[runeIdx].qty < 1) return alert("Erro: Runa sumiu!");
      if (inv[runeIdx].qty > 1) inv[runeIdx].qty--; else inv.splice(runeIdx, 1);
      if (isStacking) inv[itemIdx].qty++; else inv.push(itemToSave);
      await supabase.from('profiles').update({ inventory: inv }).eq('id', profile.id);
    } else {
      if (profile.gold < item.price) return alert("Ouro insuficiente.");
      if (isStacking) inv[itemIdx].qty++; else inv.push(itemToSave);
      const newGold = profile.gold - item.price;
      await supabase.from('profiles').update({ gold: newGold, inventory: inv }).eq('id', profile.id);
      setProfile(prev => ({...prev, gold: newGold, inventory: inv}));
    }
    const remaining = item.quantity - 1;
    if (remaining > 0) await supabase.from('shop_items').update({ quantity: remaining }).eq('id', item.id);
    else await supabase.from('shop_items').delete().eq('id', item.id);
    setBuyModalOpen(false); loadData();
  }

  async function useGachaGift(index) {
    const currentInv = [...(profile.inventory || [])];
    const giftItem = currentInv[index];
    const maxSlots = profile.slots || 10;
    if (giftItem.qty > 1 && currentInv.length >= maxSlots) return alert("MOCHILA CHEIA! Libere espaço para a Runa.");
    if (giftItem.qty > 1) giftItem.qty -= 1; else currentInv.splice(index, 1);
    setProfile(prev => ({ ...prev, inventory: currentInv }));
    await supabase.from('profiles').update({ inventory: currentInv }).eq('id', profile.id);
    startSpinAnimation();
  }
  async function requestSpin() { await supabase.from('item_requests').insert([{ player_id: profile.id, item_name: "SOLICITACAO_ROLETA", quantity: 1 }]); alert("Solicitação enviada!"); }
  
  function startSpinAnimation() {
    setRouletteState('spinning');
    let speed = 50; let counter = 0; const maxSpins = 30; 
    const rand = Math.random() * 100;
    let accumulated = 0; let resultObj = RARITIES[0];
    for (let r of RARITIES) { accumulated += r.chance; if (rand <= accumulated) { resultObj = r; break; } }
    const spinInterval = () => { setCurrentRarityDisplay(RARITIES[Math.floor(Math.random() * RARITIES.length)]); counter++; if (counter < maxSpins) { speed += 10; setTimeout(spinInterval, speed); } else { finishSpin(resultObj); } };
    spinInterval();
  }
  async function finishSpin(result) {
    setCurrentRarityDisplay(result); setFinalResult(result); setRouletteState('result');
    const currentProf = profileRef.current; if (!currentProf) return;
    const runeName = `Runa ${result.name}`; const newInv = [...currentProf.inventory]; const idx = newInv.findIndex(i => i.name === runeName);
    const runeItem = { name: runeName, qty: 1, description: `<${result.name}> Item mágico usado para trocar por equipamentos desta raridade na loja.` };
    if (idx >= 0) newInv[idx].qty += 1; else newInv.push(runeItem);
    setProfile(prev => ({...prev, inventory: newInv})); await supabase.from('profiles').update({ inventory: newInv }).eq('id', currentProf.id);
  }

  async function acceptMission(mission) { if (!profile) return; const pRank = RANK_VALUES[profile.rank || 'F']; const mRank = RANK_VALUES[mission.rank || 'F']; if (mRank > pRank + 1) return alert("Rank muito baixo."); setMissions(current => current.filter(m => m.id !== mission.id)); await supabase.from('missions').update({ status: 'in_progress', assigned_to: profile.id }).eq('id', mission.id); loadData(); }
  async function requestItem() { if (!newItemName.trim()) return; await supabase.from('item_requests').insert([{ player_id: profile.id, item_name: newItemName, quantity: newItemQty }]); setNewItemName(''); setIsModalOpen(false); }
  async function removeItem(index) { if(!confirm("Jogar fora?")) return; const currentInv = [...profile.inventory]; if (currentInv[index].qty > 1) currentInv[index].qty -= 1; else currentInv.splice(index, 1); setProfile(prev => ({ ...prev, inventory: currentInv })); await supabase.from('profiles').update({ inventory: currentInv }).eq('id', profile.id); }
  function openTransfer(target) { setTransferTarget(target); setTransferType('gold'); setTransferAmount(''); setTransferModalOpen(true); }
  async function handleTransfer() { if (!transferTarget || !profile) return; if (transferType === 'gold') { const amount = Math.floor(Number(transferAmount)); if (amount <= 0 || amount > profile.gold) return alert("Inválido."); setProfile(prev => ({ ...prev, gold: prev.gold - amount })); await supabase.from('profiles').update({ gold: profile.gold - amount }).eq('id', profile.id); const { data: tData } = await supabase.from('profiles').select('gold').eq('id', transferTarget.id).single(); await supabase.from('profiles').update({ gold: (tData.gold || 0) + amount }).eq('id', transferTarget.id); } else { const inv = profile.inventory || []; const itemToGive = inv[transferItemIdx]; const qtd = Math.floor(Number(transferItemQty)); if (!itemToGive || qtd > itemToGive.qty) return alert("Inválido"); await supabase.from('trade_requests').insert({ sender_id: profile.id, receiver_id: transferTarget.id, item_name: itemToGive.name, quantity: qtd }); } setTransferModalOpen(false); }
  const getRankColor = (rank) => RANK_COLORS[rank] || '#ccc';
  const getXpProgress = () => { if (!profile) return { percent: 0, text: '0/0' }; const curr = profile.level || 1; if (curr >= 20) return { percent: 100, text: 'MAX' }; const currData = XP_TABLE.find(l => l.lvl === curr) || { xp: 0 }; const nextData = XP_TABLE.find(l => l.lvl === curr + 1) || { xp: 999999 }; const percent = Math.min(100, Math.max(0, ((profile.xp - currData.xp) / (nextData.xp - currData.xp)) * 100)); return { percent, text: `${profile.xp} / ${nextData.xp}` }; };
  const xpData = getXpProgress();

  // Componente de Slot de Equipamento
  const EquipmentSlot = ({ slot, icon: Icon, label, style }) => {
    const item = profile?.equipment?.[slot];
    const color = item ? getRarityColor(getRarityFromItem(item)) : '#444';
    
    return (
      <div 
        className={`${styles.equipSlot} ${item ? styles.filled : styles.empty}`} 
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, slot)}
        onClick={() => item && handleUnequip(slot)}
        style={{ 
            gridArea: slot, 
            borderColor: item ? color : '#333', 
            boxShadow: item ? `inset 0 0 20px ${color}20` : 'none',
            ...style 
        }}
        onMouseEnter={(e) => item && handleMouseEnter(e, item.name, item.description, color)}
        onMouseLeave={handleMouseLeave}
      >
        {item ? (
           <div style={{color: color, textAlign:'center', width:'100%'}}>
             <Icon size={32} strokeWidth={1.5} />
           </div>
        ) : (
           <div className={styles.slotIcon}>
             <Icon size={24} color="#333" />
             <span className={styles.slotLabel}>{label}</span>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper} data-theme={currentTheme}>
      <div className={styles.themeSwitcher}>
          {themes.map(t => <button key={t.id} className={`${styles.themeDot} ${currentTheme === t.id ? styles.activeDot : ''}`} style={{backgroundColor: t.color}} onClick={() => setCurrentTheme(t.id)} />)}
      </div>

      <div className={styles.container}>
        {profile && (
          <div className={styles.hud}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
              <Logo size={45} showText={false} />
              <div className={styles.charInfo}>
                <h1><User size={32} /> {profile.username}</h1>
                <div className={styles.charDetails}>
                  <span className={styles.tag} style={{color: getRankColor(profile.rank), borderColor: getRankColor(profile.rank)}}>RANK {profile.rank || 'F'}</span>
                  <span className={styles.tag}>LVL {profile.level || 1}</span>
                  {myParty && <span className={styles.tag} style={{borderColor: '#10b981', color: '#10b981'}}>{myParty.name}</span>}
                </div>
              </div>
            </div>
            <div className={styles.hudRight}>
               <button onClick={requestSpin} className={`${styles.btnIcon} ${styles.btnMagic}`}><Sparkles size={16}/> Gift</button>
               <div className={styles.statsGroup}>
                 <div className={styles.goldDisplay}><Coins size={18} color="#fbbf24" /> {profile.gold}</div>
                 <div className={styles.xpContainer} title={xpData.text}><div className={styles.xpFill} style={{width: `${xpData.percent}%`}}></div></div>
                 <span className={styles.xpText}>XP {xpData.text}</span>
               </div>
               <div className={styles.hudActions}>
                 <button onClick={loadData} className={`${styles.btnIcon} ${styles.btnRefresh}`}><RefreshCw size={18}/></button>
                 <button onClick={handleLogout} className={`${styles.btnIcon} ${styles.btnLogout}`}><LogOut size={18}/></button>
               </div>
            </div>
          </div>
        )}

        <nav className={styles.nav}>
          {['missions', 'shop', 'players', 'inv'].map(t => (
             <button key={t} onClick={() => setTab(t)} className={`${styles.navBtn} ${tab === t ? styles.active : ''}`}>{t === 'missions' ? 'Mural' : t === 'shop' ? 'Loja' : t === 'players' ? 'Aliados' : 'Personagem'}</button>
          ))}
        </nav>

        <main className={styles.grid}>
          {tab === 'missions' && missions.map(m => (
                <div key={m.id} className={styles.card} style={{borderLeft:`4px solid ${getRankColor(m.rank)}`}}>
                  <div className={styles.missionHeader}><h3><Scroll size={18}/> {m.title}</h3><span style={{color: getRankColor(m.rank)}}>RANK {m.rank}</span></div>
                  <div style={{fontSize: '0.8rem', color: '#fbbf24', marginBottom:'5px'}}>RECOMPENSA: {m.xp_reward} XP • {m.gold_reward} Ouro</div>
                  <p className={styles.cardDesc}>"{m.desc || m.description}"</p>
                  <button onClick={() => acceptMission(m)} className={styles.btnAction}><Check size={16}/> ACEITAR</button>
                </div>
          ))}

          {tab === 'shop' && shop.map(item => {
                const rarity = getRarityFromItem(item);
                const color = getRarityColor(rarity);
                return (
                  <div key={item.id} className={styles.card} style={{borderColor: `${color}40`}} onMouseEnter={(e) => handleMouseEnter(e, item.item_name, item.description, color)} onMouseLeave={handleMouseLeave}>
                    <div className={styles.cardHeader}><h3 style={{color: color, textShadow: `0 0 10px ${color}40`}}><ShoppingBag size={18}/> {item.name || item.item_name}</h3><span>x{item.quantity}</span></div>
                    <div style={{height: '10px'}}></div> 
                    <button onClick={() => openBuyModal(item)} className={styles.btnAction} style={{background: 'linear-gradient(45deg, #18181b, #27272a)'}}>COMPRAR</button>
                  </div>
                )
          })}

          {tab === 'players' && allPlayers.map(p => (
                 <div key={p.id} className={styles.card} style={{alignItems:'center', textAlign:'center', border: p.id === profile?.id ? '1px solid var(--accent-primary)' : ''}}>
                   <div style={{fontSize:'2.5rem', marginBottom:'10px'}}><Shield size={40} color={getRankColor(p.rank)}/></div>
                   <h3 style={{color:'#fff', margin:0}}>{p.username}</h3>
                   <span style={{color: getRankColor(p.rank), fontSize:'0.8rem', marginTop:'5px'}}>RANK {p.rank}</span>
                   {p.id !== profile?.id && <button onClick={() => openTransfer(p)} className={styles.btnAction} style={{marginTop:'15px'}}><Gift size={16}/> Enviar</button>}
                 </div>
          ))}

          {tab === 'inv' && (
            <div className={styles.invWrapper} style={{gridColumn:'1/-1', display: 'flex', gap: '20px', flexDirection: 'column'}}>
               <div className={styles.equipmentContainer}>
                  <h3 style={{width: '100%', textAlign:'center', color: '#a1a1aa', fontSize:'0.9rem', marginBottom:'10px'}}>EQUIPAMENTO (Arraste para equipar)</h3>
                  
                  {/* GRID DO BONECO MANTIDO */}
                  <div className={styles.paperDoll}>
                      {/* Coluna Esquerda: Anel 1, Mãos, Rosto */}
                      <div className={styles.dollCol}>
                          <EquipmentSlot slot="face" icon={Glasses} label="Rosto" />
                          <EquipmentSlot slot="hands" icon={Hand} label="Mãos" />
                          <EquipmentSlot slot="ring1" icon={Gem} label="Anel 1" />
                      </div>
                      
                      {/* Coluna Meio: Cabeça, Corpo, [Cinto, Pés] */}
                      <div className={styles.dollCol}>
                          <EquipmentSlot slot="head" icon={Crown} label="Cabeça" />
                          <EquipmentSlot slot="body" icon={Shirt} label="Armadura" />
                          
                          {/* LINHA DE BAIXO (CINTURA E PÉS) */}
                          <div style={{ display: 'flex', gap: '15px' }}>
                              <EquipmentSlot slot="waist" icon={RectangleHorizontal} label="Cinto" />
                              <EquipmentSlot slot="feet" icon={Footprints} label="Pés" />
                          </div>
                      </div>

                      {/* Coluna Direita: Anel 2, Pescoço */}
                      <div className={styles.dollCol}>
                          <EquipmentSlot slot="neck" icon={Circle} label="Pescoço" />
                          <EquipmentSlot slot="ring2" icon={Gem} label="Anel 2" />
                      </div>
                  </div>
               </div>

               <div>
                   <div className={styles.invHeader}>
                     <h2 style={{margin:0}}><Package/> Mochila</h2>
                     <span style={{color:'var(--text-muted)'}}>{profile?.inventory?.length || 0} / {profile?.slots || 10}</span>
                   </div>
                   <div className={styles.invGrid}>
                      {[...Array(profile?.slots || 10)].map((_, i) => {
                        const item = profile?.inventory?.[i];
                        
                        // LÓGICA DE DETECÇÃO DE RUNA AQUI
                        let isRune = false;
                        let rarity = "COMUM"; 
                        let color = "#fff";
                        
                        if (item) {
                             if (item.name.includes("Runa")) {
                                isRune = true;
                                rarity = item.name.split(" ")[1];
                             } else if (item.description) {
                                rarity = getRarityFromItem(item);
                             }
                             color = getRarityColor(rarity);
                        }

                        return (
                          <div 
                            key={i} 
                            // AQUI ESTÁ A TRAVA: Se for Rune, draggable = false
                            draggable={!!item && !isRune}
                            onDragStart={(e) => handleDragStart(e, i)}
                            className={`${styles.slot} ${!item ? styles.empty : ''}`} 
                            style={item ? {
                                borderColor: color, 
                                boxShadow:`inset 0 0 10px ${color}20`, 
                                cursor: isRune ? 'not-allowed' : 'grab' // Cursor muda se for Runa
                            } : {}}
                            onMouseEnter={(e) => item && handleMouseEnter(e, item.name, item.description, color)}
                            onMouseLeave={handleMouseLeave}
                          >
                            {item ? (
                              <>
                                <div onClick={(e) => {e.stopPropagation(); removeItem(i);}} className={styles.removeBtn}><X size={12}/></div>
                                <span className={styles.itemName} style={{color: color}}>{item.name}</span>
                                <span className={styles.itemQty}>x{item.qty}</span>
                                {item.name === 'Gacha Gift' && <button onClick={(e)=>{e.stopPropagation(); useGachaGift(i)}} className={styles.btnUseItem}>USAR</button>}
                              </>
                            ) : (<Plus size={20} color="#444" onClick={() => setIsModalOpen(true)}/>)}
                          </div>
                        )
                      })}
                   </div>
               </div>
            </div>
          )}
        </main>

        {tooltipData && (
            <div style={{position: 'fixed', top: tooltipData.y, left: tooltipData.x, transform: 'translate(0, 0)', background: 'rgba(20, 20, 25, 0.98)', border: `1px solid ${tooltipData.color}`, borderRadius: '8px', padding: '12px', zIndex: 9999, pointerEvents: 'none', boxShadow: `0 4px 30px rgba(0,0,0,0.8)`, minWidth: '220px', maxWidth: '300px', animation: 'fadeIn 0.1s ease-out'}}>
                <h4 style={{margin: '0 0 8px 0', color: tooltipData.color, fontSize: '1rem', textShadow: `0 0 10px ${tooltipData.color}50`}}>{tooltipData.title}</h4>
                <p style={{margin: 0, fontSize: '0.85rem', color: '#d4d4d8', lineHeight: '1.5'}}>{tooltipData.desc}</p>
            </div>
        )}

        {buyModalOpen && selectedItemToBuy && (
            <div className={styles.modalOverlay} onClick={() => setBuyModalOpen(false)}>
                <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{textAlign:'center', border: `1px solid ${getRarityColor(getRarityFromItem(selectedItemToBuy))}`}}>
                    <h2 style={{color: getRarityColor(getRarityFromItem(selectedItemToBuy)), marginBottom: '5px'}}>{selectedItemToBuy.item_name}</h2>
                    <p style={{fontSize:'0.9rem', color:'#a1a1aa', marginBottom:'20px'}}>{cleanDescription(selectedItemToBuy.description)}</p>
                    <p style={{color:'#fff', marginBottom:'15px'}}>Forma de Pagamento:</p>
                    <div style={{display:'flex', gap:'15px', justifyContent:'center'}}>
                        <button onClick={() => confirmBuy(false)} className={styles.card} style={{width:'140px', cursor: profile.gold >= selectedItemToBuy.price ? 'pointer' : 'not-allowed', opacity: profile.gold >= selectedItemToBuy.price ? 1 : 0.5, border: '1px solid #fbbf24', background: 'rgba(251, 191, 36, 0.1)'}}>
                            <Coins size={24} color="#fbbf24" style={{display:'block', margin:'0 auto 10px'}}/>
                            <span style={{display:'block', fontSize:'1.2rem', fontWeight:'bold', color:'#fbbf24'}}>{selectedItemToBuy.price}g</span>
                        </button>
                        <button onClick={() => playerHasRune && confirmBuy(true)} className={styles.card} style={{width:'140px', cursor: playerHasRune ? 'pointer' : 'not-allowed', opacity: playerHasRune ? 1 : 0.5, borderColor: getRarityColor(getRarityFromItem(selectedItemToBuy)), background: `rgba(255,255,255,0.05)`}}>
                            <Hexagon size={24} color={getRarityColor(getRarityFromItem(selectedItemToBuy))} style={{display:'block', margin:'0 auto 10px'}}/>
                            <span style={{display:'block', fontSize:'0.8rem', color:'#fff'}}>Runa {getRarityFromItem(selectedItemToBuy)}</span>
                            <span style={{display:'block', color: playerHasRune ? '#4ade80' : '#ef4444', fontSize:'0.7rem', marginTop:'5px', fontWeight:'bold'}}>{playerHasRune ? "USAR RUNA" : "SEM RUNA"}</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {rouletteState !== 'idle' && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.gachaCard} ${rouletteState === 'spinning' ? styles.isSpinning : styles.isResult}`} style={{borderColor: currentRarityDisplay.color, boxShadow: `0 0 60px ${currentRarityDisplay.color}80`}}>
               {rouletteState === 'spinning' ? <><div className={styles.gachaIconSpin}><Sparkles size={48} color="#fff"/></div><h2 style={{color: '#fff', opacity: 0.8}}>Sorteando...</h2></> : <h2 style={{color: '#fff'}}>VOCÊ OBTEVE</h2>}
               <div className={styles.rarityText} style={{ color: currentRarityDisplay.color }}>{currentRarityDisplay.name}</div>
               {rouletteState === 'result' && <div style={{display:'flex', flexDirection:'column', alignItems:'center', marginTop:'10px'}}><Hexagon size={48} color={currentRarityDisplay.color} /><div className={styles.resultItemName} style={{color:'#fff', marginTop:'10px'}}>RUNA {currentRarityDisplay.name}</div><span style={{fontSize:'0.8rem', color:'#a1a1aa'}}>Use para trocar por itens na Loja!</span></div>}
               {rouletteState === 'result' && <button onClick={() => {setRouletteState('idle'); setFinalResult(null);}} className={styles.btnAction} style={{marginTop: 'auto'}}>COLETAR</button>}
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h2 style={{color:'var(--accent-glow)', marginBottom:'20px'}}>Solicitar Item</h2>
              <input className={styles.input} placeholder="Nome do Item" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
              <input type="number" min="1" className={styles.input} placeholder="Quantidade" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} />
              <button onClick={requestItem} className={styles.btnAction}>ENVIAR PEDIDO</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}