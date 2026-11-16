import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  DEFAULT_EQUIPMENT,
  calculateLevel,
  getItemType,
  getRarityFromItem,
  rollGachaRarity,
} from './constants';

function requireDb() {
  if (!db) {
    throw new Error('Firebase não está configurado. Verifique as variáveis .env.');
  }
  return db;
}

export function normalizeProfile(raw, id) {
  if (!raw) return null;
  return {
    id: id || raw.uid,
    uid: raw.uid || id,
    username: raw.username || 'Aventureiro',
    photoURL: raw.photoURL || null,
    role: raw.role === 'master' ? 'master' : 'player',
    rank: raw.rank || 'F',
    level: Number(raw.level || 1),
    xp: Number(raw.xp || 0),
    gold: Number(raw.gold || 0),
    slots: Number(raw.slots || 10),
    party_id: raw.party_id || null,
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
    equipment: { ...DEFAULT_EQUIPMENT, ...(raw.equipment || {}) },
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

export async function ensureUserProfile(user, preferredUsername = '') {
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', user.uid);
  const snap = await getDoc(profileRef);

  if (snap.exists()) {
    const existing = normalizeProfile(snap.data(), snap.id);
    // Atualiza avatar do Google se ainda não salvo
    if (user.photoURL && !existing.photoURL) {
      await updateDoc(profileRef, {
        photoURL: user.photoURL,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    return existing;
  }

  const fallbackName =
    preferredUsername?.trim() ||
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    'Aventureiro';

  const cleanName = fallbackName.slice(0, 40);

  const initialProfile = {
    uid: user.uid,
    username: cleanName,
    photoURL: user.photoURL || null,
    role: 'player',
    rank: 'F',
    level: 1,
    xp: 0,
    gold: 0,
    slots: 10,
    party_id: null,
    inventory: [],
    equipment: { ...DEFAULT_EQUIPMENT },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(profileRef, initialProfile);

  // Guarda e-mail separadamente em users_private para evitar vazamento de PII em profiles
  const privateRef = doc(firestore, 'users_private', user.uid);
  await setDoc(
    privateRef,
    {
      uid: user.uid,
      email: user.email || '',
      provider: user.providerData?.[0]?.providerId || 'password',
      createdAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => {});

  return normalizeProfile(initialProfile, user.uid);
}

export function subscribeDoc(collectionName, docId, onData, onError) {
  const firestore = requireDb();
  const ref = doc(firestore, collectionName, docId);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
      } else {
        const data = snapshot.data();
        onData(
          collectionName === 'profiles'
            ? normalizeProfile(data, snapshot.id)
            : { id: snapshot.id, ...data }
        );
      }
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function subscribeCollection(collectionName, constraints = [], onData, onError) {
  const firestore = requireDb();
  const ref = collection(firestore, collectionName);
  const q = constraints.length > 0 ? query(ref, ...constraints) : ref;
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) =>
        collectionName === 'profiles'
          ? normalizeProfile(d.data(), d.id)
          : { id: d.id, ...d.data() }
      );
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function updateHeroUsername(uid, newUsername) {
  const firestore = requireDb();
  const clean = newUsername.trim().slice(0, 40);
  if (!clean) throw new Error('O nome do personagem não pode ficar vazio.');
  await updateDoc(doc(firestore, 'profiles', uid), {
    username: clean,
    updatedAt: serverTimestamp(),
  });
}

// --- PLAYER ACTIONS ---

export async function acceptMissionTx(missionId, profile) {
  const firestore = requireDb();
  const missionRef = doc(firestore, 'missions', missionId);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(missionRef);
    if (!snap.exists()) throw new Error('Missão não encontrada.');
    const data = snap.data();
    if (data.status !== 'open' || data.assigned_to) {
      throw new Error('Esta missão já foi aceita por outro herói.');
    }
    tx.update(missionRef, {
      status: 'in_progress',
      assigned_to: profile.uid,
      assigned_to_name: profile.username,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function buyShopItemTx(uid, shopItemId, useRune, purchaseQty = 1) {
  const count = Math.max(1, Math.floor(Number(purchaseQty) || 1));
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', uid);
  const shopRef = doc(firestore, 'shop_items', shopItemId);

  await runTransaction(firestore, async (tx) => {
    const [profSnap, shopSnap] = await Promise.all([tx.get(profileRef), tx.get(shopRef)]);
    if (!profSnap.exists()) throw new Error('Perfil não encontrado.');
    if (!shopSnap.exists()) throw new Error('Item não disponível na loja.');

    const prof = normalizeProfile(profSnap.data(), profSnap.id);
    const shopItem = { id: shopSnap.id, ...shopSnap.data() };
    const availableStock = Number(shopItem.quantity || 0);

    if (availableStock < count) {
      throw new Error(`Estoque insuficiente. Restam apenas ${availableStock} unidade(s).`);
    }

    const inv = [...prof.inventory];
    const maxSlots = prof.slots || 10;
    const existingIdx = inv.findIndex((i) => i.name === shopItem.item_name);
    const isStacking = existingIdx >= 0;

    if (!isStacking && inv.length >= maxSlots) {
      throw new Error('Mochila cheia! Libere um espaço antes de comprar.');
    }

    const itemToSave = {
      name: shopItem.item_name,
      qty: count,
      description: shopItem.description || '',
      type: shopItem.type || getItemType({ name: shopItem.item_name }),
    };

    let nextGold = prof.gold;

    if (useRune) {
      const rarity = getRarityFromItem(shopItem);
      const runeName = `Runa ${rarity}`;
      const runeIdx = inv.findIndex((i) => i.name === runeName && i.qty >= count);
      if (runeIdx === -1) {
        throw new Error(`Você precisa de ${count} ${runeName}(s) na mochila.`);
      }
      if (inv[runeIdx].qty > count) {
        inv[runeIdx] = { ...inv[runeIdx], qty: inv[runeIdx].qty - count };
      } else {
        inv.splice(runeIdx, 1);
      }

      if (isStacking) {
        inv[existingIdx] = { ...inv[existingIdx], qty: inv[existingIdx].qty + count };
      } else {
        inv.push(itemToSave);
      }
    } else {
      const totalPrice = Number(shopItem.price || 0) * count;
      if (prof.gold < totalPrice) {
        throw new Error(
          `Ouro insuficiente para comprar ${count} unidade(s) (${totalPrice} G necessários).`
        );
      }
      nextGold = prof.gold - totalPrice;
      if (isStacking) {
        inv[existingIdx] = { ...inv[existingIdx], qty: inv[existingIdx].qty + count };
      } else {
        inv.push(itemToSave);
      }
    }

    tx.update(profileRef, {
      gold: nextGold,
      inventory: inv,
      updatedAt: serverTimestamp(),
    });

    tx.update(shopRef, {
      quantity: availableStock - count,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function equipInventoryItemTx(uid, itemIndex, targetSlot) {
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', uid);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists()) throw new Error('Perfil não encontrado.');
    const prof = normalizeProfile(snap.data(), snap.id);

    const inv = [...prof.inventory];
    const equip = { ...prof.equipment };
    const item = inv[itemIndex];
    if (!item) throw new Error('Item não encontrado na mochila.');
    if (item.name.includes('Runa') || item.name === 'Gacha Gift') {
      throw new Error('Runas e Gacha Gifts não podem ser equipados.');
    }

    const itemType = getItemType(item);
    const isValid =
      targetSlot === 'ring1' || targetSlot === 'ring2'
        ? itemType === 'ring'
        : itemType === targetSlot;

    if (!isValid) {
      throw new Error(`Este item não encaixa no slot selecionado.`);
    }

    const maxSlots = prof.slots || 10;
    const hasItemInSlot = Boolean(equip[targetSlot]);
    const isStack = item.qty > 1;

    if (isStack && hasItemInSlot && inv.length >= maxSlots) {
      const oldItem = equip[targetSlot];
      const canStackOld = inv.some((i) => i.name === oldItem.name);
      if (!canStackOld) {
        throw new Error('Mochila cheia! Libere 1 slot para guardar o equipamento atual.');
      }
    }

    const itemToEquip = { ...item, qty: 1 };
    if (item.qty > 1) {
      inv[itemIndex] = { ...item, qty: item.qty - 1 };
    } else {
      inv.splice(itemIndex, 1);
    }

    if (hasItemInSlot) {
      const oldItem = equip[targetSlot];
      const existingIdx = inv.findIndex((i) => i.name === oldItem.name);
      if (existingIdx >= 0) {
        inv[existingIdx] = { ...inv[existingIdx], qty: inv[existingIdx].qty + 1 };
      } else {
        inv.push({ ...oldItem, qty: 1 });
      }
    }

    equip[targetSlot] = itemToEquip;

    tx.update(profileRef, {
      inventory: inv,
      equipment: equip,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function unequipSlotTx(uid, slotName) {
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', uid);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists()) throw new Error('Perfil não encontrado.');
    const prof = normalizeProfile(snap.data(), snap.id);

    const equip = { ...prof.equipment };
    const item = equip[slotName];
    if (!item) return;

    const inv = [...prof.inventory];
    const existingIdx = inv.findIndex((i) => i.name === item.name);
    const isStacking = existingIdx >= 0;

    if (!isStacking && inv.length >= (prof.slots || 10)) {
      throw new Error('Mochila cheia! Não há espaço para desequipar.');
    }

    equip[slotName] = null;
    if (isStacking) {
      inv[existingIdx] = { ...inv[existingIdx], qty: inv[existingIdx].qty + 1 };
    } else {
      inv.push({ ...item, qty: 1 });
    }

    tx.update(profileRef, {
      inventory: inv,
      equipment: equip,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function discardInventoryItemTx(uid, itemIndex, discardAll = false) {
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', uid);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists()) throw new Error('Perfil não encontrado.');
    const prof = normalizeProfile(snap.data(), snap.id);

    const inv = [...prof.inventory];
    const item = inv[itemIndex];
    if (!item) throw new Error('Item não encontrado.');

    if (!discardAll && item.qty > 1) {
      inv[itemIndex] = { ...item, qty: item.qty - 1 };
    } else {
      inv.splice(itemIndex, 1);
    }

    tx.update(profileRef, {
      inventory: inv,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function openGachaGiftTx(uid, giftIndex) {
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', uid);
  const resultRarity = rollGachaRarity();

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists()) throw new Error('Perfil não encontrado.');
    const prof = normalizeProfile(snap.data(), snap.id);

    const inv = [...prof.inventory];
    const gift = inv[giftIndex];
    if (!gift || gift.name !== 'Gacha Gift') {
      throw new Error('Gacha Gift não encontrado neste slot.');
    }

    const runeName = `Runa ${resultRarity.name}`;
    const alreadyHasRune = inv.some((i) => i.name === runeName);
    if (gift.qty > 1 && !alreadyHasRune && inv.length >= (prof.slots || 10)) {
      throw new Error('Mochila cheia! Libere 1 slot para receber a Runa.');
    }

    if (gift.qty > 1) {
      inv[giftIndex] = { ...gift, qty: gift.qty - 1 };
    } else {
      inv.splice(giftIndex, 1);
    }

    const runeIdx = inv.findIndex((i) => i.name === runeName);
    if (runeIdx >= 0) {
      inv[runeIdx] = { ...inv[runeIdx], qty: inv[runeIdx].qty + 1 };
    } else {
      inv.push({
        name: runeName,
        qty: 1,
        description: `<${resultRarity.name}> Item mágico usado para trocar por equipamentos desta raridade na loja.`,
        type: 'consumable',
      });
    }

    tx.update(profileRef, {
      inventory: inv,
      updatedAt: serverTimestamp(),
    });
  });

  return resultRarity;
}

export async function requestItem(profile, itemName, quantity) {
  const firestore = requireDb();
  const cleanName = itemName.trim().slice(0, 80);
  const qty = Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1)));
  if (!cleanName) throw new Error('Informe o nome do item.');

  await addDoc(collection(firestore, 'item_requests'), {
    player_id: profile.uid,
    player_name: profile.username,
    item_name: cleanName,
    quantity: qty,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function requestRouletteGift(profile) {
  return requestItem(profile, 'SOLICITACAO_ROLETA', 1);
}

// --- PLAYER-TO-PLAYER TRANSFERS (SAFE ESCROW FLOW) ---

export async function createTradeTransferTx(senderProfile, receiverProfile, payload) {
  const firestore = requireDb();
  const senderRef = doc(firestore, 'profiles', senderProfile.uid);
  const tradeRef = doc(collection(firestore, 'trade_requests'));

  await runTransaction(firestore, async (tx) => {
    const senderSnap = await tx.get(senderRef);
    if (!senderSnap.exists()) throw new Error('Seu perfil não foi encontrado.');
    const sender = normalizeProfile(senderSnap.data(), senderSnap.id);

    if (payload.type === 'gold') {
      const amount = Math.floor(Number(payload.amount));
      if (!amount || amount <= 0) throw new Error('Informe uma quantidade válida de ouro.');
      if (amount > sender.gold) throw new Error('Ouro insuficiente.');

      tx.update(senderRef, {
        gold: sender.gold - amount,
        updatedAt: serverTimestamp(),
      });

      tx.set(tradeRef, {
        type: 'gold',
        sender_id: sender.uid,
        sender_name: sender.username,
        receiver_id: receiverProfile.uid,
        receiver_name: receiverProfile.username,
        amount,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    } else {
      const inv = [...sender.inventory];
      const itemIdx = Number(payload.itemIndex);
      const item = inv[itemIdx];
      const qty = Math.floor(Number(payload.itemQty));
      if (!item) throw new Error('Item selecionado não encontrado.');
      if (!qty || qty <= 0 || qty > item.qty) throw new Error('Quantidade inválida.');

      if (item.qty > qty) {
        inv[itemIdx] = { ...item, qty: item.qty - qty };
      } else {
        inv.splice(itemIdx, 1);
      }

      tx.update(senderRef, {
        inventory: inv,
        updatedAt: serverTimestamp(),
      });

      tx.set(tradeRef, {
        type: 'item',
        sender_id: sender.uid,
        sender_name: sender.username,
        receiver_id: receiverProfile.uid,
        receiver_name: receiverProfile.username,
        item: {
          name: item.name,
          qty,
          description: item.description || '',
          type: item.type || getItemType(item),
        },
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    }
  });
}

export async function acceptTradeTx(tradeId, receiverUid) {
  const firestore = requireDb();
  const tradeRef = doc(firestore, 'trade_requests', tradeId);
  const receiverRef = doc(firestore, 'profiles', receiverUid);

  await runTransaction(firestore, async (tx) => {
    const [tradeSnap, recSnap] = await Promise.all([tx.get(tradeRef), tx.get(receiverRef)]);
    if (!tradeSnap.exists()) throw new Error('Oferta não encontrada.');
    if (!recSnap.exists()) throw new Error('Perfil não encontrado.');

    const trade = tradeSnap.data();
    if (trade.status !== 'pending' || trade.receiver_id !== receiverUid) {
      throw new Error('Esta oferta não está mais disponível.');
    }

    const receiver = normalizeProfile(recSnap.data(), recSnap.id);

    if (trade.type === 'gold') {
      tx.update(receiverRef, {
        gold: receiver.gold + Number(trade.amount || 0),
        updatedAt: serverTimestamp(),
      });
    } else {
      const inv = [...receiver.inventory];
      const incoming = trade.item;
      const existingIdx = inv.findIndex((i) => i.name === incoming.name);
      if (existingIdx >= 0) {
        inv[existingIdx] = { ...inv[existingIdx], qty: inv[existingIdx].qty + incoming.qty };
      } else {
        if (inv.length >= (receiver.slots || 10)) {
          throw new Error('Sua mochila está cheia! Libere espaço para aceitar este item.');
        }
        inv.push({ ...incoming });
      }
      tx.update(receiverRef, {
        inventory: inv,
        updatedAt: serverTimestamp(),
      });
    }

    tx.update(tradeRef, {
      status: 'accepted',
      resolvedAt: serverTimestamp(),
    });
  });
}

export async function rejectTrade(tradeId) {
  const firestore = requireDb();
  await updateDoc(doc(firestore, 'trade_requests', tradeId), {
    status: 'rejected',
    resolvedAt: serverTimestamp(),
  });
}

export async function claimRefundOrCancelTradeTx(tradeId, senderUid) {
  const firestore = requireDb();
  const tradeRef = doc(firestore, 'trade_requests', tradeId);
  const senderRef = doc(firestore, 'profiles', senderUid);

  await runTransaction(firestore, async (tx) => {
    const [tradeSnap, senderSnap] = await Promise.all([tx.get(tradeRef), tx.get(senderRef)]);
    if (!tradeSnap.exists() || !senderSnap.exists()) return;

    const trade = tradeSnap.data();
    if (trade.sender_id !== senderUid) throw new Error('Sem permissão.');
    if (trade.status !== 'pending' && trade.status !== 'rejected') return;

    const sender = normalizeProfile(senderSnap.data(), senderSnap.id);

    if (trade.type === 'gold') {
      tx.update(senderRef, {
        gold: sender.gold + Number(trade.amount || 0),
        updatedAt: serverTimestamp(),
      });
    } else {
      const inv = [...sender.inventory];
      const item = trade.item;
      const existingIdx = inv.findIndex((i) => i.name === item.name);
      if (existingIdx >= 0) {
        inv[existingIdx] = { ...inv[existingIdx], qty: inv[existingIdx].qty + item.qty };
      } else {
        if (inv.length >= (sender.slots || 10)) {
          throw new Error('Sua mochila está cheia para receber o item devolvido.');
        }
        inv.push({ ...item });
      }
      tx.update(senderRef, {
        inventory: inv,
        updatedAt: serverTimestamp(),
      });
    }

    tx.update(tradeRef, {
      status: trade.status === 'pending' ? 'cancelled' : 'refunded',
      resolvedAt: serverTimestamp(),
    });
  });
}

// --- MASTER (ADMIN) ACTIONS ---

export async function createMission(data) {
  const firestore = requireDb();
  await addDoc(collection(firestore, 'missions'), {
    title: data.title.trim(),
    description: data.description.trim(),
    rank: data.rank,
    xp_reward: Math.max(0, Math.floor(Number(data.xp_reward) || 0)),
    gold_reward: Math.max(0, Math.floor(Number(data.gold_reward) || 0)),
    status: 'open',
    assigned_to: null,
    assigned_to_name: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateMission(id, data) {
  const firestore = requireDb();
  await updateDoc(doc(firestore, 'missions', id), {
    title: data.title.trim(),
    description: data.description.trim(),
    rank: data.rank,
    xp_reward: Math.max(0, Math.floor(Number(data.xp_reward) || 0)),
    gold_reward: Math.max(0, Math.floor(Number(data.gold_reward) || 0)),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMission(id) {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'missions', id));
}

export async function resolveMissionTx(mission, status, allPlayers) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  const missionRef = doc(firestore, 'missions', mission.id);

  batch.update(missionRef, {
    status,
    updatedAt: serverTimestamp(),
  });

  let rewardedCount = 0;

  if (status === 'completed' && mission.assigned_to) {
    const assignee = allPlayers.find((p) => p.uid === mission.assigned_to);
    if (assignee) {
      const recipients = assignee.party_id
        ? allPlayers.filter((p) => p.party_id === assignee.party_id)
        : [assignee];

      const goldSplit =
        recipients.length > 1
          ? Math.floor(Number(mission.gold_reward || 0) / recipients.length)
          : Math.floor(Number(mission.gold_reward || 0));
      const xpGain = Math.floor(Number(mission.xp_reward || 0));

      recipients.forEach((member) => {
        const newXp = Math.max(0, (member.xp || 0) + xpGain);
        const newGold = Math.max(0, (member.gold || 0) + goldSplit);
        const newLevel = calculateLevel(newXp);
        batch.update(doc(firestore, 'profiles', member.uid), {
          xp: newXp,
          gold: newGold,
          level: newLevel,
          updatedAt: serverTimestamp(),
        });
        rewardedCount += 1;
      });
    }
  }

  await batch.commit();
  return { rewardedCount };
}

export async function createShopItem(data) {
  const firestore = requireDb();
  const parsedQty = Number(data.quantity);
  await addDoc(collection(firestore, 'shop_items'), {
    item_name: data.item_name.trim(),
    description: data.description.trim(),
    price: Math.max(1, Math.floor(Number(data.price) || 1)),
    quantity: Number.isFinite(parsedQty) ? Math.max(0, Math.floor(parsedQty)) : 1,
    type: data.type || 'consumable',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateShopItem(id, data) {
  const firestore = requireDb();
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (payload.price !== undefined) {
    payload.price = Math.max(1, Math.floor(Number(payload.price) || 1));
  }
  if (payload.quantity !== undefined) {
    const parsedQty = Number(payload.quantity);
    payload.quantity = Number.isFinite(parsedQty) ? Math.max(0, Math.floor(parsedQty)) : 0;
  }
  await updateDoc(doc(firestore, 'shop_items', id), payload);
}

export async function deleteShopItem(id) {
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'shop_items', id));
}

export async function createParty(name) {
  const firestore = requireDb();
  const clean = name.trim();
  if (!clean) throw new Error('Informe o nome do grupo.');
  await addDoc(collection(firestore, 'parties'), {
    name: clean,
    leader_id: null,
    createdAt: serverTimestamp(),
  });
}

export async function deleteParty(partyId) {
  const firestore = requireDb();
  const membersSnap = await getDocs(
    query(collection(firestore, 'profiles'), where('party_id', '==', partyId))
  );
  const batch = writeBatch(firestore);
  membersSnap.forEach((memberDoc) => {
    batch.update(memberDoc.ref, { party_id: null, updatedAt: serverTimestamp() });
  });
  batch.delete(doc(firestore, 'parties', partyId));
  await batch.commit();
}

export async function assignPlayerToParty(playerId, partyId) {
  const firestore = requireDb();
  await updateDoc(doc(firestore, 'profiles', playerId), {
    party_id: partyId || null,
    updatedAt: serverTimestamp(),
  });
}

export async function setPartyLeader(partyId, playerId) {
  const firestore = requireDb();
  await updateDoc(doc(firestore, 'parties', partyId), {
    leader_id: playerId || null,
  });
}

export async function modifyPlayerStatsTx(playerId, { deltaGold = 0, deltaXp = 0, rank, role }) {
  const firestore = requireDb();
  const ref = doc(firestore, 'profiles', playerId);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Jogador não encontrado.');
    const p = normalizeProfile(snap.data(), snap.id);

    const updates = { updatedAt: serverTimestamp() };
    const intGold = Math.trunc(Number(deltaGold) || 0);
    const intXp = Math.trunc(Number(deltaXp) || 0);
    if (intGold !== 0) {
      updates.gold = Math.max(0, p.gold + intGold);
    }
    if (intXp !== 0) {
      const nextXp = Math.max(0, p.xp + intXp);
      updates.xp = nextXp;
      updates.level = calculateLevel(nextXp);
    }
    if (rank) updates.rank = rank;
    if (role) updates.role = role;

    tx.update(ref, updates);
  });
}

export async function masterIncreaseSlotsTx(playerId, addSlots) {
  const firestore = requireDb();
  const qty = Math.max(1, Math.floor(Number(addSlots) || 0));
  const ref = doc(firestore, 'profiles', playerId);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Jogador não encontrado.');
    const p = normalizeProfile(snap.data(), snap.id);
    tx.update(ref, {
      slots: Math.min(100, (p.slots || 10) + qty),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function masterAddInventoryItemTx(playerId, { name, qty, description = '', type }) {
  const firestore = requireDb();
  const cleanName = name.trim();
  const amount = Math.max(1, Math.floor(Number(qty) || 1));
  if (!cleanName) throw new Error('Informe o nome do item.');

  const ref = doc(firestore, 'profiles', playerId);
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Jogador não encontrado.');
    const p = normalizeProfile(snap.data(), snap.id);
    const inv = [...p.inventory];
    const idx = inv.findIndex((i) => i.name.toLowerCase() === cleanName.toLowerCase());

    if (idx >= 0) {
      inv[idx] = { ...inv[idx], qty: inv[idx].qty + amount };
    } else {
      if (inv.length >= (p.slots || 10)) {
        throw new Error('Mochila cheia! Aumente a capacidade antes de adicionar.');
      }
      inv.push({
        name: cleanName,
        qty: amount,
        description,
        type: type || getItemType({ name: cleanName }),
      });
    }

    tx.update(ref, { inventory: inv, updatedAt: serverTimestamp() });
  });
}

export async function masterRemoveInventoryItemTx(playerId, index) {
  const firestore = requireDb();
  const ref = doc(firestore, 'profiles', playerId);

  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Jogador não encontrado.');
    const p = normalizeProfile(snap.data(), snap.id);
    const inv = [...p.inventory];
    if (!inv[index]) return;
    if (inv[index].qty > 1) {
      inv[index] = { ...inv[index], qty: inv[index].qty - 1 };
    } else {
      inv.splice(index, 1);
    }
    tx.update(ref, { inventory: inv, updatedAt: serverTimestamp() });
  });
}

export async function masterResolveItemRequestTx(reqDoc, approved) {
  const firestore = requireDb();
  const reqRef = doc(firestore, 'item_requests', reqDoc.id);
  const playerRef = doc(firestore, 'profiles', reqDoc.player_id);

  await runTransaction(firestore, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error('Solicitação não encontrada.');
    const reqData = reqSnap.data();
    if (reqData.status && reqData.status !== 'pending') {
      throw new Error('Solicitação já processada.');
    }

    if (approved) {
      const playerSnap = await tx.get(playerRef);
      if (!playerSnap.exists()) throw new Error('Jogador não encontrado.');
      const player = normalizeProfile(playerSnap.data(), playerSnap.id);

      const inv = [...player.inventory];
      const itemToAddName =
        reqData.item_name === 'SOLICITACAO_ROLETA' ? 'Gacha Gift' : reqData.item_name;
      const qtyToAdd = Math.max(1, Number(reqData.quantity || 1));
      const existingIdx = inv.findIndex(
        (i) => i.name.toLowerCase() === itemToAddName.toLowerCase()
      );

      if (existingIdx >= 0) {
        inv[existingIdx] = { ...inv[existingIdx], qty: inv[existingIdx].qty + qtyToAdd };
      } else {
        if (inv.length >= (player.slots || 10)) {
          throw new Error('Mochila do jogador está cheia! Aumente os slots antes de aprovar.');
        }
        inv.push({
          name: itemToAddName,
          qty: qtyToAdd,
          description:
            itemToAddName === 'Gacha Gift'
              ? 'Caixa misteriosa da Roleta Rúnica. Use na mochila para sortear uma Runa!'
              : '',
          type: 'consumable',
        });
      }

      tx.update(playerRef, {
        inventory: inv,
        updatedAt: serverTimestamp(),
      });
    }

    tx.update(reqRef, {
      status: approved ? 'approved' : 'rejected',
      resolvedAt: serverTimestamp(),
    });
  });
}

export async function persistGeneratedDailyContent({ missions = [], shop_items = [] }) {
  const firestore = requireDb();
  const batch = writeBatch(firestore);

  missions.forEach((m) => {
    const ref = doc(collection(firestore, 'missions'));
    batch.set(ref, {
      title: m.title || 'Missão Misteriosa',
      description: m.description || '',
      rank: m.rank || 'D',
      xp_reward: Math.max(0, Math.floor(Number(m.xp_reward) || 100)),
      gold_reward: Math.max(0, Math.floor(Number(m.gold_reward) || 100)),
      status: 'open',
      assigned_to: null,
      assigned_to_name: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  shop_items.forEach((s) => {
    const ref = doc(collection(firestore, 'shop_items'));
    batch.set(ref, {
      item_name: s.item_name || 'Item Raro',
      description: s.description || '',
      price: Math.max(1, Math.floor(Number(s.price) || 100)),
      quantity: Math.max(1, Math.floor(Number(s.quantity) || 1)),
      type: s.type || 'consumable',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
