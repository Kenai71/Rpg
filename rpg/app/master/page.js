"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './master.module.css';
import Logo from '../components/Logo';
import { 
  RefreshCw, LogOut, Plus, Trash2, 
  Check, X, ShoppingBag, Scroll, Users, Backpack, 
  Crown, Coins, Sparkles, Zap, MessageSquare, Bot
} from 'lucide-react';

const RANK_COLORS = {
  'F': '#94a3b8', 'E': '#4ade80', 'D': '#60a5fa',
  'C': '#a78bfa', 'B': '#f87171', 'A': '#fbbf24', 'S': '#22d3ee'
};

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

export default function MasterPanel() {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState('purple');
  const [missions, setMissions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [parties, setParties] = useState([]); 
  const [requests, setRequests] = useState([]); 
  const [shopItems, setShopItems] = useState([]); 
  const [isGenerating, setIsGenerating] = useState(false); // Estado para o loading da IA
  
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

    const channel = supabase
      .channel('master-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_requests' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_items' }, () => fetchData())
      .subscribe();

    const interval = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  async function fetchData() {
    const [
      { data: m },
      { data: p },
      { data: g },
      { data: r },
      { data: s }
    ] = await Promise.all([
      supabase.from('missions').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'player').order('username', { ascending: true }),
      supabase.from('parties').select('*').order('name', { ascending: true }),
      supabase.from('item_requests').select('*, profiles(username)').order('created_at', { ascending: true }),
      supabase.from('shop_items').select('*').order('item_name', { ascending: true })
    ]);

    setMissions(m || []);
    setPlayers(p || []);
    setParties(g || []);
    setRequests(r || []);
    setShopItems(s || []); 
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  // --- FUNÇÃO NOVA: CHAMAR A IA ---
  async function generateDailyContent() {
    setIsGenerating(true);
    try {
      // Chama a rota da API que criamos
      const res = await fetch('/api/daily-generate');
      const data = await res.json();
      
      if (data.success) {
        alert(`Sucesso!\nMissão: "${data.created.mission.title}"\nItem: "${data.created.shop_item.item_name}"`);
        fetchData(); // Atualiza a tela imediatamente
      } else {
        alert("Erro na IA: " + (data.error || "Desconhecido"));
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }

  function calculateLevel(totalXp) {
    let newLevel = 1;
    for (let i = 0; i < XP_TABLE.length; i++) {
      if (totalXp >= XP_TABLE[i].xp) newLevel = XP_TABLE[i].lvl; else break; 
    }
    return newLevel;
  }

  async function updatePlayerXpAndLevel(playerId, amountXP, amountGold = 0) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const newXp = Math.max(0, (player.xp || 0) + Number(amountXP));
    const newGold = Math.max(0, (player.gold || 0) + Number(amountGold));
    const newLevel = calculateLevel(newXp);
    
    await supabase.from('profiles').update({ xp: newXp, gold: newGold, level: newLevel }).eq('id', playerId);
  }

  async function createParty() {
    if (!partyForm.trim()) return alert("Nome necessário");
    const { error } = await supabase.from('parties').insert([{ name: partyForm }]);
    if (error) return alert(error.message);
    setPartyForm(''); 
  }

  async function assignToParty(playerId, partyId) {
    const pid = partyId === "" ? null : partyId;
    await supabase.from('profiles').update({ party_id: pid }).eq('id', playerId);
  }

  async function makeLeader(partyId, playerId) {
    await supabase.from('parties').update({ leader_id: playerId }).eq('id', partyId);
    fetchData(); 
  }

  async function updateMission(id, status, playerId, xpReward, goldReward) {
    const { error } = await supabase.from('missions').update({ status }).eq('id', id);
    if (error) return alert(error.message);
    if (status === 'completed' && playerId) {
      const player = players.find(p => p.id === playerId);
      if (player && player.party_id) {
        const members = players.filter(p => p.party_id === player.party_id);
        if (members.length > 0) {
          const goldSplit = Math.floor(Number(goldReward) / members.length); 
          for (const member of members) await updatePlayerXpAndLevel(member.id, xpReward, goldSplit);
          alert(`Grupo recompensado!`);
        }
      } else {
        await updatePlayerXpAndLevel(playerId, xpReward, goldReward);
      }
    }
  }

  async function deleteMission(id) {
    if (!confirm("Apagar?")) return;
    await supabase.from('missions').delete().eq('id', id);
  }
  
  async function handleRequest(request, approved) {
    if (approved) {
      const { data: player } = await supabase.from('profiles').select('inventory, slots').eq('id', request.player_id).single();
      let newInv = player.inventory || [];
      const itemToAddName = request.item_name === "SOLICITACAO_ROLETA" ? "Gacha Gift" : request.item_name;
      const existingIndex = newInv.findIndex(i => i.name.toLowerCase() === itemToAddName.toLowerCase());
      const qtyToAdd = request.quantity || 1; 

      if (existingIndex >= 0) newInv[existingIndex].qty += qtyToAdd; 
      else {
        if (newInv.length >= (player.slots || 10)) return alert("Mochila cheia!");
        newInv.push({ name: itemToAddName, qty: qtyToAdd });
      }
      await supabase.from('profiles').update({ inventory: newInv }).eq('id', request.player_id);
    }
    await supabase.from('item_requests').delete().eq('id', request.id);
  }

  async function createMission() {
    if (!form.title) return alert("Título necessário!");
    const payload = { title: form.title, description: form.desc, rank: form.rank, xp_reward: Number(form.xp), gold_reward: Number(form.gold), status: 'open' };
    await supabase.from('missions').insert([payload]);
    setForm({ title: '', desc: '', rank: 'F', xp: '', gold: '' });
  }

  async function addItem() {
    if (!shopForm.name) return alert("Nome necessário!");
    const payload = { item_name: shopForm.name, price: Number(shopForm.price), quantity: shopForm.quantity, description: shopForm.desc };
    await supabase.from('shop_items').insert([payload]);
    setShopForm({ seller: '', name: '', price: '', quantity: 1, desc: '' });
    fetchData(); 
  }

  async function deleteShopItem(id) {
    if (!confirm("Remover?")) return;
    await supabase.from('shop_items').delete().eq('id', id);
    fetchData();
  }

  async function modifyGold(playerId, amount) { 
    if (!amount) return; 
    const val = Number(amount);
    setPlayers(curr => curr.map(p => p.id === playerId ? { ...p, gold: Math.max(0, (p.gold||0) + val) } : p));
    await updatePlayerXpAndLevel(playerId, 0, val);
    setGoldMod(prev => ({ ...prev, [playerId]: '' })); 
  }

  async function modifyXp(playerId, amount) { 
    if (!amount) return; 
    const val = Number(amount);
    setPlayers(curr => curr.map(p => p.id === playerId ? { ...p, xp: Math.max(0, (p.xp||0) + val) } : p));
    await updatePlayerXpAndLevel(playerId, val, 0);
    setXpMod(prev => ({ ...prev, [playerId]: '' })); 
  }

  async function updateRank(playerId, newRank) { 
    setPlayers(curr => curr.map(p => p.id === playerId ? { ...p, rank: newRank } : p));
    await supabase.from('profiles').update({ rank: newRank }).eq('id', playerId); 
  }

  function openInventory(player) { setSelectedPlayerForInv(player); setSlotAddQty(1); setMasterItemQty(1); setMasterItemName(''); }
  
  async function increaseSlots() { 
    if (!selectedPlayerForInv) return; 
    const qtd = Number(slotAddQty); if (qtd <= 0) return; 
    const newSlots = (selectedPlayerForInv.slots||10) + qtd;
    setSelectedPlayerForInv({...selectedPlayerForInv, slots: newSlots});
    await supabase.from('profiles').update({ slots: newSlots }).eq('id', selectedPlayerForInv.id); 
  }
  
  async function masterAddItemToPlayer() {
    if (!masterItemName.trim() || !selectedPlayerForInv) return;
    const qtd = Number(masterItemQty); if (qtd <= 0) return;
    let newInv = [...(selectedPlayerForInv.inventory || [])];
    const idx = newInv.findIndex(i => i.name.toLowerCase() === masterItemName.toLowerCase());
    if (idx >= 0) newInv[idx].qty += qtd; 
    else { if (newInv.length >= (selectedPlayerForInv.slots||10)) return alert("Mochila cheia!"); newInv.push({ name: masterItemName, qty: qtd }); }
    setSelectedPlayerForInv({...selectedPlayerForInv, inventory: newInv});
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', selectedPlayerForInv.id);
    setMasterItemName(''); 
  }
  
  async function masterRemoveItemFromPlayer(index) {
    if (!selectedPlayerForInv) return;
    let newInv = [...(selectedPlayerForInv.inventory || [])];
    if (newInv[index].qty > 1) newInv[index].qty -= 1; else newInv.splice(index, 1);
    setSelectedPlayerForInv({...selectedPlayerForInv, inventory: newInv});
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', selectedPlayerForInv.id);
  }

  return (
    <div className={styles.wrapper} data-theme={currentTheme}>
      <div className={styles.themeSwitcher}>
          {themes.map(t => (
              <button key={t.id} className={`${styles.themeDot} ${currentTheme === t.id ? styles.activeDot : ''}`}
                style={{backgroundColor: t.color}} onClick={() => setCurrentTheme(t.id)} title={t.label} />
          ))}
      </div>

      <div className={styles.container}>
        {selectedPlayerForInv && (
          <div className={styles.modalOverlay} onClick={() => setSelectedPlayerForInv(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h2 style={{color:'var(--accent-glow)', margin:'0 0 20px 0', fontSize:'1.4rem', display:'flex', alignItems:'center', gap:'10px'}}>
                <Backpack size={24} /> Mochila: <span style={{color:'#fff'}}>{selectedPlayerForInv.username}</span>
              </h2>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#18181b', padding:'12px', borderRadius:'8px', marginBottom:'20px', border:'1px solid #27272a'}}>
                  <span style={{color:'#a1a1aa', fontSize:'0.9rem'}}>Capacidade: <strong style={{color:'#fff'}}>{selectedPlayerForInv.slots || 10}</strong> slots</span>
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                    <input type="number" min="1" className={styles.input} style={{width:'60px', padding:'6px', textAlign:'center'}} value={slotAddQty} onChange={e => setSlotAddQty(e.target.value)} />
                    <button onClick={increaseSlots} className={styles.btnPrimary} style={{marginTop:0, width:'auto', padding:'8px 16px'}}><Plus size={16}/></button>
                  </div>
              </div>
              <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                 <input className={styles.input} placeholder="Item" value={masterItemName} onChange={e => setMasterItemName(e.target.value)} />
                 <input type="number" min="1" className={styles.input} placeholder="Qtd" value={masterItemQty} onChange={e => setMasterItemQty(e.target.value)} style={{width:'80px'}} />
                 <button onClick={masterAddItemToPlayer} className={styles.btnPrimary} style={{width:'auto', marginTop:0}}><Plus size={18}/></button>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:'12px', maxHeight:'300px', overflowY:'auto'}}>
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
                      ) : <span style={{fontSize:'0.6rem', color:'#555'}}>Vazio</span>}
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setSelectedPlayerForInv(null)} style={{marginTop:'25px', width:'100%', background:'transparent', border:'1px solid #3f3f46', color:'#71717a', padding:'12px', cursor:'pointer', borderRadius:'8px', fontWeight:'bold'}}>FECHAR</button>
            </div>
          </div>
        )}

        <header className={styles.header}>
          <div className={styles.titleGroup}>
             <Logo size={42} showText={true} /> 
          </div>
          
          <div className={styles.actions}>
            {/* BOTÃO DA INTELIGÊNCIA ARTIFICIAL */}
            <button 
              onClick={generateDailyContent} 
              disabled={isGenerating}
              className={`${styles.btnIcon} ${styles.btnMagic}`} 
              style={{ background: 'linear-gradient(45deg, #8b5cf6, #d946ef)', border: 'none', color: 'white' }}
            >
              {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Bot size={18} />} 
              <span className="hidden md:inline">{isGenerating ? 'Criando...' : 'Gerar Diária'}</span>
            </button>

            <button onClick={fetchData} className={`${styles.btnIcon} ${styles.btnRefresh}`}>
              <RefreshCw size={18} /> <span className="hidden md:inline">Atualizar</span>
            </button>
            <button onClick={handleLogout} className={`${styles.btnIcon} ${styles.btnLogout}`}>
              <LogOut size={18} /> <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </header>

        <div className={styles.grid}>
          <div className={styles.column}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><Scroll size={18} /> Nova Missão</h2>
              <div className={styles.inputGroup}><label className={styles.label}>Título</label><input className={styles.input} placeholder="Ex: Caçada Noturna" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>Descrição</label><textarea className={styles.input} placeholder="Detalhes..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} rows={3} /></div>
              <div className={styles.row}>
                <div className={styles.inputGroup}><label className={styles.label}>XP</label><input className={styles.input} type="number" value={form.xp} onChange={e => setForm({...form, xp: e.target.value})} /></div>
                <div className={styles.inputGroup}><label className={styles.label}>Ouro</label><input className={styles.input} type="number" value={form.gold} onChange={e => setForm({...form, gold: e.target.value})} /></div>
                <div className={styles.inputGroup}><label className={styles.label}>Rank</label><select className={styles.input} value={form.rank} onChange={e => setForm({...form, rank: e.target.value})}>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
              </div>
              <button onClick={createMission} className={styles.btnPrimary}><Plus size={18} /> PUBLICAR</button>
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><Zap size={18} /> Mural Ativo</h2>
              <div className={styles.scrollableListSmall}>
                {missions.filter(m => m.status === 'open').length === 0 && <p style={{color:'#64748b', textAlign:'center', marginTop:'20px'}}>Nenhuma missão publicada.</p>}
                {missions.filter(m => m.status === 'open').map(m => (
                  <div key={m.id} className={styles.requestItem} style={{borderLeft: `3px solid ${RANK_COLORS[m.rank]}`}}>
                    <div><strong style={{color:'#f1f5f9', display:'block', fontSize:'0.95rem'}}>{m.title}</strong><div style={{fontSize:'0.75rem', color:'#94a3b8', marginTop:'4px'}}>Rank {m.rank} • {m.xp_reward}XP • {m.gold_reward}G</div></div>
                    <button onClick={() => deleteMission(m.id)} className={styles.btnReject}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><ShoppingBag size={18} /> Loja & Itens</h2>
              <div className={styles.inputGroup}><label className={styles.label}>Item</label><input className={styles.input} placeholder="Nome" value={shopForm.name} onChange={e => setShopForm({...shopForm, name: e.target.value})} /></div>
              <div className={styles.inputGroup}><label className={styles.label}>Descrição</label><textarea className={styles.input} placeholder="Efeitos..." rows={2} value={shopForm.desc} onChange={e => setShopForm({...shopForm, desc: e.target.value})} /></div>
              <div className={styles.row}>
                 <div className={styles.inputGroup}><label className={styles.label}>Preço</label><input className={styles.input} type="number" min="1" value={shopForm.price} onChange={e => setShopForm({...shopForm, price: e.target.value})} /></div>
                 <div className={styles.inputGroup}><label className={styles.label}>Qtd</label><input className={styles.input} type="number" min="1" value={shopForm.quantity} onChange={e => setShopForm({...shopForm, quantity: e.target.value})} /></div>
              </div>
              <button onClick={addItem} className={styles.btnPrimary}><Plus size={18} /> ADICIONAR</button>
              <div style={{marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px'}}>
                 <div className={styles.scrollableListSmall} style={{maxHeight: '180px'}}>
                    {shopItems.length === 0 && <p style={{color:'#64748b', textAlign:'center', fontSize:'0.85rem'}}>Estoque vazio.</p>}
                    {shopItems.map(item => (
                      <div key={item.id} className={styles.requestItem}>
                        <div><strong style={{color: '#e2e8f0', fontSize:'0.9rem'}}>{item.item_name}</strong><div style={{fontSize:'0.75rem', color:'#64748b'}}>{item.price}g • Est: {item.quantity}</div></div>
                        <button onClick={() => deleteShopItem(item.id)} className={styles.btnReject}><Trash2 size={14} /></button>
                      </div>
                    ))}
                 </div>
              </div>
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><MessageSquare size={18} /> Solicitações {requests.length > 0 && <span style={{background:'var(--accent-primary)', padding:'2px 8px', borderRadius:'12px', fontSize:'0.75rem', color:'#fff', marginLeft:'auto'}}>{requests.length}</span>}</h2>
              <div className={styles.scrollableListSmall}>
                {requests.length === 0 && <p style={{color:'#64748b', textAlign:'center', marginTop:'10px'}}>Nenhum pedido pendente.</p>}
                {requests.map(req => {
                  const isRoulette = req.item_name === "SOLICITACAO_ROLETA";
                  return (
                    <div key={req.id} className={styles.requestItem} style={isRoulette ? {borderColor: 'var(--accent-glow)', background: 'rgba(var(--accent-rgb), 0.05)'} : {}}>
                      <div>
                        {isRoulette ? (<strong style={{color:'var(--accent-glow)', display:'flex', alignItems:'center', gap:'5px', fontSize:'0.9rem'}}><Sparkles size={14} /> ROLETA GACHA</strong>) : (<strong style={{color:'#f1f5f9', display:'block', fontSize:'0.9rem'}}>{req.quantity}x {req.item_name}</strong>)}
                        <span style={{fontSize:'0.75rem', color:'#94a3b8'}}>{req.profiles?.username}</span>
                      </div>
                      <div style={{display:'flex', gap:'8px'}}><button onClick={() => handleRequest(req, true)} className={styles.btnApprove}><Check size={16} /></button><button onClick={() => handleRequest(req, false)} className={styles.btnReject}><X size={16} /></button></div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className={styles.column}>
            <section className={styles.card}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:'12px', marginBottom:'10px'}}>
                 <h2 className={styles.cardTitle} style={{margin:0, border:0, padding:0}}><Users size={18} /> Jogadores</h2>
                 <div style={{display:'flex', gap:'8px'}}>
                   <input className={styles.input} placeholder="Novo Grupo" value={partyForm} onChange={e => setPartyForm(e.target.value)} style={{width:'100px', padding:'6px 10px', fontSize:'0.8rem'}} />
                   <button onClick={createParty} className={styles.btnPrimary} style={{marginTop:0, padding:'6px 12px', width:'auto', fontSize:'0.8rem'}}>CRIAR</button>
                 </div>
              </div>
              <div className={styles.scrollableList}>
                {players.map(p => {
                  const currentParty = parties.find(party => party.id === p.party_id);
                  const rankColor = RANK_COLORS[p.rank] || RANK_COLORS['F'];
                  return (
                    <div key={p.id} className={styles.playerItem}>
                      <div className={styles.playerHeader}>
                        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start'}}>
                          <span style={{color:'#f1f5f9', fontWeight:'700', fontSize:'1rem', display:'flex', alignItems:'center', gap:'6px'}}>{p.username} {currentParty?.leader_id === p.id && <Crown size={14} color="#fbbf24" fill="#fbbf24" />}</span>
                          <div style={{display:'flex', gap:'8px', marginTop:'6px', alignItems:'center'}}>
                            <select className={styles.input} style={{padding:'4px 8px', fontSize:'0.75rem', width:'auto', minWidth:'90px', height:'28px', background:'rgba(255,255,255,0.05)'}} value={p.party_id || ""} onChange={(e) => assignToParty(p.id, e.target.value)}>
                              <option value="">Sem Grupo</option>{parties.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                            {p.party_id && currentParty?.leader_id !== p.id && <button onClick={() => makeLeader(p.party_id, p.id)} title="Tornar Líder" className={styles.miniBtn}><Crown size={12}/></button>}
                          </div>
                        </div>
                        <div className={styles.playerActionsRight}>
                          <button onClick={() => openInventory(p)} title="Mochila" className={`${styles.btnIcon} ${styles.btnRefresh}`} style={{padding:'6px 10px', borderRadius:'12px'}}><Backpack size={16}/></button>
                          <select value={p.rank || 'F'} onChange={(e) => updateRank(p.id, e.target.value)} className={styles.input} style={{color: rankColor, borderColor: rankColor, width:'40px', padding:'2px', height:'30px', fontWeight:'800', textAlign:'center', background:'transparent'}}>
                            {RANKS.map(r => <option key={r} value={r} style={{color: '#fff', background:'#000'}}>{r}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className={styles.resourceRow}>
                        <span style={{color:'#fbbf24', fontWeight:'600', display:'flex', alignItems:'center', gap:'5px'}}><Coins size={14} /> {p.gold}</span>
                        <div style={{display:'flex', gap:'2px', alignItems:'center'}}><input className={styles.miniInput} onChange={e => setGoldMod({...goldMod, [p.id]: e.target.value})} value={goldMod[p.id] || ''} placeholder="0" /><button onClick={() => modifyGold(p.id, goldMod[p.id])} className={styles.miniBtn}><Plus size={10}/></button><button onClick={() => modifyGold(p.id, -(goldMod[p.id]))} className={styles.miniBtn}>-</button></div>
                      </div>
                      <div className={styles.resourceRow}>
                        <span style={{color:'#60a5fa', fontWeight:'600', display:'flex', alignItems:'center', gap:'5px'}}><Sparkles size={14} /> {p.xp} (Lvl {p.level})</span>
                        <div style={{display:'flex', gap:'2px', alignItems:'center'}}><input className={styles.miniInput} onChange={e => setXpMod({...xpMod, [p.id]: e.target.value})} value={xpMod[p.id] || ''} placeholder="0" /><button onClick={() => modifyXp(p.id, xpMod[p.id])} className={styles.miniBtn}><Plus size={10}/></button><button onClick={() => modifyXp(p.id, -(xpMod[p.id]))} className={styles.miniBtn}>-</button></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}><Check size={18} /> Contratos Ativos</h2>
              <div className={styles.scrollableListSmall}>
                {missions.filter(m => m.status === 'in_progress').length === 0 && <p style={{color:'#64748b', textAlign:'center', marginTop:'10px'}}>Nenhum em andamento.</p>}
                {missions.filter(m => m.status === 'in_progress').map(m => (
                  <div key={m.id} className={styles.requestItem} style={{borderLeft: '3px solid #fbbf24'}}>
                    <div><strong style={{color:'#f1f5f9', fontSize:'0.9rem'}}>{m.title}</strong><span style={{fontSize:'0.75rem', color:'#94a3b8', display:'block', marginTop:'4px'}}>Herói: {players.find(p => p.id === m.assigned_to)?.username}</span></div>
                    <div style={{display:'flex', gap:'8px'}}><button onClick={() => updateMission(m.id, 'completed', m.assigned_to, m.xp_reward, m.gold_reward)} className={styles.btnApprove}><Check size={16} /></button><button onClick={() => updateMission(m.id, 'failed', m.assigned_to, 0, 0)} className={styles.btnReject}><X size={16} /></button></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}