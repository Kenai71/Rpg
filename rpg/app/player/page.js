"use client"
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './player.module.css';
import { 
  User, Shield, ShoppingBag, Scroll, Package, LogOut, 
  RefreshCw, Sparkles, Coins, Gift, Plus, X, Check 
} from 'lucide-react';

const RANK_COLORS = {
  'F': '#9ca3af', 'E': '#4ade80', 'D': '#60a5fa',
  'C': '#a78bfa', 'B': '#f87171', 'A': '#fbbf24', 'S': '#22d3ee'
};

const XP_TABLE = [
  { lvl: 1, xp: 0 }, { lvl: 2, xp: 300 }, { lvl: 3, xp: 900 }, { lvl: 4, xp: 2700 },
  { lvl: 5, xp: 6500 }, { lvl: 6, xp: 14000 }, { lvl: 7, xp: 23000 }, { lvl: 8, xp: 34000 },
  { lvl: 9, xp: 48000 }, { lvl: 10, xp: 64000 }, { lvl: 11, xp: 85000 }, { lvl: 12, xp: 100000 },
  { lvl: 13, xp: 120000 }, { lvl: 14, xp: 140000 }, { lvl: 15, xp: 165000 }, { lvl: 16, xp: 195000 },
  { lvl: 17, xp: 225000 }, { lvl: 18, xp: 265000 }, { lvl: 19, xp: 305000 }, { lvl: 20, xp: 355000 }
];

