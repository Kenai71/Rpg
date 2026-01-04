"use client"
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './player.module.css';

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

export default function PlayerPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [shop, setShop] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [myRequests, setMyRequests] = useState([]); 
  const [incomingTrades, setIncomingTrades] = useState([]); 
  const [myParty, setMyParty] = useState(null); 
  const [tab, setTab] = useState('missions');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferType, setTransferType] = useState('gold'); 
  const [transferAmount, setTransferAmount] = useState('');
  const [transferItemIdx, setTransferItemIdx] = useState(0);
  const [transferItemQty, setTransferItemQty] = useState(1);

  const [showLevelUp, setShowLevelUp] = useState(false);
  const [leveledUpTo, setLeveledUpTo] = useState(1);
  const prevLevelRef = useRef(1);

  const RANK_VALUES = { 'F': 0, 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };

  useEffect(() => {
    loadData();
    // Atualização automática a cada 5 segundos
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (prof) {
        if (prevLevelRef.current === 1 && prof.level > 1 && !profile) {
           prevLevelRef.current = prof.level;
        } else if (prof.level > prevLevelRef.current) {
          setLeveledUpTo(prof.level);
          setShowLevelUp(true);
          prevLevelRef.current = prof.level;
        }
      }

      setProfile(prof);
      const { data: reqs } = await supabase.from('item_requests').select('*').eq('player_id', user.id);
      setMyRequests(reqs || []);
      const { data: trades } = await supabase.from('trade_requests').select('*, profiles!sender_id(username)').eq('receiver_id', user.id);
      setIncomingTrades(trades || []);

      if (prof.party_id) {
        const { data: party } = await supabase.from('parties').select('*').eq('id', prof.party_id).single();
        setMyParty(party);
      } else {
        setMyParty(null);
      }
    }
    const { data: m } = await supabase.from('missions').select('*').eq('status', 'open');
    const { data: s } = await supabase.from('shop_items').select('*').gt('quantity', 0);
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'player');
    
    setMissions(m || []);
    setShop(s || []);
    setAllPlayers(p || []);
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  async function acceptMission(mission) {
    if (!profile) return;
    const pRank = RANK_VALUES[profile.rank || 'F'];
    const mRank = RANK_VALUES[mission.rank || 'F'];
    if (mRank > pRank + 1) return alert("Seu Rank é muito baixo para esta missão.");
    if (profile.party_id) {
      const { data: partyCheck } = await supabase.from('parties').select('leader_id').eq('id', profile.party_id).single();
      if (partyCheck.leader_id !== profile.id) return alert("Apenas o Líder do grupo pode aceitar missões!");
    }
    await supabase.from('missions').update({ status: 'in_progress', assigned_to: profile.id }).eq('id', mission.id);
    alert("Missão aceita!"); loadData();
  }

  // --- FUNÇÃO ATUALIZADA: Compra + Stacking + Deletar se acabar ---
  async function buyItem(item) {
    let qtyToBuy = 1;
    const input = prompt(`Quantos "${item.name || item.item_name}" deseja comprar? (Preço unitário: ${item.price}g)`, "1");
    if (input === null) return; 
    qtyToBuy = parseInt(input);
    if (isNaN(qtyToBuy) || qtyToBuy <= 0) return alert("Quantidade inválida.");

    const totalPrice = item.price * qtyToBuy;

    if (item.quantity < qtyToBuy) return alert("Estoque insuficiente na loja.");
    if (profile.gold < totalPrice) return alert("Ouro insuficiente.");

    const currentInv = profile.inventory || [];
    const limit = profile.slots || 10;
    const itemName = item.name || item.item_name;
    
    // Agrupa itens iguais (ignorando maiúsculas/minúsculas)
    const idx = currentInv.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
    
    let newInv = [...currentInv];
    
    if (idx >= 0) {
      newInv[idx].qty += qtyToBuy;
    } else {
      if (currentInv.length >= limit) return alert("Mochila cheia!");
      newInv.push({ name: itemName, qty: qtyToBuy });
    }

    // Atualiza jogador
    const { error } = await supabase.from('profiles').update({ 
      gold: profile.gold - totalPrice, 
      inventory: newInv 
    }).eq('id', profile.id);

    // Atualiza Loja (Remove se acabar)
    if (!error) { 
      const remaining = item.quantity - qtyToBuy;
      
      if (remaining > 0) {
        await supabase.from('shop_items').update({ quantity: remaining }).eq('id', item.id);
      } else {
        // Se o estoque zerar, deleta o item da loja para sumir do painel do Mestre
        await supabase.from('shop_items').delete().eq('id', item.id);
      }
      
      alert(`Comprou ${qtyToBuy}x ${itemName}!`); 
      loadData(); 
    }
  }

  async function requestItem() {
    if (!newItemName.trim()) return;
    if (newItemQty <= 0) return alert("Qtd > 0");
    await supabase.from('item_requests').insert([{ player_id: profile.id, item_name: newItemName, quantity: newItemQty }]);
    alert("Solicitação enviada!"); setNewItemName(''); setNewItemQty(1); setIsModalOpen(false); loadData();
  }

  async function removeItem(index) {
    if(!confirm("Jogar item fora?")) return;
    const currentInv = profile.inventory || [];
    let newInv = [...currentInv];
    if (newInv[index].qty > 1) newInv[index].qty -= 1; else newInv.splice(index, 1);
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', profile.id);
    loadData();
  }

  function openTransfer(target) {
    setTransferTarget(target);
    setTransferType('gold');
    setTransferAmount('');
    setTransferItemQty(1);
    setTransferModalOpen(true);
  }

  async function handleTransfer() {
    if (!transferTarget || !profile) return;
    
    if (transferType === 'gold') {
      const amount = Math.floor(Number(transferAmount)); 
      if (isNaN(amount) || amount <= 0) return alert("Valor inválido.");
      if (amount > profile.gold) return alert("Você não tem ouro suficiente.");

      await supabase.from('profiles').update({ gold: profile.gold - amount }).eq('id', profile.id);
      const { data: targetData } = await supabase.from('profiles').select('gold').eq('id', transferTarget.id).single();
      await supabase.from('profiles').update({ gold: (targetData.gold || 0) + amount }).eq('id', transferTarget.id);

      alert(`Você enviou ${amount} de ouro para ${transferTarget.username}!`);
      setTransferModalOpen(false);
      loadData();
    } 
    else if (transferType === 'item') {
      const inv = profile.inventory || [];
      const itemToGive = inv[transferItemIdx];
      const qtd = Math.floor(Number(transferItemQty));

      if (!itemToGive) return;
      if (isNaN(qtd) || qtd <= 0) return alert("Quantidade inválida.");
      if (qtd > itemToGive.qty) return alert("Você não tem essa quantidade!");

      const { error } = await supabase.from('trade_requests').insert({
        sender_id: profile.id, receiver_id: transferTarget.id, item_name: itemToGive.name, quantity: qtd
      });

      if (error) alert("Erro: " + error.message);
      else alert(`Solicitação enviada!`);

      setTransferModalOpen(false);
      loadData();
    }
  }

  async function acceptTrade(trade) {
    const { data: sender } = await supabase.from('profiles').select('inventory').eq('id', trade.sender_id).single();
    if (!sender) { alert("Remetente não encontrado."); await supabase.from('trade_requests').delete().eq('id', trade.id); loadData(); return; }

    const senderInv = sender.inventory || [];
    const itemIndex = senderInv.findIndex(i => i.name === trade.item_name);

    if (itemIndex === -1 || senderInv[itemIndex].qty < trade.quantity) {
      alert("Falha: Remetente não tem mais este item.");
      await supabase.from('trade_requests').delete().eq('id', trade.id);
      loadData();
      return;
    }

    let newSenderInv = [...senderInv];
    if (newSenderInv[itemIndex].qty > trade.quantity) newSenderInv[itemIndex].qty -= trade.quantity;
    else newSenderInv.splice(itemIndex, 1);
    
    const myInv = profile.inventory || [];
    const limit = profile.slots || 10;
    
    if (myInv.length >= limit && !myInv.find(i => i.name === trade.item_name)) return alert("Mochila cheia!");

    let newMyInv = [...myInv];
    const myItemIndex = newMyInv.findIndex(i => i.name === trade.item_name);
    if (myItemIndex >= 0) newMyInv[myItemIndex].qty += trade.quantity;
    else newMyInv.push({ name: trade.item_name, qty: trade.quantity });

    await supabase.from('profiles').update({ inventory: newSenderInv }).eq('id', trade.sender_id);
    await supabase.from('profiles').update({ inventory: newMyInv }).eq('id', profile.id);
    await supabase.from('trade_requests').delete().eq('id', trade.id);
    alert(`Recebido!`); loadData();
  }

  async function rejectTrade(tradeId) {
    if (!confirm("Recusar?")) return;
    await supabase.from('trade_requests').delete().eq('id', tradeId); loadData();
  }

  const getRankColor = (rank) => RANK_COLORS[rank] || '#ccc';

  const getXpProgress = () => {
    if (!profile) return { percent: 0, text: '0/0' };
    const currentLevel = profile.level || 1;
    if (currentLevel >= 20) return { percent: 100, text: 'Nível Máximo' };
    const currentLevelData = XP_TABLE.find(l => l.lvl === currentLevel) || { xp: 0 };
    const nextLevelData = XP_TABLE.find(l => l.lvl === currentLevel + 1) || { xp: 999999 };
    const currentXpFloor = currentLevelData.xp;
    const nextXpCeiling = nextLevelData.xp;
    const xpInLevel = profile.xp - currentXpFloor;
    const xpNeededForLevel = nextXpCeiling - currentXpFloor;
    const percent = Math.min(100, Math.max(0, (xpInLevel / xpNeededForLevel) * 100));
    const needed = nextXpCeiling - profile.xp;
    return { percent, text: `${profile.xp} / ${nextXpCeiling} (Faltam ${needed})` };
  };

  const xpData = getXpProgress();

  return (
    <div className={styles.container}>
      {showLevelUp && (
        <div className="modal-overlay" style={{background:'rgba(0,0,0,0.85)'}} onClick={() => setShowLevelUp(false)}>
          <div className={styles.levelUpCard} onClick={e => e.stopPropagation()}>
            <h1 className={styles.levelUpTitle}>LEVEL UP!</h1>
            <div className={styles.levelBadge}>{leveledUpTo}</div>
            <p style={{color:'#ddd', marginTop:'15px'}}>Você alcançou um novo patamar de poder.</p>
            <button className={styles.btnPrimary} onClick={() => setShowLevelUp(false)} style={{marginTop:'20px'}}>CONTINUAR</button>
          </div>
        </div>
      )}

      {transferModalOpen && transferTarget && (
        <div className="modal-overlay" onClick={() => setTransferModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color:'#fbbf24', marginBottom:'0.5rem'}}>Enviar para {transferTarget.username}</h2>
            <div style={{display:'flex', gap:'10px', justifyContent:'center', marginBottom:'20px'}}>
              <button onClick={() => setTransferType('gold')} className={styles.tabBtn} style={{borderColor: transferType === 'gold' ? '#fbbf24' : '#444', color: transferType === 'gold' ? '#fbbf24' : '#888'}}>💰 Ouro</button>
              <button onClick={() => setTransferType('item')} className={styles.tabBtn} style={{borderColor: transferType === 'item' ? '#fbbf24' : '#444', color: transferType === 'item' ? '#fbbf24' : '#888'}}>🎒 Item</button>
            </div>
            {transferType === 'gold' ? (
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block', color:'#888', fontSize:'0.8rem'}}>Quantidade (Saldo: {profile.gold})</label>
                <input type="number" className="rpg-input" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0" min="1" />
              </div>
            ) : (
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block', color:'#888', fontSize:'0.8rem'}}>Selecione o Item</label>
                {(!profile.inventory || profile.inventory.length === 0) ? <p style={{color:'#ef4444'}}>Mochila vazia.</p> : (
                  <>
                  <select className="rpg-input" value={transferItemIdx} onChange={e => {setTransferItemIdx(e.target.value); setTransferItemQty(1);}}>
                    {profile.inventory.map((item, idx) => <option key={idx} value={idx}>{item.name} (x{item.qty})</option>)}
                  </select>
                  <label style={{display:'block', color:'#888', fontSize:'0.8rem', marginTop:'10px'}}>Quantidade</label>
                  <input type="number" className="rpg-input" value={transferItemQty} onChange={e => setTransferItemQty(e.target.value)} min="1" max={profile.inventory[transferItemIdx]?.qty || 1} />
                  </>
                )}
              </div>
            )}
            <button onClick={handleTransfer} className={styles.btnPrimary} style={{width:'100%'}}>Confirmar Envio</button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color:'#fbbf24'}}>Encontrou algo?</h2>
            <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
              <input className="rpg-input" placeholder="Item" value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{flex: 3}} />
              <input type="number" min="1" className="rpg-input" placeholder="Qtd" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} style={{flex: 1}} />
            </div>
            <button onClick={requestItem} className={styles.btnPrimary}>Solicitar ao Mestre</button>
          </div>
        </div>
      )}

      {profile && (
        <div className={styles.hud}>
          <div className={styles.charInfo}>
            <h1>{profile.username}</h1>
            <div style={{display:'flex', gap:'10px'}}>
              <span className={styles.rankTag} style={{background: `linear-gradient(45deg, ${getRankColor(profile.rank)}dd, #000)`, color: '#fff', border:`1px solid ${getRankColor(profile.rank)}`}}>RANK {profile.rank || 'F'}</span>
              <span className={styles.rankTag} style={{background:'#444'}}>LVL {profile.level || 1}</span>
              {myParty && <span className={styles.rankTag} style={{background:'#064e3b', color:'#a7f3d0'}}>{myParty.name}</span>}
            </div>
          </div>
          <div className={styles.hudRight}>
            <div style={{display:'flex', flexDirection:'column', alignItems:'end', gap:'5px'}}>
              <div className={styles.stats}>
                <div className={styles.statItem}><span className={`${styles.statVal} ${styles.gold}`}>{profile.gold}</span><span className={styles.statLabel}>Ouro</span></div>
              </div>
              <div className={styles.xpBarContainer} title={xpData.text}>
                <div className={styles.xpBarFill} style={{width: `${xpData.percent}%`}}></div>
                <span className={styles.xpTextOverlay}>XP {xpData.text}</span>
              </div>
            </div>
            <div className={styles.actions}><button onClick={loadData} className={styles.btnHeader}>↻</button><button onClick={handleLogout} className={styles.btnHeader} style={{color:'#fca5a5'}}>Sair</button></div>
          </div>
        </div>
      )}

      <nav className={styles.nav}>
        {['missions', 'shop', 'players', 'inv'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`${styles.navBtn} ${tab === t ? styles.active : ''}`}>{t === 'missions' && 'Mural'}{t === 'shop' && 'Loja'}{t === 'players' && 'Aliados'}{t === 'inv' && 'Mochila'}</button>
        ))}
      </nav>

      <main className={styles.mainContent}>
        {tab === 'missions' && (
          <div className={styles.grid}>
            {missions.length === 0 && <p className={styles.emptyMsg}>Nenhuma missão.</p>}
            {missions.map(m => (
              <div key={m.id} className={styles.card} style={{borderLeft:`4px solid ${getRankColor(m.rank)}`}}>
                <div className={styles.cardHeader}><h3>{m.title}</h3><span style={{color: getRankColor(m.rank), fontWeight:'bold'}}>RANK {m.rank}</span></div>
                <p className={styles.cardDesc}>"{m.desc || m.description}"</p>
                <div style={{marginTop:'auto'}}><button onClick={() => acceptMission(m)} className={`${styles.btnAction} ${styles.accept}`}>Aceitar</button></div>
              </div>
            ))}
          </div>
        )}

        {tab === 'shop' && (
          <div className={styles.grid}>
            {shop.map(item => (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardHeader}><h3>{item.name || item.item_name}</h3><span>x{item.quantity}</span></div>
                <p className={styles.cardDesc}>{item.desc || item.description}</p>
                <button onClick={() => buyItem(item)} className={`${styles.btnAction} ${styles.buy}`}>Comprar {item.price}g</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'players' && (
          <div className={styles.grid}>
             {allPlayers.map(p => {
               const isPartyMember = myParty && p.party_id === myParty.id;
               const isMe = p.id === profile.id;
               
               const isLeader = myParty && p.id === myParty.leader_id;
               
               const borderColor = isPartyMember ? '#22c55e' : getRankColor(p.rank);
               const borderWidth = isPartyMember ? '2px' : '1px';
               const boxShadow = isPartyMember ? '0 0 15px rgba(34, 197, 94, 0.3)' : `0 0 10px ${getRankColor(p.rank)}20`;

               return (
                 <div key={p.id} className={styles.card} style={{alignItems:'center', textAlign:'center', border: `${borderWidth} solid ${borderColor}`, boxShadow: boxShadow}}>
                   <div style={{fontSize:'2.5rem', marginBottom:'10px'}}>🛡️</div>
                   
                   <h3 style={{color:'white', margin:0, display:'flex', alignItems:'center', gap:'5px'}}>
                     {p.username} 
                     {isLeader && <span title="Líder do Grupo">👑</span>}
                   </h3>

                   <div style={{display:'flex', gap:'5px', justifyContent:'center', marginTop:'5px'}}>
                     <span style={{color: getRankColor(p.rank), fontSize:'0.7rem', fontWeight:'bold', background:'#111', padding:'2px 6px', borderRadius:'4px', border:`1px solid ${getRankColor(p.rank)}`}}>RANK {p.rank}</span>
                     <span style={{color:'#eab308', fontSize:'0.7rem', fontWeight:'bold', background:'#111', padding:'2px 6px', borderRadius:'4px'}}>LVL {p.level || 1}</span>
                   </div>
                   
                   {isPartyMember && <span style={{fontSize:'0.7rem', color:'#86efac', marginTop:'5px'}}>Seu Grupo</span>}
                   
                   {isPartyMember && !isMe && <button onClick={() => openTransfer(p)} className={styles.btnAction} style={{marginTop:'15px', background:'#b45309', fontSize:'0.8rem', padding:'8px'}}>🎁 Enviar Recurso</button>}
                 </div>
               );
             })}
          </div>
        )}

        {tab === 'inv' && (
          <div className={styles.invWrapper}>
             <h2 className={styles.invTitle}>Mochila ({profile?.inventory?.length || 0}/{profile?.slots || 10})</h2>
             <div className={styles.invGrid}>
                {[...Array(profile?.slots || 10)].map((_, i) => {
                  const item = profile?.inventory?.[i];
                  return (
                    <div key={i} className={`slot ${item ? 'filled' : ''} ${styles.slot}`}>
                      {item ? (<><div onClick={() => removeItem(i)} className={styles.removeBtn}>-</div><span className={styles.itemName}>{item.name}</span><span className={styles.itemQty}>x{item.qty}</span></>) : <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>+</button>}
                    </div>
                  )
                })}
             </div>
             {incomingTrades.length > 0 && (
               <div style={{marginTop:'30px', background:'#111', padding:'15px', borderRadius:'8px', border:'1px solid #b45309'}}>
                 <h4 style={{color:'#fbbf24', fontSize:'0.9rem'}}>🎁 Entregas ({incomingTrades.length})</h4>
                 <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                   {incomingTrades.map(trade => (
                     <div key={trade.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#222', padding:'10px'}}>
                        <div><strong style={{color:'#fff'}}>{trade.quantity}x {trade.item_name}</strong><span style={{fontSize:'0.75rem', color:'#aaa', marginLeft:'5px'}}>De: {trade.profiles?.username}</span></div>
                        <div style={{display:'flex', gap:'5px'}}><button onClick={() => acceptTrade(trade)} style={{background:'#166534', color:'white', border:'none', padding:'4px 8px'}}>Aceitar</button><button onClick={() => rejectTrade(trade.id)} style={{background:'#991b1b', color:'white', border:'none', padding:'4px 8px'}}>Recusar</button></div>
                     </div>
                   ))}
                 </div>
               </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}