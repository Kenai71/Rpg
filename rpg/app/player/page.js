"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './player.module.css';

export default function PlayerPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [shop, setShop] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [myRequests, setMyRequests] = useState([]); 
  const [myParty, setMyParty] = useState(null); 
  const [tab, setTab] = useState('missions');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);

  const RANK_VALUES = { 'F': 0, 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);
      const { data: reqs } = await supabase.from('item_requests').select('*').eq('player_id', user.id);
      setMyRequests(reqs || []);

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
    
    // Tenta pegar o nome usando 'name' (padrão Mestre antigo) ou 'item_name'
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
    const currentInv = profile.inventory || [];
    let newInv = [...currentInv];
    if (newInv[index].qty > 1) newInv[index].qty -= 1; else newInv.splice(index, 1);
    await supabase.from('profiles').update({ inventory: newInv }).eq('id', profile.id);
    loadData();
  }

  return (
    <div className={styles.container}>
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

      {profile && (
        <div className={styles.hud}>
          <div className={styles.charInfo}>
            <h1>{profile.username}</h1>
            <div style={{display:'flex', gap:'10px'}}>
              <span className={styles.rankTag}>RANK {profile.rank || 'F'}</span>
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
              <div key={m.id} className={styles.card} style={{borderLeft:'4px solid #d97706'}}>
                <div className={styles.cardHeader}><h3>{m.title}</h3><span style={{fontSize:'0.8rem', color:'#fbbf24'}}>RANK {m.rank}</span></div>
                {/* LÊ DESC OU DESCRIPTION */}
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
                {/* LÊ NAME OU ITEM_NAME */}
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
             {allPlayers.map(p => (
               <div key={p.id} className={styles.card} style={{alignItems:'center', textAlign:'center', borderColor: (myParty && p.party_id === myParty.id) ? '#22c55e' : '#3b82f6'}}>
                 <div style={{fontSize:'2.5rem', marginBottom:'10px'}}>🛡️</div>
                 <h3 style={{color:'white', margin:0}}>{p.username}</h3>
                 <div style={{display:'flex', gap:'5px', justifyContent:'center', marginTop:'5px'}}>
                   <span style={{color:'#3b82f6', fontSize:'0.7rem', fontWeight:'bold', background:'#111', padding:'2px 6px', borderRadius:'4px'}}>RANK {p.rank}</span>
                   <span style={{color:'#eab308', fontSize:'0.7rem', fontWeight:'bold', background:'#111', padding:'2px 6px', borderRadius:'4px'}}>LVL {p.level || 1}</span>
                 </div>
                 {(myParty && p.party_id === myParty.id) && <span style={{fontSize:'0.7rem', color:'#86efac', marginTop:'5px'}}>Seu Grupo</span>}
               </div>
             ))}
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
             
             {myRequests.length > 0 && (
               <div style={{marginTop:'20px', borderTop:'1px solid #333', paddingTop:'10px'}}>
                 <h4 style={{color:'#888', fontSize:'0.8rem', textAlign:'center'}}>Aguardando Aprovação:</h4>
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