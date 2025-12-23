"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './master.module.css';

export default function MasterPanel() {
  const router = useRouter();
  const [missions, setMissions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [parties, setParties] = useState([]); // NOVO: Lista de grupos
  const [requests, setRequests] = useState([]); 
  
  const [form, setForm] = useState({ title: '', desc: '', rank: 'F', xp: 0, gold: 0 });
  const [shopForm, setShopForm] = useState({ seller: '', name: '', price: 0, quantity: 1, desc: '' });
  const [partyForm, setPartyForm] = useState(''); // NOVO: Nome do novo grupo
  
  const [goldMod, setGoldMod] = useState({});
  const [xpMod, setXpMod] = useState({});
  const [levelMod, setLevelMod] = useState({});

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
    const { data: g } = await supabase.from('parties').select('*').order('name', { ascending: true }); // NOVO
    
    const { data: r } = await supabase
      .from('item_requests')
      .select('*, profiles(username)')
      .order('created_at', { ascending: true });

    setMissions(m || []);
    setPlayers(p || []);
    setParties(g || []);
    setRequests(r || []);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // --- GESTÃO DE GRUPOS (NOVO) ---
  async function createParty() {
    if (!partyForm.trim()) return alert("Nome do grupo necessário");
    await supabase.from('parties').insert([{ name: partyForm }]);
    setPartyForm('');
    fetchData();
  }

  async function assignToParty(playerId, partyId) {
    // Se partyId for vazio (string vazia), seta null no banco (sair do grupo)
    const pid = partyId === "" ? null : partyId;
    await supabase.from('profiles').update({ party_id: pid }).eq('id', playerId);
    
    // Se saiu do grupo, verifica se era lider e remove liderança se necessário (opcional, mas bom pra limpeza)
    fetchData();
  }

  async function makeLeader(partyId, playerId) {
    await supabase.from('parties').update({ leader_id: playerId }).eq('id', partyId);
    fetchData();
  }

  // --- ATUALIZAÇÃO DE MISSÃO (LÓGICA DE GRUPO AQUI) ---
  async function updateMission(id, status, playerId, xpReward, goldReward) {
    await supabase.from('missions').update({ status }).eq('id', id);

    if (status === 'completed' && playerId) {
      // 1. Verificar se o jogador que completou está em um grupo
      const player = players.find(p => p.id === playerId);
      
      if (player && player.party_id) {
        // --- LÓGICA DE GRUPO ---
        // Pega todos os membros do grupo
        const members = players.filter(p => p.party_id === player.party_id);
        const memberCount = members.length;

        if (memberCount > 0) {
          const goldSplit = Math.floor(Number(goldReward) / memberCount); // Ouro dividido
          const xpFull = Number(xpReward); // XP igual para todos

          // Atualiza cada membro
          for (const member of members) {
            await supabase.from('profiles').update({
              xp: (member.xp || 0) + xpFull,
              gold: (member.gold || 0) + goldSplit
            }).eq('id', member.id);
          }
          alert(`Missão de Grupo Completada!\nXP para cada: ${xpFull}\nOuro para cada: ${goldSplit} (Total: ${goldReward})`);
        }
      } else {
        // --- LÓGICA SOLO (PADRÃO) ---
        const p = players.find(x => x.id === playerId);
        await supabase.from('profiles').update({ 
          xp: (p.xp || 0) + Number(xpReward), 
          gold: (p.gold || 0) + Number(goldReward) 
        }).eq('id', playerId);
      }
    }
    fetchData();
  }

  // ... (Resto das funções: handleRequest, createMission, addItem, modifyGold, modifyXp, modifyLevel, updateRank, inventory...)
  // MANTIDAS IGUAIS AO CÓDIGO ANTERIOR, APENAS OMITIDAS AQUI PARA ECONOMIZAR ESPAÇO. 
  // VOCÊ DEVE MANTER ELAS NO ARQUIVO FINAL.
  
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
    await supabase.from('missions').insert([{ ...form, status: 'open' }]);
    setForm({ title: '', desc: '', rank: 'F', xp: 0, gold: 0 });
    fetchData();
  }

  async function addItem() {
    if (!shopForm.name) return;
    if (Number(shopForm.price) <= 0 || Number(shopForm.quantity) <= 0) return alert("Valores inválidos!");
    await supabase.from('shop_items').insert([{ ...shopForm }]);
    setShopForm({ seller: '', name: '', price: 0, quantity: 1, desc: '' });
    fetchData();
  }

  async function modifyGold(playerId, amount) {
    if (!amount) return;
    const player = players.find(p => p.id === playerId);
    await supabase.from('profiles').update({ gold: (player.gold || 0) + Number(amount) }).eq('id', playerId);
    setGoldMod(prev => ({ ...prev, [playerId]: '' }));
    fetchData();
  }

  async function modifyXp(playerId, amount) {
    if (!amount) return;
    const player = players.find(p => p.id === playerId);
    await supabase.from('profiles').update({ xp: (player.xp || 0) + Number(amount) }).eq('id', playerId);
    setXpMod(prev => ({ ...prev, [playerId]: '' }));
    fetchData();
  }

  async function modifyLevel(playerId, amount) {
    if (!amount) return;
    const player = players.find(p => p.id === playerId);
    const newLevel = (player.level || 1) + Number(amount);
    if (newLevel < 1) return alert("Nível mínimo é 1!");
    await supabase.from('profiles').update({ level: newLevel }).eq('id', playerId);
    setLevelMod(prev => ({ ...prev, [playerId]: '' }));
    fetchData();
  }

  async function updateRank(playerId, newRank) {
    await supabase.from('profiles').update({ rank: newRank }).eq('id', playerId);
    fetchData();
  }

  function openInventory(player) { 
    setSelectedPlayerForInv(player); 
    setSlotAddQty(1); setMasterItemQty(1); setMasterItemName('');
  }

  async function increaseSlots() {
    if (!selectedPlayerForInv) return;
    const qtd = Number(slotAddQty);
    if (qtd <= 0) return alert("Quantidade inválida");
    const currentSlots = selectedPlayerForInv.slots || 10;
    await supabase.from('profiles').update({ slots: currentSlots + qtd }).eq('id', selectedPlayerForInv.id);
    const { data } = await supabase.from('profiles').select('*').eq('id', selectedPlayerForInv.id).single();
    setSelectedPlayerForInv(data);
    fetchData();
  }

  async function masterAddItemToPlayer() {
    if (!masterItemName.trim() || !selectedPlayerForInv) return;
    const qtd = Number(masterItemQty);
    if (qtd <= 0) return alert("Qtd > 0");
    const currentInv = selectedPlayerForInv.inventory || [];
    const limit = selectedPlayerForInv.slots || 10;
    const idx = currentInv.findIndex(i => i.name.toLowerCase() === masterItemName.toLowerCase());
    let newInv = [...currentInv];
    if (idx >= 0) newInv[idx].qty += qtd;
    else {
      if (currentInv.length >= limit) return alert("Mochila cheia!");
      newInv.push({ name: masterItemName, qty: qtd });
    }
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', selectedPlayerForInv.id);
    setMasterItemName(''); setMasterItemQty(1);
    const { data } = await supabase.from('profiles').select('*').eq('id', selectedPlayerForInv.id).single();
    setSelectedPlayerForInv(data);
    fetchData();
  }

  async function masterRemoveItemFromPlayer(index) {
    if (!selectedPlayerForInv) return;
    const currentInv = selectedPlayerForInv.inventory || [];
    let newInv = [...currentInv];
    if (newInv[index].qty > 1) newInv[index].qty -= 1; else newInv.splice(index, 1);
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', selectedPlayerForInv.id);
    const { data } = await supabase.from('profiles').select('*').eq('id', selectedPlayerForInv.id).single();
    setSelectedPlayerForInv(data);
    fetchData();
  }

  return (
    <div className={styles.container}>
      {/* Modal e Header (Mantidos) */}
      {selectedPlayerForInv && (
        <div className="modal-overlay" onClick={() => setSelectedPlayerForInv(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth:'600px'}}>
            <div style={{borderBottom:'1px solid #333', paddingBottom:'15px', marginBottom:'15px'}}>
              <h2 style={{color:'#fbbf24', fontFamily:'Cinzel', margin:'0 0 10px 0'}}>Mochila de {selectedPlayerForInv.username}</h2>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#111', padding:'10px', borderRadius:'6px'}}>
                <span style={{color:'#888', fontSize:'0.9rem'}}>Capacidade: <strong style={{color:'#fff'}}>{selectedPlayerForInv.slots || 10}</strong> slots</span>
                <div style={{display:'flex', gap:'5px', alignItems:'center'}}>
                  <input type="number" min="1" className="rpg-input" style={{width:'60px', padding:'5px', textAlign:'center'}} value={slotAddQty} onChange={e => setSlotAddQty(e.target.value)} />
                  <button onClick={increaseSlots} style={{background:'#2563eb', color:'white', border:'none', padding:'6px 12px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'0.8rem'}}>+ SLOTS</button>
                </div>
              </div>
            </div>
            <div style={{display:'flex', gap:'5px', marginBottom:'20px', background:'#1a1a1a', padding:'10px', borderRadius:'6px'}}>
               <input className="rpg-input" placeholder="Nome do Item" value={masterItemName} onChange={e => setMasterItemName(e.target.value)} style={{flex:2}} />
               <input type="number" min="1" className="rpg-input" placeholder="Qtd" value={masterItemQty} onChange={e => setMasterItemQty(e.target.value)} style={{width:'70px', textAlign:'center'}} />
               <button onClick={masterAddItemToPlayer} style={{background:'#15803d', color:'#fff', border:'none', padding:'0 15px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>ADD</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(60px, 1fr))', gap:'8px', maxHeight:'300px', overflowY:'auto'}}>
              {[...Array(selectedPlayerForInv.slots || 10)].map((_, i) => {
                const item = selectedPlayerForInv.inventory?.[i];
                return (
                  <div key={i} className={styles.invSlot}>
                    {item ? (
                      <>
                        <div onClick={() => masterRemoveItemFromPlayer(i)} className={styles.invRemoveBtn}>-</div>
                        <span className={styles.invItemName}>{item.name}</span>
                        <span className={styles.invItemQty}>x{item.qty}</span>
                      </>
                    ) : <span style={{fontSize:'0.6rem', color:'#333'}}>Vazio</span>}
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
        {/* NOVA MISSÃO */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>📜 Nova Missão</h2>
          <div className={styles.inputGroup}><label className={styles.label}>Título</label><input className={styles.input} placeholder="Título da Missão" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className={styles.inputGroup}><label className={styles.label}>Descrição</label><textarea className={styles.input} placeholder="Detalhes..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} rows={3} /></div>
          <div className={styles.row}>
            <div className={styles.inputGroup}><label className={styles.label} style={{color:'#60a5fa'}}>XP</label><input className={styles.input} type="number" value={form.xp} onChange={e => setForm({...form, xp: e.target.value})} /></div>
            <div className={styles.inputGroup}><label className={styles.label} style={{color:'#fbbf24'}}>Ouro</label><input className={styles.input} type="number" value={form.gold} onChange={e => setForm({...form, gold: e.target.value})} /></div>
            <div className={styles.inputGroup}><label className={styles.label} style={{color:'#a8a29e'}}>Rank</label><select className={styles.input} value={form.rank} onChange={e => setForm({...form, rank: e.target.value})}>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          </div>
          <button onClick={createMission} className={styles.btnPrimary}>Publicar</button>
        </section>

        {/* JOGADORES (ATUALIZADO COM GRUPOS) */}
        <section className={styles.card}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', borderBottom:'1px solid #444', paddingBottom:'10px'}}>
             <h2 className={styles.cardTitle} style={{border:'none', padding:0, margin:0}}>👥 Jogadores</h2>
             <div style={{display:'flex', gap:'5px'}}>
               <input className="rpg-input" placeholder="Novo Grupo" value={partyForm} onChange={e => setPartyForm(e.target.value)} style={{width:'120px', padding:'6px', fontSize:'0.8rem'}} />
               <button onClick={createParty} style={{background:'#3f6212', color:'white', border:'none', padding:'6px', borderRadius:'4px', fontWeight:'bold', fontSize:'0.7rem'}}>CRIAR</button>
             </div>
          </div>

          <div className={styles.scrollableList}>
            {players.map(p => {
              const currentParty = parties.find(party => party.id === p.party_id);
              const isLeader = currentParty?.leader_id === p.id;

              return (
                <div key={p.id} className={styles.playerItem}>
                  <div className={styles.playerHeader}>
                    <div style={{display:'flex', flexDirection:'column'}}>
                      <span style={{color:'#fff'}}>{p.username} {isLeader && '👑'}</span>
                      {/* Seletor de Grupo */}
                      <div style={{marginTop:'5px', display:'flex', alignItems:'center', gap:'5px'}}>
                        <select 
                          className="rpg-input" 
                          style={{padding:'2px', fontSize:'0.7rem', width:'100px'}}
                          value={p.party_id || ""}
                          onChange={(e) => assignToParty(p.id, e.target.value)}
                        >
                          <option value="">Sem Grupo</option>
                          {parties.map(party => <option key={party.id} value={party.id}>{party.name}</option>)}
                        </select>
                        {p.party_id && !isLeader && (
                          <button onClick={() => makeLeader(p.party_id, p.id)} title="Tornar Líder" style={{fontSize:'0.8rem', background:'none', border:'none', cursor:'pointer'}}>👑</button>
                        )}
                      </div>
                    </div>

                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                      <button onClick={() => openInventory(p)} title="Mochila" style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem'}}>🎒</button>
                      <select value={p.rank || 'F'} onChange={(e) => updateRank(p.id, e.target.value)} style={{background:'#000', color:'#fbbf24', border:'1px solid #444', borderRadius:'4px', fontSize:'0.7rem', padding:'2px'}}>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select>
                    </div>
                  </div>
                  
                  <div className={styles.resourceRow}><span style={{color:'#fbbf24', fontSize:'0.9rem'}}>💰 {p.gold}</span><div style={{display:'flex', gap:'5px'}}><input className={styles.miniInput} placeholder="+/-" onChange={e => setGoldMod({...goldMod, [p.id]: e.target.value})} value={goldMod[p.id] || ''} /><button className={`${styles.miniBtn} ${styles.add}`} onClick={() => modifyGold(p.id, goldMod[p.id])}>+</button><button className={`${styles.miniBtn} ${styles.rem}`} onClick={() => modifyGold(p.id, -(goldMod[p.id]))}>-</button></div></div>
                  <div className={styles.resourceRow}><span style={{color:'#60a5fa', fontSize:'0.9rem'}}>✨ {p.xp}</span><div style={{display:'flex', gap:'5px'}}><input className={styles.miniInput} placeholder="+/-" onChange={e => setXpMod({...xpMod, [p.id]: e.target.value})} value={xpMod[p.id] || ''} /><button className={`${styles.miniBtn} ${styles.add}`} style={{background:'#2563eb'}} onClick={() => modifyXp(p.id, xpMod[p.id])}>+</button><button className={`${styles.miniBtn} ${styles.rem}`} style={{background:'#7c3aed'}} onClick={() => modifyXp(p.id, -(xpMod[p.id]))}>-</button></div></div>
                  <div className={styles.resourceRow}><span style={{color:'#fff', fontSize:'0.9rem'}}>Nível {p.level || 1}</span><div style={{display:'flex', gap:'5px'}}><input className={styles.miniInput} placeholder="+/-" onChange={e => setLevelMod({...levelMod, [p.id]: e.target.value})} value={levelMod[p.id] || ''} /><button className={`${styles.miniBtn} ${styles.add}`} style={{background:'#eab308', color:'black'}} onClick={() => modifyLevel(p.id, levelMod[p.id])}>+</button><button className={`${styles.miniBtn} ${styles.rem}`} style={{background:'#78350f'}} onClick={() => modifyLevel(p.id, -(levelMod[p.id]))}>-</button></div></div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ESTOQUE, SOLICITAÇÕES, CONTRATOS (MANTIDOS) */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>⚖️ Estoque da Loja</h2>
          <div className={styles.inputGroup}><label className={styles.label}>Vendedor</label><input className={styles.input} placeholder="Nome do Vendedor" value={shopForm.seller} onChange={e => setShopForm({...shopForm, seller: e.target.value})} /></div>
          <div className={styles.inputGroup}><label className={styles.label}>Item</label><input className={styles.input} placeholder="Nome do Item" value={shopForm.name} onChange={e => setShopForm({...shopForm, name: e.target.value})} /></div>
          <div className={styles.row}>
             <div className={styles.inputGroup}><label className={styles.label}>Valor (Ouro)</label><input className={styles.input} type="number" min="1" value={shopForm.price} onChange={e => setShopForm({...shopForm, price: e.target.value})} /></div>
             <div className={styles.inputGroup}><label className={styles.label}>Qtd</label><input className={styles.input} type="number" min="1" value={shopForm.quantity} onChange={e => setShopForm({...shopForm, quantity: e.target.value})} /></div>
          </div>
          <button onClick={addItem} className={styles.btnPrimary} style={{marginTop:'auto'}}>Estocar</button>
        </section>

        <section className={styles.card} style={{borderColor: requests.length > 0 ? '#3b82f6' : 'var(--border-gold)'}}>
          <h2 className={styles.cardTitle}>📦 Solicitações ({requests.length})</h2>
          <div className={styles.scrollableListSmall}>
            {requests.length === 0 && <p style={{color:'#666', fontStyle:'italic', textAlign:'center'}}>Nenhum pedido pendente.</p>}
            {requests.map(req => (
              <div key={req.id} className={styles.requestItem}>
                <div><strong style={{color:'#fff', display:'block'}}>{req.quantity}x {req.item_name}</strong><span style={{fontSize:'0.8rem', color:'#888'}}>Jogador: {req.profiles?.username}</span></div>
                <div style={{display:'flex', gap:'5px'}}>
                  <button onClick={() => handleRequest(req, true)} className={styles.btnApprove} title="Aceitar">✓</button>
                  <button onClick={() => handleRequest(req, false)} className={styles.btnReject} title="Recusar">✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>⚔️ Contratos Ativos</h2>
          <div className={styles.scrollableListSmall}>
            {missions.length === 0 && <p style={{color:'#666', fontStyle:'italic', textAlign:'center'}}>Nenhum contrato ativo.</p>}
            {missions.filter(m => m.status === 'in_progress').map(m => (
              <div key={m.id} className={styles.requestItem} style={{borderLeftColor:'#fbbf24'}}>
                <div><strong style={{color:'#fff'}}>{m.title}</strong><span style={{fontSize:'0.8rem', color:'#aaa'}}>Herói: {players.find(p => p.id === m.assigned_to)?.username}</span></div>
                <div style={{display:'flex', gap:'5px'}}>
                  <button onClick={() => updateMission(m.id, 'completed', m.assigned_to, m.xp_reward, m.gold_reward)} className={styles.btnApprove} title="Completar">✓</button>
                  <button onClick={() => updateMission(m.id, 'failed', m.assigned_to, 0, 0)} className={styles.btnReject} title="Falhar">✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}