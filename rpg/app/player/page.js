"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './player.module.css';

// Cores por Rank
const RANK_COLORS = {
  'F': '#9ca3af',
  'E': '#4ade80',
  'D': '#60a5fa',
  'C': '#a78bfa',
  'B': '#f87171',
  'A': '#fbbf24',
  'S': '#22d3ee'
};

export default function PlayerPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [shop, setShop] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  
  const [myRequests, setMyRequests] = useState([]); // Pedidos ao Mestre
  const [incomingTrades, setIncomingTrades] = useState([]); // Trocas de Players (NOVO)
  
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

  const RANK_VALUES = { 'F': 0, 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };

  useEffect(() => {
    loadData();
    // Auto refresh leve a cada 10s para ver se chegaram itens
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);
      
      // Pedidos ao Mestre
      const { data: reqs } = await supabase.from('item_requests').select('*').eq('player_id', user.id);
      setMyRequests(reqs || []);

      // Pedidos de Troca (Recebidos de outros Players)
      const { data: trades } = await supabase
        .from('trade_requests')
        .select('*, profiles!sender_id(username)') // Pega o nome de quem mandou
        .eq('receiver_id', user.id);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  async function acceptMission(mission) {
    if (!profile) return;
    const pRank = RANK_VALUES[profile.rank || 'F'];
    const mRank = RANK_VALUES[mission.rank || 'F'];
    if (mRank > pRank + 1) return alert("Seu Rank é muito baixo para esta missão.");

    if (profile.party_id) {
      const { data: partyCheck } = await supabase.from('parties').select('leader_id').eq('id', profile.party_id).single();
      if (partyCheck.leader_id !== profile.id) {
        return alert("Apenas o Líder do grupo pode aceitar missões!");
      }
    }

    await supabase.from('missions').update({ status: 'in_progress', assigned_to: profile.id }).eq('id', mission.id);
    alert("Missão aceita!");
    loadData();
  }

  async function buyItem(item) {
    if (profile.gold < item.price) return alert("Ouro insuficiente.");
    const currentInv = profile.inventory || [];
    const limit = profile.slots || 10;
    
    const itemName = item.name || item.item_name;

    const idx = currentInv.findIndex(i => i.name === itemName);
    let newInv = [...currentInv];
    if (idx >= 0) newInv[idx].qty += 1;
    else {
      if (currentInv.length >= limit) return alert("Mochila cheia!");
      newInv.push({ name: itemName, qty: 1 });
    }
    const { error } = await supabase.from('profiles').update({ gold: profile.gold - item.price, inventory: newInv }).eq('id', profile.id);
    if (!error) {
      await supabase.from('shop_items').update({ quantity: item.quantity - 1 }).eq('id', item.id);
      alert("Comprado!");
      loadData();
    }
  }

  async function requestItem() {
    if (!newItemName.trim()) return;
    if (newItemQty <= 0) return alert("Quantidade deve ser maior que 0");
    await supabase.from('item_requests').insert([{ player_id: profile.id, item_name: newItemName, quantity: newItemQty }]);
    alert("Solicitação enviada ao Mestre!");
    setNewItemName(''); setNewItemQty(1); setIsModalOpen(false);
    loadData();
  }

  async function removeItem(index) {
    if(!confirm("Jogar item fora?")) return;
    const currentInv = profile.inventory || [];
    let newInv = [...currentInv];
    if (newInv[index].qty > 1) newInv[index].qty -= 1; else newInv.splice(index, 1);
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', profile.id);
    loadData();
  }

  // --- LÓGICA DE TRANSFERÊNCIA ---

  function openTransfer(target) {
    setTransferTarget(target);
    setTransferType('gold');
    setTransferAmount('');
    setTransferModalOpen(true);
  }

  async function handleTransfer() {
    if (!transferTarget || !profile) return;
    
    // CASO 1: OURO (Direto)
    if (transferType === 'gold') {
      const amount = Number(transferAmount);
      if (amount <= 0) return alert("Valor inválido.");
      if (profile.gold < amount) return alert("Você não tem ouro suficiente.");

      await supabase.from('profiles').update({ gold: profile.gold - amount }).eq('id', profile.id);
      const { data: targetData } = await supabase.from('profiles').select('gold').eq('id', transferTarget.id).single();
      await supabase.from('profiles').update({ gold: (targetData.gold || 0) + amount }).eq('id', transferTarget.id);

      alert(`Você enviou ${amount} de ouro para ${transferTarget.username}!`);
      setTransferModalOpen(false);
      loadData();
    } 
    // CASO 2: ITEM (Solicitação)
    else if (transferType === 'item') {
      const inv = profile.inventory || [];
      const itemToGive = inv[transferItemIdx];
      if (!itemToGive) return;

      // Cria a solicitação no banco
      const { error } = await supabase.from('trade_requests').insert({
        sender_id: profile.id,
        receiver_id: transferTarget.id,
        item_name: itemToGive.name,
        quantity: 1 // Simplificação: envia 1 por vez para segurança
      });

      if (error) {
        alert("Erro ao enviar solicitação: " + error.message);
      } else {
        alert(`Solicitação de entrega (${itemToGive.name}) enviada para ${transferTarget.username}.\nO item sairá da sua mochila quando ele aceitar.`);
      }

      setTransferModalOpen(false);
      loadData(); // Atualiza UI
    }
  }

  // --- LÓGICA DE ACEITAR/RECUSAR TROCA ---

  async function acceptTrade(trade) {
    // 1. Busca dados atualizados do Remetente
    const { data: sender } = await supabase.from('profiles').select('inventory').eq('id', trade.sender_id).single();
    
    if (!sender) {
      alert("Erro: Remetente não encontrado.");
      await supabase.from('trade_requests').delete().eq('id', trade.id);
      loadData();
      return;
    }

    // 2. Verifica se o remetente AINDA tem o item
    const senderInv = sender.inventory || [];
    const itemIndex = senderInv.findIndex(i => i.name === trade.item_name);

    if (itemIndex === -1 || senderInv[itemIndex].qty < trade.quantity) {
      alert("Falha: O remetente não possui mais este item!");
      // Opcional: deletar a request inválida
      await supabase.from('trade_requests').delete().eq('id', trade.id);
      loadData();
      return;
    }

    // 3. Remove do Remetente
    let newSenderInv = [...senderInv];
    if (newSenderInv[itemIndex].qty > trade.quantity) {
      newSenderInv[itemIndex].qty -= trade.quantity;
    } else {
      newSenderInv.splice(itemIndex, 1);
    }
    
    // 4. Adiciona ao Destinatário (Eu)
    const myInv = profile.inventory || [];
    const limit = profile.slots || 10;
    
    if (myInv.length >= limit && !myInv.find(i => i.name === trade.item_name)) {
        return alert("Sua mochila está cheia! Libere espaço antes de aceitar.");
    }

    let newMyInv = [...myInv];
    const myItemIndex = newMyInv.findIndex(i => i.name === trade.item_name);
    if (myItemIndex >= 0) {
      newMyInv[myItemIndex].qty += trade.quantity;
    } else {
      newMyInv.push({ name: trade.item_name, qty: trade.quantity });
    }

    // 5. Executa as atualizações no banco (Sequencial para evitar erro)
    await supabase.from('profiles').update({ inventory: newSenderInv }).eq('id', trade.sender_id);
    await supabase.from('profiles').update({ inventory: newMyInv }).eq('id', profile.id);
    
    // 6. Apaga a solicitação
    await supabase.from('trade_requests').delete().eq('id', trade.id);

    alert(`Você recebeu ${trade.quantity}x ${trade.item_name}!`);
    loadData();
  }

  async function rejectTrade(tradeId) {
    if (!confirm("Recusar este item?")) return;
    await supabase.from('trade_requests').delete().eq('id', tradeId);
    loadData();
  }

  // Helper para cor do rank
  const getRankColor = (rank) => RANK_COLORS[rank] || '#ccc';

  return (
    <div className={styles.container}>
      {/* MODAL DE SOLICITAÇÃO AO MESTRE */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color:'#fbbf24', fontFamily:'Cinzel', marginBottom:'1rem'}}>O que você encontrou?</h2>
            <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
              <input className="rpg-input" placeholder="Nome do Item" value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{flex: 3}} />
              <input type="number" min="1" className="rpg-input" placeholder="Qtd" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} style={{flex: 1, textAlign:'center'}} />
            </div>
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={requestItem} style={{flex:1, padding:'10px', background:'#064e3b', color:'white', border:'none', borderRadius:'6px', fontWeight:'bold', cursor:'pointer'}}>Solicitar</button>
              <button onClick={() => setIsModalOpen(false)} style={{flex:1, padding:'10px', background:'#7f1d1d', color:'white', border:'none', borderRadius:'6px', fontWeight:'bold', cursor:'pointer'}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENVIO (TROCA) */}
      {transferModalOpen && transferTarget && (
        <div className="modal-overlay" onClick={() => setTransferModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color:'#fbbf24', fontFamily:'Cinzel', marginBottom:'0.5rem'}}>Enviar para {transferTarget.username}</h2>
            <p style={{color:'#888', fontSize:'0.9rem', marginBottom:'1.5rem'}}>O que você deseja compartilhar?</p>
            
            <div style={{display:'flex', gap:'10px', justifyContent:'center', marginBottom:'20px'}}>
              <button onClick={() => setTransferType('gold')} className={styles.tabBtn} style={{borderColor: transferType === 'gold' ? '#fbbf24' : '#444', color: transferType === 'gold' ? '#fbbf24' : '#888'}}>💰 Ouro</button>
              <button onClick={() => setTransferType('item')} className={styles.tabBtn} style={{borderColor: transferType === 'item' ? '#fbbf24' : '#444', color: transferType === 'item' ? '#fbbf24' : '#888'}}>🎒 Item</button>
            </div>

            {transferType === 'gold' ? (
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block', color:'#888', fontSize:'0.8rem', marginBottom:'5px'}}>Quantidade de Ouro (Seu saldo: {profile.gold})</label>
                <input type="number" className="rpg-input" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0" />
                <p style={{fontSize:'0.7rem', color:'#aaa', marginTop:'5px'}}>* Ouro é transferido imediatamente.</p>
              </div>
            ) : (
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block', color:'#888', fontSize:'0.8rem', marginBottom:'5px'}}>Selecione o Item</label>
                {(!profile.inventory || profile.inventory.length === 0) ? (
                  <p style={{color:'#ef4444', fontStyle:'italic'}}>Sua mochila está vazia.</p>
                ) : (
                  <>
                  <select className="rpg-input" value={transferItemIdx} onChange={e => setTransferItemIdx(e.target.value)}>
                    {profile.inventory.map((item, idx) => (
                      <option key={idx} value={idx}>{item.name} (x{item.qty})</option>
                    ))}
                  </select>
                  <p style={{fontSize:'0.7rem', color:'#aaa', marginTop:'5px'}}>* Envia uma solicitação. O item só sai da sua conta quando ele aceitar.</p>
                  </>
                )}
              </div>
            )}

            <button onClick={handleTransfer} className={styles.btnPrimary} style={{width:'100%'}}>Confirmar Envio</button>
          </div>
        </div>
      )}

      {profile && (
        <div className={styles.hud}>
          <div className={styles.charInfo}>
            <h1>{profile.username}</h1>
            <div style={{display:'flex', gap:'10px'}}>
              <span className={styles.rankTag} style={{
                background: `linear-gradient(45deg, ${getRankColor(profile.rank)}dd, #000)`,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)'
              }}>
                RANK {profile.rank || 'F'}
              </span>
              <span className={styles.rankTag} style={{background:'#444'}}>LVL {profile.level || 1}</span>
              {myParty && (
                <span className={styles.rankTag} style={{background:'#064e3b', color:'#a7f3d0'}}>
                  {myParty.name} {myParty.leader_id === profile.id ? '👑' : ''}
                </span>
              )}
            </div>
          </div>
          
          <div className={styles.hudRight}>
            <div className={styles.stats}>
              <div className={styles.statItem}><span className={`${styles.statVal} ${styles.gold}`}>{profile.gold}</span><span className={styles.statLabel}>Ouro</span></div>
              <div className={styles.statItem}><span className={`${styles.statVal} ${styles.xp}`}>{profile.xp}</span><span className={styles.statLabel}>XP</span></div>
            </div>
            <div className={styles.actions}>
              <button onClick={loadData} className={styles.btnHeader}>↻ Atualizar</button>
              <button onClick={handleLogout} className={styles.btnHeader} style={{borderColor:'#7f1d1d', color:'#fca5a5'}}>Sair</button>
            </div>
          </div>
        </div>
      )}

      <nav className={styles.nav}>
        {['missions', 'shop', 'players', 'inv'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`${styles.navBtn} ${tab === t ? styles.active : ''}`}>
            {t === 'missions' && 'Mural'}
            {t === 'shop' && 'Loja'}
            {t === 'players' && 'Aliados'}
            {t === 'inv' && 'Mochila'}
          </button>
        ))}
      </nav>

      <main className={styles.mainContent}>
        {tab === 'missions' && (
          <div className={styles.grid}>
            {missions.map(m => (
              <div key={m.id} className={styles.card} style={{borderLeft:`4px solid ${getRankColor(m.rank)}`}}>
                <div className={styles.cardHeader}>
                  <h3>{m.title}</h3>
                  <span style={{fontSize:'0.8rem', color: getRankColor(m.rank), fontWeight:'bold'}}>RANK {m.rank}</span>
                </div>
                <p className={styles.cardDesc}>"{m.desc || m.description}"</p>
                <div style={{marginTop:'auto', borderTop:'1px solid #333', paddingTop:'10px'}}>
                  <button onClick={() => acceptMission(m)} className={`${styles.btnAction} ${styles.accept}`}>Aceitar</button>
                </div>
              </div>
            ))}
            {missions.length === 0 && <p className={styles.emptyMsg}>Nenhuma missão disponível.</p>}
          </div>
        )}

        {tab === 'shop' && (
          <div className={styles.grid}>
            {shop.map(item => (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardHeader}><h3>{item.name || item.item_name}</h3><span style={{fontSize:'0.8rem', color: item.quantity<5?'#f87171':'#4ade80'}}>Estoque: {item.quantity}</span></div>
                <p className={styles.cardDesc}>{item.desc || item.description}</p>
                <button onClick={() => buyItem(item)} className={`${styles.btnAction} ${styles.buy}`}>Comprar {item.price}g</button>
              </div>
            ))}
            {shop.length === 0 && <p className={styles.emptyMsg}>Loja vazia.</p>}
          </div>
        )}

        {tab === 'players' && (
          <div className={styles.grid}>
             {allPlayers.map(p => {
               const isPartyMember = myParty && p.party_id === myParty.id;
               const isMe = p.id === profile.id;

               return (
                 <div key={p.id} className={styles.card} style={{alignItems:'center', textAlign:'center', borderColor: isPartyMember ? '#22c55e' : '#3b82f6'}}>
                   <div style={{fontSize:'2.5rem', marginBottom:'10px'}}>🛡️</div>
                   <h3 style={{color:'white', margin:0}}>{p.username}</h3>
                   <div style={{display:'flex', gap:'5px', justifyContent:'center', marginTop:'5px'}}>
                     <span style={{color: getRankColor(p.rank), fontSize:'0.7rem', fontWeight:'bold', background:'#111', padding:'2px 6px', borderRadius:'4px', border:`1px solid ${getRankColor(p.rank)}`}}>RANK {p.rank}</span>
                     <span style={{color:'#eab308', fontSize:'0.7rem', fontWeight:'bold', background:'#111', padding:'2px 6px', borderRadius:'4px'}}>LVL {p.level || 1}</span>
                   </div>
                   {isPartyMember && <span style={{fontSize:'0.7rem', color:'#86efac', marginTop:'5px'}}>Seu Grupo</span>}
                   
                   {isPartyMember && !isMe && (
                     <button onClick={() => openTransfer(p)} className={styles.btnAction} style={{marginTop:'15px', background:'#b45309', fontSize:'0.8rem', padding:'8px'}}>
                       🎁 Enviar Recurso
                     </button>
                   )}
                 </div>
               );
             })}
          </div>
        )}

        {tab === 'inv' && (
          <div className={styles.invWrapper}>
             <h2 className={styles.invTitle}>Mochila ({profile?.inventory?.length || 0}/{profile?.slots || 10})</h2>
             
             {/* LISTA DE ITENS */}
             <div className={styles.invGrid}>
                {[...Array(profile?.slots || 10)].map((_, i) => {
                  const item = profile?.inventory?.[i];
                  return (
                    <div key={i} className={`slot ${item ? 'filled' : ''} ${styles.slot}`}>
                      {item ? (
                        <>
                           <div onClick={() => removeItem(i)} className={styles.removeBtn}>-</div>
                           <span className={styles.itemName}>{item.name}</span>
                           <span className={styles.itemQty}>x{item.qty}</span>
                        </>
                      ) : (
                        <button className={styles.addBtn} onClick={() => setIsModalOpen(true)} title="Adicionar">+</button>
                      )}
                    </div>
                  )
                })}
             </div>
             
             {/* SEÇÃO DE ENTREGAS (INCOMING) */}
             {incomingTrades.length > 0 && (
               <div style={{marginTop:'30px', background:'#111', padding:'15px', borderRadius:'8px', border:'1px solid #b45309'}}>
                 <h4 style={{color:'#fbbf24', fontSize:'0.9rem', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px'}}>
                    🎁 Entregas Pendentes ({incomingTrades.length})
                 </h4>
                 <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                   {incomingTrades.map(trade => (
                     <div key={trade.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#222', padding:'10px', borderRadius:'6px'}}>
                        <div>
                          <strong style={{color:'#fff', display:'block'}}>{trade.quantity}x {trade.item_name}</strong>
                          <span style={{fontSize:'0.75rem', color:'#aaa'}}>De: {trade.profiles?.username || 'Desconhecido'}</span>
                        </div>
                        <div style={{display:'flex', gap:'5px'}}>
                          <button onClick={() => acceptTrade(trade)} style={{background:'#166534', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'0.8rem'}}>Aceitar</button>
                          <button onClick={() => rejectTrade(trade.id)} style={{background:'#991b1b', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'0.8rem'}}>Recusar</button>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {/* SEÇÃO DE PEDIDOS AO MESTRE */}
             {myRequests.length > 0 && (
               <div style={{marginTop:'20px', borderTop:'1px solid #333', paddingTop:'10px'}}>
                 <h4 style={{color:'#888', fontSize:'0.8rem', textAlign:'center'}}>Aguardando Mestre:</h4>
                 <div style={{display:'flex', gap:'5px', flexWrap:'wrap', justifyContent:'center'}}>
                   {myRequests.map(r => (
                     <span key={r.id} style={{background:'#222', padding:'4px 8px', borderRadius:'4px', fontSize:'0.7rem', color:'#aaa', border:'1px solid #444'}}>
                       ⏳ {r.quantity}x {r.item_name}
                     </span>
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