const RARITIES = [
  { name: 'COMUM', color: '#9ca3af', chance: 50 },
  { name: 'INCOMUM', color: '#4ade80', chance: 30 },
  { name: 'RARO', color: '#60a5fa', chance: 15 },
  { name: 'ÉPICO', color: '#a78bfa', chance: 4 },
  { name: 'LENDÁRIO', color: '#fbbf24', chance: 0.9 },
  { name: 'MÍTICO', color: '#ef4444', chance: 0.1 }
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

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferType, setTransferType] = useState('gold'); 
  const [transferAmount, setTransferAmount] = useState('');
  const [transferItemIdx, setTransferItemIdx] = useState(0);
  const [transferItemQty, setTransferItemQty] = useState(1);

  const [showLevelUp, setShowLevelUp] = useState(false);
  const [leveledUpTo, setLeveledUpTo] = useState(1);
  
  // REFs para manter o estado atualizado dentro de funções assíncronas (como a roleta)
  const prevLevelRef = useRef(1);
  const profileRef = useRef(null);

  const RANK_VALUES = { 'F': 0, 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };

  // Mantém o profileRef sempre sincronizado com o profile do estado
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); 
    return () => clearInterval(interval);
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
      if (prevLevelRef.current === 1 && prof.level > 1 && !profile) {
         prevLevelRef.current = prof.level;
      } else if (prof.level > prevLevelRef.current) {
        setLeveledUpTo(prof.level);
        setShowLevelUp(true);
        prevLevelRef.current = prof.level;
      }
      
      // Só atualiza se não estiver rodando a roleta para evitar "pulos" visuais
      if (rouletteState === 'idle') {
        setProfile(prof);
      } else {
        // Se estiver rodando, atualizamos apenas o ref silenciosamente se necessário,
        // mas evitamos setProfile para não sobrescrever a remoção otimista do Gacha Gift.
        // Porém, como usamos profileRef na finalização, o estado visual local é rei.
      }

      if (prof.party_id) {
        const { data: party } = await supabase.from('parties').select('*').eq('id', prof.party_id).single();
        setMyParty(party);
      } else {
        setMyParty(null);
      }
    }

    setMissions(missionsRes.data || []);
    setShop(shopRes.data || []);
    setAllPlayers(playersRes.data || []);
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  async function acceptMission(mission) {
    if (!profile) return;
    const pRank = RANK_VALUES[profile.rank || 'F'];
    const mRank = RANK_VALUES[mission.rank || 'F'];
    if (mRank > pRank + 1) return alert("Seu Rank é muito baixo para esta missão.");
    
    setMissions(current => current.filter(m => m.id !== mission.id));
    const { error } = await supabase.from('missions').update({ status: 'in_progress', assigned_to: profile.id }).eq('id', mission.id);
    if(error) { alert("Erro ao aceitar"); loadData(); }
  }

  async function buyItem(item) {
    let qtyToBuy = 1;
    const input = prompt(`Quantos "${item.name || item.item_name}"?`, "1");
    if (input === null) return; 
    qtyToBuy = parseInt(input);
    if (isNaN(qtyToBuy) || qtyToBuy <= 0) return alert("Qtd inválida.");

    const totalPrice = item.price * qtyToBuy;
    if (item.quantity < qtyToBuy) return alert("Sem estoque.");
    if (profile.gold < totalPrice) return alert("Ouro insuficiente.");

    const itemName = item.name || item.item_name;
    const currentInv = [...(profile.inventory || [])];
    const idx = currentInv.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
    
    if (idx >= 0) currentInv[idx].qty += qtyToBuy; 
    else currentInv.push({ name: itemName, qty: qtyToBuy });

    setProfile(prev => ({ ...prev, gold: prev.gold - totalPrice, inventory: currentInv }));
    setShop(currentShop => currentShop.map(s => 
        s.id === item.id ? { ...s, quantity: s.quantity - qtyToBuy } : s
    ).filter(s => s.quantity > 0));

    await supabase.from('profiles').update({ gold: profile.gold - totalPrice, inventory: currentInv }).eq('id', profile.id);
    const remaining = item.quantity - qtyToBuy;
    if (remaining > 0) await supabase.from('shop_items').update({ quantity: remaining }).eq('id', item.id);
    else await supabase.from('shop_items').delete().eq('id', item.id);
  }

  async function removeItem(index) {
    if(!confirm("Jogar fora?")) return;
    const currentInv = [...profile.inventory];
    if (currentInv[index].qty > 1) currentInv[index].qty -= 1; else currentInv.splice(index, 1);
    
    setProfile(prev => ({ ...prev, inventory: currentInv }));
    await supabase.from('profiles').update({ inventory: currentInv }).eq('id', profile.id);
  }

  async function requestItem() {
    if (!newItemName.trim()) return;
    await supabase.from('item_requests').insert([{ player_id: profile.id, item_name: newItemName, quantity: newItemQty }]);
    setNewItemName(''); setIsModalOpen(false);
    alert("Solicitado!"); 
  }

  async function requestSpin() {
    const { error } = await supabase.from('item_requests').insert([{ player_id: profile.id, item_name: "SOLICITACAO_ROLETA", quantity: 1 }]);
    if (!error) alert("Solicitado!");
  }

  async function useGachaGift(index) {
    // 1. Clona o inventário
    const currentInv = [...profile.inventory];
    const item = currentInv[index];

    // 2. Remove ou diminui a quantidade
    if (item.qty > 1) {
      item.qty -= 1;
    } else {
      currentInv.splice(index, 1);
    }

    // 3. Atualiza a tela IMEDIATAMENTE (antes do banco/animação)
    setProfile(prev => ({ ...prev, inventory: currentInv }));

    // 4. Salva no banco (assíncrono)
    supabase.from('profiles').update({ inventory: currentInv }).eq('id', profile.id).then(({error}) => {
       if(error) console.error("Erro ao atualizar inventário:", error);
    });

    // 5. Começa a roleta
    startSpinAnimation();
  }

  function openTransfer(target) {
    setTransferTarget(target); setTransferType('gold'); setTransferAmount(''); setTransferItemQty(1); setTransferModalOpen(true);
  }

  async function handleTransfer() {
    if (!transferTarget || !profile) return;
    if (transferType === 'gold') {
      const amount = Math.floor(Number(transferAmount)); 
      if (amount <= 0 || amount > profile.gold) return alert("Inválido.");
      
      setProfile(prev => ({ ...prev, gold: prev.gold - amount }));
      setTransferModalOpen(false);

      await supabase.from('profiles').update({ gold: profile.gold - amount }).eq('id', profile.id);
      const { data: tData } = await supabase.from('profiles').select('gold').eq('id', transferTarget.id).single();
      await supabase.from('profiles').update({ gold: (tData.gold || 0) + amount }).eq('id', transferTarget.id);
    } else {
        const inv = profile.inventory || [];
        const itemToGive = inv[transferItemIdx];
        const qtd = Math.floor(Number(transferItemQty));
        if (!itemToGive || qtd > itemToGive.qty) return alert("Inválido");
        
        await supabase.from('trade_requests').insert({ sender_id: profile.id, receiver_id: transferTarget.id, item_name: itemToGive.name, quantity: qtd });
        alert("Enviado!"); setTransferModalOpen(false);
    }
  }

  function startSpinAnimation() {
    setRouletteState('spinning');
    let speed = 50; let counter = 0; const maxSpins = 30; 
    const rand = Math.random() * 100;
    let accumulated = 0; let resultObj = RARITIES[0];
    for (let r of RARITIES) { accumulated += r.chance; if (rand <= accumulated) { resultObj = r; break; } }

    const spinInterval = () => {
      setCurrentRarityDisplay(RARITIES[Math.floor(Math.random() * RARITIES.length)]);
      counter++;
      if (counter < maxSpins) { speed += 10; setTimeout(spinInterval, speed); } 
      else { finishSpin(resultObj); }
    };
    spinInterval();
  }

  // --- CORREÇÃO PRINCIPAL: Usando profileRef ---
  async function finishSpin(result) {
    setCurrentRarityDisplay(result); 
    setFinalResult(result); 
    setRouletteState('result');

    // Usamos o profileRef.current para garantir que estamos pegando 
    // o inventário MAIS ATUAL (aquele onde o Gacha Gift já foi removido).
    const currentProf = profileRef.current;
    if (!currentProf) return;

    const itemName = `Item ${result.name}`;
    const newInv = [...currentProf.inventory]; 
    const idx = newInv.findIndex(i => i.name === itemName);
    
    if (idx >= 0) newInv[idx].qty += 1; 
    else newInv.push({ name: itemName, qty: 1 });
    
    // Atualiza estado e banco com a lista correta
    setProfile(prev => ({...prev, inventory: newInv}));
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', currentProf.id);
  }

  const getRankColor = (rank) => RANK_COLORS[rank] || '#ccc';
  const getXpProgress = () => {
    if (!profile) return { percent: 0, text: '0/0' };
    const curr = profile.level || 1;
    if (curr >= 20) return { percent: 100, text: 'MAX' };
    const currData = XP_TABLE.find(l => l.lvl === curr) || { xp: 0 };
    const nextData = XP_TABLE.find(l => l.lvl === curr + 1) || { xp: 999999 };
    const percent = Math.min(100, Math.max(0, ((profile.xp - currData.xp) / (nextData.xp - currData.xp)) * 100));
    return { percent, text: `${profile.xp} / ${nextData.xp}` };
  };
  const xpData = getXpProgress();

  return (
    <div className={styles.wrapper} data-theme={currentTheme}>
      <div className={styles.themeSwitcher}>
          {themes.map(t => (
              <button key={t.id} className={`${styles.themeDot} ${currentTheme === t.id ? styles.activeDot : ''}`}
                style={{backgroundColor: t.color}} onClick={() => setCurrentTheme(t.id)} title={t.label} />
          ))}
      </div>

      <div className={styles.container}>
        {profile && (
          <div className={styles.hud}>
            <div className={styles.charInfo}>
              <h1><User size={32} /> {profile.username}</h1>
              <div className={styles.charDetails}>
                <span className={styles.tag} style={{color: getRankColor(profile.rank), borderColor: getRankColor(profile.rank)}}>RANK {profile.rank || 'F'}</span>
                <span className={styles.tag}>LVL {profile.level || 1}</span>
                {myParty && <span className={styles.tag} style={{borderColor: '#10b981', color: '#10b981'}}>{myParty.name}</span>}
              </div>
            </div>
            
            <div className={styles.hudRight}>
               <button onClick={requestSpin} className={`${styles.btnIcon} ${styles.btnMagic}`}><Sparkles size={16}/> Gift</button>
               
               <div className={styles.statsGroup}>
                 <div className={styles.goldDisplay}><Coins size={18} color="#fbbf24" /> {profile.gold}</div>
                 <div className={styles.xpContainer} title={xpData.text}>
                    <div className={styles.xpFill} style={{width: `${xpData.percent}%`}}></div>
                 </div>
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
          <button onClick={() => setTab('missions')} className={`${styles.navBtn} ${tab === 'missions' ? styles.active : ''}`}>Mural</button>
          <button onClick={() => setTab('shop')} className={`${styles.navBtn} ${tab === 'shop' ? styles.active : ''}`}>Loja</button>
          <button onClick={() => setTab('players')} className={`${styles.navBtn} ${tab === 'players' ? styles.active : ''}`}>Aliados</button>
          <button onClick={() => setTab('inv')} className={`${styles.navBtn} ${tab === 'inv' ? styles.active : ''}`}>Mochila</button>
        </nav>

        <main className={styles.grid}>
          {tab === 'missions' && (
            <>
              {missions.length === 0 && <p className={styles.emptyMsg}>Nenhuma missão disponível.</p>}
              {missions.map(m => (
                <div key={m.id} className={styles.card} style={{borderLeft:`4px solid ${getRankColor(m.rank)}`}}>
                  <div className={styles.missionHeader}>
                    <h3><Scroll size={18}/> {m.title}</h3>
                    <span style={{color: getRankColor(m.rank)}}>RANK {m.rank}</span>
                  </div>
                  <p className={styles.cardDesc}>"{m.desc || m.description}"</p>
                  <button onClick={() => acceptMission(m)} className={styles.btnAction}><Check size={16}/> ACEITAR</button>
                </div>
              ))}
            </>
          )}

          {tab === 'shop' && (
            <>
              {shop.length === 0 && <p className={styles.emptyMsg}>(Nada para comprar no momento...)</p>}
              {shop.map(item => (
                <div key={item.id} className={styles.card}>
                  <div className={styles.cardHeader}><h3><ShoppingBag size={18}/> {item.name || item.item_name}</h3><span>x{item.quantity}</span></div>
                  <p className={styles.cardDesc}>{item.desc || item.description}</p>
                  <button onClick={() => buyItem(item)} className={styles.btnAction}><Coins size={16}/> {item.price}g</button>
                </div>
              ))}
            </>
          )}

          {tab === 'players' && (
             allPlayers.map(p => {
               const isMe = p.id === profile?.id;
               return (
                 <div key={p.id} className={styles.card} style={{alignItems:'center', textAlign:'center', border: isMe ? '1px solid var(--accent-primary)' : ''}}>
                   <div style={{fontSize:'2.5rem', marginBottom:'10px'}}><Shield size={40} color={getRankColor(p.rank)}/></div>
                   <h3 style={{color:'#fff', margin:0}}>{p.username}</h3>
                   <span style={{color: getRankColor(p.rank), fontSize:'0.8rem', marginTop:'5px'}}>RANK {p.rank}</span>
                   {!isMe && <button onClick={() => openTransfer(p)} className={styles.btnAction} style={{marginTop:'15px'}}><Gift size={16}/> Enviar</button>}
                 </div>
               );
             })
          )}

          {tab === 'inv' && (
            <div className={styles.invWrapper} style={{gridColumn:'1/-1'}}>
               <div className={styles.invHeader}>
                 <h2 style={{margin:0, display:'flex', alignItems:'center', gap:'10px'}}><Package/> Inventário</h2>
                 <span style={{color:'var(--text-muted)'}}>{profile?.inventory?.length || 0} / {profile?.slots || 10}</span>
               </div>
               <div className={styles.invGrid}>
                  {[...Array(profile?.slots || 10)].map((_, i) => {
                    const item = profile?.inventory?.[i];
                    return (
                      <div key={i} className={`${styles.slot} ${!item ? styles.empty : ''}`}>
                        {item ? (
                          <>
                            <div onClick={(e) => {e.stopPropagation(); removeItem(i);}} className={styles.removeBtn}><X size={12}/></div>
                            <span className={styles.itemName}>{item.name}</span>
                            <span className={styles.itemQty}>x{item.qty}</span>
                            
                            {item.name === 'Gacha Gift' && (
                                <button onClick={(e)=>{e.stopPropagation(); useGachaGift(i)}} className={styles.btnUseItem}>
                                    USAR
                                </button>
                            )}
                          </>
                        ) : (
                          <Plus size={20} color="#444" onClick={() => setIsModalOpen(true)}/>
                        )}
                      </div>
                    )
                  })}
               </div>
            </div>
          )}
        </main>

        {/* MODAL GACHA/ROLETA */}
        {rouletteState !== 'idle' && (
          <div className={styles.modalOverlay}>
            <div 
              className={`${styles.gachaCard} ${rouletteState === 'spinning' ? styles.isSpinning : styles.isResult}`} 
              style={{
                borderColor: currentRarityDisplay.color, 
                boxShadow: `0 0 60px ${currentRarityDisplay.color}80` 
              }}
            >
               {rouletteState === 'spinning' ? (
                 <>
                   <div className={styles.gachaIconSpin}><Sparkles size={48} color="#fff"/></div>
                   <h2 style={{color: '#fff', opacity: 0.8}}>Sorteando...</h2>
                 </>
               ) : (
                 <h2 style={{color: '#fff'}}>VOCÊ GANHOU</h2>
               )}

               <div className={styles.rarityText} style={{ color: currentRarityDisplay.color }}>
                 {currentRarityDisplay.name}
               </div>

               {rouletteState === 'result' && (
                 <div className={styles.resultItemName}>Item {currentRarityDisplay.name}</div>
               )}

               {rouletteState === 'result' && (
                 <button onClick={() => {setRouletteState('idle'); setFinalResult(null);}} className={styles.btnAction} style={{marginTop: 'auto'}}>
                   COLETAR
                 </button>
               )}
            </div>
          </div>
        )}

        {showLevelUp && (
          <div className={styles.modalOverlay} onClick={() => setShowLevelUp(false)}>
            <div className={styles.levelUpCard}>
              <h1 style={{fontSize:'3rem', margin:0, color:'#fbbf24'}}>LEVEL UP!</h1>
              <div className={styles.levelBadge}>{leveledUpTo}</div>
              <button className={styles.btnAction} onClick={() => setShowLevelUp(false)}>CONTINUAR</button>
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

        {transferModalOpen && transferTarget && (
          <div className={styles.modalOverlay} onClick={() => setTransferModalOpen(false)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h2 style={{color:'var(--accent-glow)', marginBottom:'20px'}}>Enviar para {transferTarget.username}</h2>
              <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <button onClick={() => setTransferType('gold')} className={styles.navBtn} style={{background: transferType === 'gold' ? 'var(--accent-primary)' : '', color: transferType === 'gold' ? '#fff' : ''}}>Ouro</button>
                <button onClick={() => setTransferType('item')} className={styles.navBtn} style={{background: transferType === 'item' ? 'var(--accent-primary)' : '', color: transferType === 'item' ? '#fff' : ''}}>Item</button>
              </div>
              
              {transferType === 'gold' ? (
                <input type="number" className={styles.input} value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="Quantidade de Ouro" />
              ) : (
                <>
                  <select className={styles.input} value={transferItemIdx} onChange={e => {setTransferItemIdx(e.target.value); setTransferItemQty(1);}}>
                    {profile?.inventory?.map((item, idx) => <option key={idx} value={idx}>{item.name} (x{item.qty})</option>)}
                  </select>
                  <input type="number" className={styles.input} value={transferItemQty} onChange={e => setTransferItemQty(e.target.value)} placeholder="Qtd" />
                </>
              )}
              <button onClick={handleTransfer} className={styles.btnAction}>CONFIRMAR</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}