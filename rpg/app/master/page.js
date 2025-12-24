"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './master.module.css';

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

export default function MasterPanel() {
  const router = useRouter();
  const [missions, setMissions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [parties, setParties] = useState([]); 
  const [requests, setRequests] = useState([]); 
  
  const [form, setForm] = useState({ title: '', desc: '', rank: 'F', xp: '', gold: '' });
  const [shopForm, setShopForm] = useState({ seller: '', name: '', price: '', quantity: 1, desc: '' });
  const [partyForm, setPartyForm] = useState('');
  
  const [goldMod, setGoldMod] = useState({});
  const [xpMod, setXpMod] = useState({});
  
  const [selectedPlayerForInv, setSelectedPlayerForInv] = useState(null);
  const [masterItemName, setMasterItemName] = useState('');
  const [masterItemQty, setMasterItemQty] = useState(1);
  const [slotAddQty, setSlotAddQty] = useState(1);

  const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: m } = await supabase.from('missions').select('*').order('created_at', { ascending: false });
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'player').order('username', { ascending: true });
    const { data: g } = await supabase.from('parties').select('*').order('name', { ascending: true });
    const { data: r } = await supabase.from('item_requests').select('*, profiles(username)').order('created_at', { ascending: true });

    setMissions(m || []);
    setPlayers(p || []);
    setParties(g || []);
    setRequests(r || []);
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  function calculateLevel(totalXp) {
    let newLevel = 1;
    for (let i = 0; i < XP_TABLE.length; i++) {
      if (totalXp >= XP_TABLE[i].xp) {
        newLevel = XP_TABLE[i].lvl;
      } else {
        break; 
      }
    }
    return newLevel;
  }

  async function updatePlayerXpAndLevel(playerId, amountXP, amountGold = 0) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const newXp = Math.max(0, (player.xp || 0) + Number(amountXP));
    const newGold = Math.max(0, (player.gold || 0) + Number(amountGold));
    const newLevel = calculateLevel(newXp);

    await supabase.from('profiles').update({ 
      xp: newXp, 
      gold: newGold,
      level: newLevel 
    }).eq('id', playerId);
    
    fetchData();
  }

  async function createParty() {
    if (!partyForm.trim()) return alert("Nome do grupo necessário");
    const { error } = await supabase.from('parties').insert([{ name: partyForm }]);
    if (error) return alert("Erro: " + error.message);
    setPartyForm(''); fetchData();
  }

  async function assignToParty(playerId, partyId) {
    const pid = partyId === "" ? null : partyId;
    await supabase.from('profiles').update({ party_id: pid }).eq('id', playerId);
    fetchData();
  }

  async function makeLeader(partyId, playerId) {
    await supabase.from('parties').update({ leader_id: playerId }).eq('id', partyId);
    fetchData();
  }

  async function updateMission(id, status, playerId, xpReward, goldReward) {
    const { error } = await supabase.from('missions').update({ status }).eq('id', id);
    if (error) return alert("Erro: " + error.message);

    if (status === 'completed' && playerId) {
      const player = players.find(p => p.id === playerId);
      if (player && player.party_id) {
        const members = players.filter(p => p.party_id === player.party_id);
        const memberCount = members.length;
        if (memberCount > 0) {
          const goldSplit = Math.floor(Number(goldReward) / memberCount); 
          const xpFull = Number(xpReward); 
          for (const member of members) {
            await updatePlayerXpAndLevel(member.id, xpFull, goldSplit);
          }
          alert(`Grupo recompensado!`);
        }
      } else {
        await updatePlayerXpAndLevel(playerId, xpReward, goldReward);
      }
    }
    fetchData();
  }

  async function deleteMission(id) {
    if (!confirm("Apagar missão do mural?")) return;
    const { error } = await supabase.from('missions').delete().eq('id', id);
    if (error) alert("Erro: " + error.message);
    fetchData();
  }
  
  async function handleRequest(request, approved) {
    if (approved) {
      const { data: player } = await supabase.from('profiles').select('inventory, slots').eq('id', request.player_id).single();
      const currentInv = player.inventory || [];
      const limit = player.slots || 10;
      const existingIndex = currentInv.findIndex(i => i.name.toLowerCase() === request.item_name.toLowerCase());
      let newInv = [...currentInv];
      const qtyToAdd = request.quantity || 1; 
      if (existingIndex >= 0) { newInv[existingIndex].qty += qtyToAdd; } 
      else {
        if (currentInv.length >= limit) return alert("Mochila cheia!");
        newInv.push({ name: request.item_name, qty: qtyToAdd });
      }
      await supabase.from('profiles').update({ inventory: newInv }).eq('id', request.player_id);
    }
    await supabase.from('item_requests').delete().eq('id', request.id);
    fetchData();
  }

  async function createMission() {
    if (!form.title) return alert("Título necessário!");
    const payload = { title: form.title, description: form.desc, rank: form.rank, xp_reward: Number(form.xp), gold_reward: Number(form.gold), status: 'open' };
    const { error } = await supabase.from('missions').insert([payload]);
    if (error) return alert("Erro: " + error.message);
    setForm({ title: '', desc: '', rank: 'F', xp: '', gold: '' });
    fetchData();
  }

  async function addItem() {
    if (!shopForm.name) return alert("Nome necessário!");
    const payload = { item_name: shopForm.name, price: Number(shopForm.price), quantity: shopForm.quantity, description: shopForm.desc };
    const { error } = await supabase.from('shop_items').insert([payload]);
    if (error) return alert("Erro: " + error.message);
    setShopForm({ seller: '', name: '', price: '', quantity: 1, desc: '' });
    fetchData();
  }

  async function modifyGold(playerId, amount) { 
    if (!amount) return; 
    await updatePlayerXpAndLevel(playerId, 0, amount);
    setGoldMod(prev => ({ ...prev, [playerId]: '' })); 
  }

  async function modifyXp(playerId, amount) { 
    if (!amount) return; 
    await updatePlayerXpAndLevel(playerId, amount, 0);
    setXpMod(prev => ({ ...prev, [playerId]: '' })); 
  }

  async function updateRank(playerId, newRank) { 
    await supabase.from('profiles').update({ rank: newRank }).eq('id', playerId); 
    fetchData(); 
  }

  function openInventory(player) { setSelectedPlayerForInv(player); setSlotAddQty(1); setMasterItemQty(1); setMasterItemName(''); }
  
  async function increaseSlots() { 
    if (!selectedPlayerForInv) return; 
    const qtd = Number(slotAddQty); 
    if (qtd <= 0) return; 
    await supabase.from('profiles').update({ slots: (selectedPlayerForInv.slots||10) + qtd }).eq('id', selectedPlayerForInv.id); 
    const { data } = await supabase.from('profiles').select('*').eq('id', selectedPlayerForInv.id).single(); 
    setSelectedPlayerForInv(data); fetchData(); 
  }
  
  async function masterAddItemToPlayer() {
    if (!masterItemName.trim() || !selectedPlayerForInv) return;
    const qtd = Number(masterItemQty); if (qtd <= 0) return;
    const currentInv = selectedPlayerForInv.inventory || [];
    const idx = currentInv.findIndex(i => i.name.toLowerCase() === masterItemName.toLowerCase());
    let newInv = [...currentInv];
    if (idx >= 0) newInv[idx].qty += qtd; else { if (currentInv.length >= (selectedPlayerForInv.slots||10)) return alert("Mochila cheia!"); newInv.push({ name: masterItemName, qty: qtd }); }
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', selectedPlayerForInv.id);
    const { data } = await supabase.from('profiles').select('*').eq('id', selectedPlayerForInv.id).single(); 
    setSelectedPlayerForInv(data); setMasterItemName(''); fetchData();
  }
  
  async function masterRemoveItemFromPlayer(index) {
    if (!selectedPlayerForInv) return;
    const currentInv = selectedPlayerForInv.inventory || [];
    let newInv = [...currentInv];
    if (newInv[index].qty > 1) newInv[index].qty -= 1; else newInv.splice(index, 1);
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', selectedPlayerForInv.id);
    const { data } = await supabase.from('profiles').select('*').eq('id', selectedPlayerForInv.id).single(); 
    setSelectedPlayerForInv(data); fetchData();
  }

  return (
    <div className={styles.container}>
      {/* MODAL INVENTÁRIO */}
      {selectedPlayerForInv && (
        <div className="modal-overlay" onClick={() => setSelectedPlayerForInv(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth:'600px'}}>
            <h2 style={{color:'#fbbf24', margin:'0 0 10px 0'}}>Mochila de {selectedPlayerForInv.username}</h2>
            <div style={{display:'flex', gap:'5px', marginBottom:'20px'}}>
               <input className="rpg-input" placeholder="Item" value={masterItemName} onChange={e => setMasterItemName(e.target.value)} style={{flex:2}} />
               <input type="number" min="1" className="rpg-input" placeholder="Qtd" value={masterItemQty} onChange={e => setMasterItemQty(e.target.value)} style={{width:'70px'}} />
               <button onClick={masterAddItemToPlayer} style={{background:'#15803d', color:'#fff', border:'none', padding:'0 15px', borderRadius:'4px', cursor:'pointer'}}>ADD</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(60px, 1fr))', gap:'8px', maxHeight:'300px', overflowY:'auto'}}>
              {[...Array(selectedPlayerForInv.slots || 10)].map((_, i) => {
                const item = selectedPlayerForInv.inventory?.[i];
                return (
                  <div key={i} className={styles.invSlot}>
                    {item ? (<><div onClick={() => masterRemoveItemFromPlayer(i)} className={styles.invRemoveBtn}>-</div><span className={styles.invItemName}>{item.name}</span><span className={styles.invItemQty}>x{item.qty}</span></>) : <span style={{fontSize:'0.6rem', color:'#333'}}>Vazio</span>}
                  </div>
                )
              })}
            </div>
            <button onClick={() => setSelectedPlayerForInv(null)} style={{marginTop:'20px', background:'transparent', border:'1px solid #555', color:'#888', padding:'8px 20px', cursor:'pointer', borderRadius:'4px'}}>Fechar</button>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>Painel do Mestre</h1>
        <div className={styles.actions}>
          <button onClick={fetchData} className={styles.btnHeader}>↻ Atualizar</button>
          <button onClick={handleLogout} className={styles.btnHeader} style={{borderColor:'#7f1d1d', color:'#fca5a5'}}>Sair</button>
        </div>
      </header>

      <div className={styles.grid}>
        
        {/* COLUNA 1: MISSÕES */}
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>📜 Nova Missão</h2>
            <div className={styles.inputGroup}><label className={styles.label}>Título</label><input className={styles.input} placeholder="Título" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className={styles.inputGroup}><label className={styles.label}>Descrição</label><textarea className={styles.input} placeholder="Detalhes..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} rows={3} /></div>
            <div className={styles.row}>
              <div className={styles.inputGroup}><label className={styles.label}>XP</label><input className={styles.input} type="number" value={form.xp} onChange={e => setForm({...form, xp: e.target.value})} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>Ouro</label><input className={styles.input} type="number" value={form.gold} onChange={e => setForm({...form, gold: e.target.value})} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>Rank</label><select className={styles.input} value={form.rank} onChange={e => setForm({...form, rank: e.target.value})}>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
            <button onClick={createMission} className={styles.btnPrimary}>Publicar</button>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>📌 Mural (Abertas)</h2>
            <div className={styles.scrollableListSmall}>
              {missions.filter(m => m.status === 'open').length === 0 && <p style={{color:'#666', textAlign:'center'}}>Vazio</p>}
              {missions.filter(m => m.status === 'open').map(m => (
                <div key={m.id} className={styles.requestItem} style={{borderLeftColor: RANK_COLORS[m.rank]}}>
                  <div><strong style={{color:'#fff'}}>{m.title}</strong><div style={{fontSize:'0.75rem', color:'#aaa'}}>{m.rank} | XP:{m.xp_reward} G:{m.gold_reward}</div></div>
                  <button onClick={() => deleteMission(m.id)} className={styles.btnReject}>🗑️</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* COLUNA 2: LOJA E SOLICITAÇÕES */}
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>⚖️ Estoque</h2>
            <div className={styles.inputGroup}><label className={styles.label}>Item</label><input className={styles.input} placeholder="Nome" value={shopForm.name} onChange={e => setShopForm({...shopForm, name: e.target.value})} /></div>
            <div className={styles.inputGroup}><label className={styles.label}>Descrição</label><textarea className={styles.input} placeholder="Efeitos..." rows={2} value={shopForm.desc} onChange={e => setShopForm({...shopForm, desc: e.target.value})} /></div>
            <div className={styles.row}>
               <div className={styles.inputGroup}><label className={styles.label}>Valor</label><input className={styles.input} type="number" min="1" value={shopForm.price} onChange={e => setShopForm({...shopForm, price: e.target.value})} /></div>
               <div className={styles.inputGroup}><label className={styles.label}>Qtd</label><input className={styles.input} type="number" min="1" value={shopForm.quantity} onChange={e => setShopForm({...shopForm, quantity: e.target.value})} /></div>
            </div>
            <button onClick={addItem} className={styles.btnPrimary} style={{marginTop:'auto'}}>Estocar</button>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>📦 Solicitações ({requests.length})</h2>
            <div className={styles.scrollableListSmall}>
              {requests.length === 0 && <p style={{color:'#666', textAlign:'center'}}>Vazio.</p>}
              {requests.map(req => (
                <div key={req.id} className={styles.requestItem}>
                  <div><strong style={{color:'#fff'}}>{req.quantity}x {req.item_name}</strong><span style={{fontSize:'0.8rem', color:'#888'}}>{req.profiles?.username}</span></div>
                  <div style={{display:'flex', gap:'5px'}}>
                    <button onClick={() => handleRequest(req, true)} className={styles.btnApprove}>✓</button>
                    <button onClick={() => handleRequest(req, false)} className={styles.btnReject}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* COLUNA 3: JOGADORES */}
        <div className={styles.column}>
          <section className={styles.card}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #444', paddingBottom:'10px', marginBottom:'10px', width:'100%'}}>
               <h2 className={styles.cardTitle} style={{border:'none', margin:0, padding:0, width:'auto', textAlign:'left'}}>👥 Jogadores</h2>
               <div style={{display:'flex', gap:'5px'}}>
                 <input className="rpg-input" placeholder="Novo Grupo" value={partyForm} onChange={e => setPartyForm(e.target.value)} style={{width:'80px', padding:'4px', fontSize:'0.7rem', textAlign:'center'}} />
                 <button onClick={createParty} style={{background:'#3f6212', color:'white', border:'none', padding:'4px', borderRadius:'4px', fontSize:'0.7rem'}}>CRIAR</button>
               </div>
            </div>
            <div className={styles.scrollableList}>
              {players.map(p => {
                const currentParty = parties.find(party => party.id === p.party_id);
                // Define a cor baseada no Rank
                const rankColor = RANK_COLORS[p.rank] || RANK_COLORS['F'];
                
                return (
                  <div key={p.id} className={styles.playerItem}>
                    <div className={styles.playerHeader}>
                      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start'}}>
                        <span style={{color:'#fff', fontWeight:'bold'}}>
                          {p.username} {currentParty?.leader_id === p.id && <span title="Líder">👑</span>}
                        </span>
                        
                        <div style={{display:'flex', gap:'5px', marginTop:'5px', alignItems:'center'}}>
                          {/* SELECT GRUPO */}
                          <select 
                            className="rpg-input" 
                            style={{padding:'2px', fontSize:'0.7rem', width:'90px'}} 
                            value={p.party_id || ""} 
                            onChange={(e) => assignToParty(p.id, e.target.value)}
                          >
                            <option value="">Sem Grupo</option>
                            {parties.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>

                          {/* BOTÃO NOMEAR LÍDER (Só aparece se tiver grupo e NÃO for o líder) */}
                          {p.party_id && currentParty?.leader_id !== p.id && (
                            <button 
                              onClick={() => makeLeader(p.party_id, p.id)} 
                              title="Tornar Líder"
                              style={{background:'transparent', border:'1px solid #fbbf24', cursor:'pointer', fontSize:'0.8rem', padding:'2px 4px', borderRadius:'4px'}}
                            >
                              👑
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{display:'flex', gap:'5px', alignItems:'center'}}>
                        <button onClick={() => openInventory(p)} title="Mochila" style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem'}}>🎒</button>
                        {/* SELECT RANK */}
                        <select 
                          value={p.rank || 'F'} 
                          onChange={(e) => updateRank(p.id, e.target.value)} 
                          style={{
                            background: 'transparent', 
                            color: rankColor, 
                            border: `1px solid ${rankColor}`, 
                            borderRadius:'4px', 
                            fontSize:'0.7rem', 
                            padding:'2px', 
                            fontWeight:'bold'
                          }}
                        >
                          {RANKS.map(r => <option key={r} value={r} style={{color: RANK_COLORS[r], background:'#000'}}>{r}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* RECURSOS: OURO */}
                    <div className={styles.resourceRow}>
                      <span style={{color:'#fbbf24'}}>💰 {p.gold}</span>
                      <div style={{display:'flex', gap:'2px', alignItems:'center'}}>
                        <input className={styles.miniInput} onChange={e => setGoldMod({...goldMod, [p.id]: e.target.value})} value={goldMod[p.id] || ''} placeholder="0" />
                        <button onClick={() => modifyGold(p.id, goldMod[p.id])} className={styles.miniBtn} style={{color:'#4ade80'}} title="Adicionar">+</button>
                        <button onClick={() => modifyGold(p.id, -(goldMod[p.id]))} className={styles.miniBtn} style={{color:'#f87171'}} title="Remover">-</button>
                      </div>
                    </div>

                    {/* RECURSOS: XP */}
                    <div className={styles.resourceRow}>
                      <span style={{color:'#60a5fa'}}>✨ {p.xp} (Lvl {p.level})</span>
                      <div style={{display:'flex', gap:'2px', alignItems:'center'}}>
                        <input className={styles.miniInput} onChange={e => setXpMod({...xpMod, [p.id]: e.target.value})} value={xpMod[p.id] || ''} placeholder="0" />
                        <button onClick={() => modifyXp(p.id, xpMod[p.id])} className={styles.miniBtn} style={{color:'#4ade80'}} title="Adicionar">+</button>
                        <button onClick={() => modifyXp(p.id, -(xpMod[p.id]))} className={styles.miniBtn} style={{color:'#f87171'}} title="Remover">-</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>⚔️ Contratos Ativos</h2>
            <div className={styles.scrollableListSmall}>
              {missions.filter(m => m.status === 'in_progress').length === 0 && <p style={{color:'#666', textAlign:'center'}}>Vazio.</p>}
              {missions.filter(m => m.status === 'in_progress').map(m => (
                <div key={m.id} className={styles.requestItem} style={{borderLeftColor:'#fbbf24'}}>
                  <div><strong style={{color:'#fff'}}>{m.title}</strong><span style={{fontSize:'0.7rem', color:'#aaa', display:'block'}}>Herói: {players.find(p => p.id === m.assigned_to)?.username}</span></div>
                  <div style={{display:'flex', gap:'5px'}}>
                    <button onClick={() => updateMission(m.id, 'completed', m.assigned_to, m.xp_reward, m.gold_reward)} className={styles.btnApprove}>✓</button>
                    <button onClick={() => updateMission(m.id, 'failed', m.assigned_to, 0, 0)} className={styles.btnReject}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}