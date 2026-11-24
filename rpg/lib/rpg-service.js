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
  const resolvedPhoto =
    typeof raw.avatar_data === 'string' && raw.avatar_data.trim()
      ? raw.avatar_data.trim()
      : raw.photoURL || null;
  return {
    id: id || raw.uid,
    uid: raw.uid || id,
    username: raw.username || 'Aventureiro',
    photoURL: resolvedPhoto,
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

export async function updateHeroProfile(uid, { username, photoURL } = {}) {
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', uid);
  const updates = { updatedAt: serverTimestamp() };

  let cleanName;
  if (username !== undefined) {
    cleanName = String(username || '').trim().slice(0, 40);
    if (!cleanName) throw new Error('O nome do personagem não pode ficar vazio.');
    updates.username = cleanName;
  }

  let cleanPhoto;
  const hasPhotoChange = photoURL !== undefined;
  if (hasPhotoChange) {
    if (!photoURL || !String(photoURL).trim()) {
      cleanPhoto = null;
    } else {
      cleanPhoto = String(photoURL).trim();
      if (cleanPhoto.length > 95000) {
        throw new Error('A imagem escolhida é muito grande. Tente uma imagem menor.');
      }
    }
    updates.photoURL = cleanPhoto;
    updates.avatar_data = null;
  }

  try {
    await updateDoc(profileRef, updates);
  } catch (err) {
    const isPermErr =
      err?.code === 'permission-denied' ||
      String(err?.message || '').toLowerCase().includes('permission');
    if (isPermErr && hasPhotoChange && cleanPhoto && cleanPhoto.length > 2000) {
      // Fallback caso firestore.rules em produção ainda limite photoURL a 2048 chars
      const fallbackUpdates = {
        avatar_data: cleanPhoto,
        updatedAt: serverTimestamp(),
      };
      if (cleanName) fallbackUpdates.username = cleanName;
      await updateDoc(profileRef, fallbackUpdates);
    } else {
      throw err;
    }
  }

  // Sincronização em tempo real (melhor esforço) dos tokens deste herói nos mapas táticos
  if (cleanName !== undefined || hasPhotoChange) {
    try {
      const heroTokensSnap = await getDocs(
        query(collection(firestore, 'map_tokens'), where('character_id', '==', uid))
      );
      if (!heroTokensSnap.empty) {
        const batch = writeBatch(firestore);
        heroTokensSnap.forEach((tDoc) => {
          const tPatch = { updatedAt: serverTimestamp() };
          if (cleanName !== undefined) tPatch.name = cleanName;
          if (hasPhotoChange) tPatch.avatar = cleanPhoto;
          batch.update(tDoc.ref, tPatch);
        });
        await batch.commit();
      }
    } catch {
      // Não bloqueia atualização de perfil caso não existam tokens
    }
  }
}

export async function updateHeroUsername(uid, newUsername) {
  return updateHeroProfile(uid, { username: newUsername });
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

// =========================================================================
// SERVIÇOS DE MAPAS TÁTICOS E MESA VTT (D&D 5.5e / 5e)
// =========================================================================

const HD_MAP_CHUNK_SIZE = 720000;
const HD_MAP_MAX_CHUNKS = 16;
const SINGLE_DOC_IMAGE_LIMIT = 885000;
const mapHdUrlCache = new Map();

export function computeAutoGridSize(width, height) {
  const w = Number(width) || 1400;
  const h = Number(height) || 900;
  const minSide = Math.max(100, Math.min(w, h));
  return Math.max(24, Math.min(240, Math.round(minSide / 18)));
}

function parseDataUrlParts(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const header = dataUrl.slice(5, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  const isBase64 = header.includes(';base64');
  const mime = header.split(';')[0] || 'image/webp';
  return { mime, isBase64, body };
}

function base64ToBlobUrl(base64Str, mimeType = 'image/webp') {
  if (typeof window === 'undefined' || typeof atob === 'undefined') {
    return `data:${mimeType};base64,${base64Str}`;
  }
  const binary = atob(base64Str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Carrega a imagem em resolução máxima (HD) de um mapa, reassemblando os chunks
 * da subcoleção `maps/{mapId}/image_chunks` quando o mapa excede 1 MiB.
 * Mantém cache em memória (Blob URL) para trocas instantâneas sem releitura.
 */
export async function loadMapHdImageUrl(map) {
  if (!map) return null;
  const fallback = map.imageUrl || null;
  const chunkCount = Number(map.hd_chunk_count || 0);
  if (!map.id || chunkCount <= 0) return fallback;

  const cacheKey = `${map.id}_${chunkCount}`;
  if (mapHdUrlCache.has(cacheKey)) {
    return mapHdUrlCache.get(cacheKey);
  }

  try {
    const firestore = requireDb();
    const chunksSnap = await getDocs(collection(firestore, 'maps', map.id, 'image_chunks'));
    if (chunksSnap.empty) return fallback;

    const ordered = chunksSnap.docs
      .map((d) => d.data())
      .filter((d) => typeof d?.data === 'string' && d.data.length > 0)
      .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));

    if (ordered.length === 0) return fallback;

    const fullBody = ordered.map((c) => c.data).join('');
    const mime = map.hd_mime_type || 'image/webp';
    const resolvedUrl = fullBody.startsWith('data:')
      ? fullBody
      : base64ToBlobUrl(fullBody, mime);

    mapHdUrlCache.set(cacheKey, resolvedUrl);
    return resolvedUrl;
  } catch (err) {
    console.warn('Usando imagem base do mapa (chunks HD indisponíveis):', err?.message || err);
    return fallback;
  }
}

export async function createMap({
  title,
  imageUrl,
  hdDataUrl = null,
  fallbackImageUrl = null,
  naturalWidth = null,
  naturalHeight = null,
  gridType = 'square',
  gridSize = null,
  autoGrid = true,
  gridOpacity = 0.25,
  scale = 1.0,
  is_active = false,
  is_locked = false,
}) {
  const firestore = requireDb();
  const mapsRef = collection(firestore, 'maps');
  const mapRef = doc(mapsRef);
  const cleanTitle = String(title || 'Mapa Sem Nome').trim().slice(0, 150);

  const safeNaturalW =
    Number.isFinite(Number(naturalWidth)) && Number(naturalWidth) >= 1
      ? Math.min(32768, Math.round(Number(naturalWidth)))
      : null;
  const safeNaturalH =
    Number.isFinite(Number(naturalHeight)) && Number(naturalHeight) >= 1
      ? Math.min(32768, Math.round(Number(naturalHeight)))
      : null;

  const resolvedGridSize =
    Number.isFinite(Number(gridSize)) && Number(gridSize) >= 10
      ? Math.max(10, Math.min(300, Math.round(Number(gridSize))))
      : computeAutoGridSize(safeNaturalW || 1400, safeNaturalH || 900);

  let finalImageUrl = String(imageUrl || '').trim();
  let hdChunkCount = 0;
  let hdMimeType = null;

  // Se houver versão HD maior que 1 documento Firestore, grava chunks na subcoleção dedicada
  // com fallback transparente e sem erro para single-doc de alta qualidade caso as regras ainda não tenham sido publicadas.
  if (typeof hdDataUrl === 'string' && hdDataUrl.length > SINGLE_DOC_IMAGE_LIMIT) {
    const parsed = parseDataUrlParts(hdDataUrl);
    if (parsed && parsed.isBase64 && parsed.body.length > 0) {
      const totalChunks = Math.ceil(parsed.body.length / HD_MAP_CHUNK_SIZE);
      if (totalChunks >= 1 && totalChunks <= HD_MAP_MAX_CHUNKS) {
        const chunks = [];
        for (let i = 0; i < totalChunks; i += 1) {
          chunks.push({
            index: i,
            data: parsed.body.slice(i * HD_MAP_CHUNK_SIZE, (i + 1) * HD_MAP_CHUNK_SIZE),
          });
        }

        try {
          // Grava em pequenos lotes paralelos de 3 chunks (respeita limite de 10 MiB por requisição)
          for (let i = 0; i < chunks.length; i += 3) {
            const slice = chunks.slice(i, i + 3);
            await Promise.all(
              slice.map((chunk) =>
                setDoc(doc(firestore, 'maps', mapRef.id, 'image_chunks', String(chunk.index)), {
                  map_id: mapRef.id,
                  index: chunk.index,
                  data: chunk.data,
                  createdAt: serverTimestamp(),
                })
              )
            );
          }
          hdChunkCount = chunks.length;
          hdMimeType = parsed.mime;

          // Já popula o cache local para exibição instantânea sem esperar releitura
          try {
            const localBlobUrl = base64ToBlobUrl(parsed.body, parsed.mime);
            mapHdUrlCache.set(`${mapRef.id}_${hdChunkCount}`, localBlobUrl);
          } catch {}
        } catch (chunkErr) {
          console.warn(
            'Subcoleção HD indisponível; salvando mapa em alta qualidade otimizada no documento principal:',
            chunkErr?.message || chunkErr
          );
          hdChunkCount = 0;
          hdMimeType = null;
          if (fallbackImageUrl && fallbackImageUrl.length <= SINGLE_DOC_IMAGE_LIMIT) {
            finalImageUrl = fallbackImageUrl;
          }
        }
      }
    }
  }

  if (finalImageUrl.length > 940000) {
    if (fallbackImageUrl && fallbackImageUrl.length <= 940000) {
      finalImageUrl = fallbackImageUrl;
    } else {
      throw new Error('A imagem do mapa excede o limite suportado. Tente outro formato (WebP/JPG/PNG).');
    }
  }

  const mapDocPayload = {
    title: cleanTitle,
    imageUrl: finalImageUrl,
    gridType: ['square', 'hex', 'none'].includes(gridType) ? gridType : 'square',
    gridSize: resolvedGridSize,
    autoGrid: Boolean(autoGrid),
    gridOpacity: Math.max(0, Math.min(1, Number(gridOpacity) || 0.25)),
    scale: Math.max(0.2, Math.min(5, Number(scale) || 1.0)),
    is_active: Boolean(is_active),
    is_locked: Boolean(is_locked),
    fog_enabled: false,
    combat_active: false,
    current_turn_token_id: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (safeNaturalW) mapDocPayload.naturalWidth = safeNaturalW;
  if (safeNaturalH) mapDocPayload.naturalHeight = safeNaturalH;
  if (hdChunkCount > 0) {
    mapDocPayload.hd_chunk_count = hdChunkCount;
    mapDocPayload.hd_mime_type = hdMimeType;
  }

  await setDoc(mapRef, mapDocPayload);
  return mapRef.id;
}

export async function updateMap(mapId, updates) {
  if (!mapId) return;
  const firestore = requireDb();
  const mapRef = doc(firestore, 'maps', mapId);

  const sanitized = { ...updates, updatedAt: serverTimestamp() };
  delete sanitized.id;
  delete sanitized.createdAt;

  await updateDoc(mapRef, sanitized);
}

export async function setActiveMapTx(activeMapId) {
  const firestore = requireDb();
  const mapsSnap = await getDocs(collection(firestore, 'maps'));
  const batch = writeBatch(firestore);

  mapsSnap.forEach((d) => {
    const isTarget = d.id === activeMapId;
    batch.update(d.ref, {
      is_active: isTarget,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function deleteMapWithTokens(mapId) {
  if (!mapId) return;
  const firestore = requireDb();

  // Remove chunks HD associados (se existirem) antes de apagar o mapa
  try {
    const chunksSnap = await getDocs(collection(firestore, 'maps', mapId, 'image_chunks'));
    if (!chunksSnap.empty) {
      await Promise.all(chunksSnap.docs.map((c) => deleteDoc(c.ref).catch(() => {})));
    }
  } catch {}

  // Libera Blob URL em cache de memória se existir
  for (const [key, url] of mapHdUrlCache.entries()) {
    if (key.startsWith(`${mapId}_`)) {
      if (typeof url === 'string' && url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
      mapHdUrlCache.delete(key);
    }
  }

  const batch = writeBatch(firestore);

  // Deleta tokens associados
  const tokensSnap = await getDocs(
    query(collection(firestore, 'map_tokens'), where('map_id', '==', mapId))
  );
  tokensSnap.forEach((t) => batch.delete(t.ref));

  // Deleta o mapa
  batch.delete(doc(firestore, 'maps', mapId));

  // Se o mapa era ativo, checa se há outro mapa para promover a ativo
  const allMapsSnap = await getDocs(collection(firestore, 'maps'));
  const otherMaps = allMapsSnap.docs.filter((d) => d.id !== mapId);
  const deletedWasActive = allMapsSnap.docs.some((d) => d.id === mapId && d.data()?.is_active);

  if (deletedWasActive && otherMaps.length > 0) {
    batch.update(otherMaps[0].ref, { is_active: true, updatedAt: serverTimestamp() });
  }

  await batch.commit();
}

export async function createMapToken(data) {
  const firestore = requireDb();
  const tokensRef = collection(firestore, 'map_tokens');

  const cleanName = String(data.name || 'Guerreiro').trim().slice(0, 100);
  const size = ['S', 'M', 'L', 'H', 'G'].includes(data.size) ? data.size : 'M';
  const type = ['player', 'npc', 'monster'].includes(data.type) ? data.type : 'player';

  const xVal = typeof data.x === 'number' ? data.x : Number(data.x);
  const yVal = typeof data.y === 'number' ? data.y : Number(data.y);
  const finalX = Number.isFinite(xVal) ? Math.max(0, Math.min(100, Math.round(xVal * 10000) / 10000)) : 50;
  const finalY = Number.isFinite(yVal) ? Math.max(0, Math.min(100, Math.round(yVal * 10000) / 10000)) : 50;

  const isAllyDefault = type === 'player';
  const nameHiddenDefault = type === 'monster';

  const docRef = await addDoc(tokensRef, {
    map_id: String(data.map_id),
    name: cleanName,
    type,
    character_id: data.character_id || null,
    owner_id: data.owner_id || null,
    color: data.color || '#60a5fa',
    avatar: data.avatar || null,
    x: finalX,
    y: finalY,
    size,
    hp: Math.max(0, Math.floor(Number(data.hp ?? 20))),
    max_hp: Math.max(1, Math.floor(Number(data.max_hp ?? 20))),
    ac: Math.max(0, Math.floor(Number(data.ac ?? 12))),
    mana: Math.max(0, Math.floor(Number(data.mana ?? 10))),
    max_mana: Math.max(0, Math.floor(Number(data.max_mana ?? 10))),
    conditions: Array.isArray(data.conditions) ? data.conditions.slice(0, 20) : [],
    initiative: Math.floor(Number(data.initiative || 0)),
    hidden: Boolean(data.hidden),
    is_ally: data.is_ally !== undefined ? Boolean(data.is_ally) : isAllyDefault,
    name_hidden: data.name_hidden !== undefined ? Boolean(data.name_hidden) : nameHiddenDefault,
    monster_id: data.monster_id ? String(data.monster_id).slice(0, 128) : null,
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateMapTokenPosition(tokenId, { x, y }) {
  if (!tokenId) return;
  const firestore = requireDb();
  const tokenRef = doc(firestore, 'map_tokens', tokenId);

  const numX = Number(x);
  const numY = Number(y);
  if (!Number.isFinite(numX) || !Number.isFinite(numY)) return;

  await updateDoc(tokenRef, {
    x: Math.max(0, Math.min(100, Math.round(numX * 10000) / 10000)),
    y: Math.max(0, Math.min(100, Math.round(numY * 10000) / 10000)),
    updatedAt: serverTimestamp(),
  });
}

export async function updateMapTokenStats(tokenId, statsData) {
  if (!tokenId) return;
  const firestore = requireDb();
  const tokenRef = doc(firestore, 'map_tokens', tokenId);

  const payload = {
    updatedAt: serverTimestamp(),
  };

  if (statsData.name !== undefined) payload.name = String(statsData.name).slice(0, 100);
  if (statsData.size !== undefined) payload.size = statsData.size;
  if (statsData.hp !== undefined) payload.hp = Math.max(0, Math.floor(Number(statsData.hp)));
  if (statsData.max_hp !== undefined) payload.max_hp = Math.max(1, Math.floor(Number(statsData.max_hp)));
  if (statsData.ac !== undefined) payload.ac = Math.max(0, Math.floor(Number(statsData.ac)));
  if (statsData.mana !== undefined) payload.mana = Math.max(0, Math.floor(Number(statsData.mana)));
  if (statsData.max_mana !== undefined) payload.max_mana = Math.max(0, Math.floor(Number(statsData.max_mana)));
  if (statsData.conditions !== undefined) payload.conditions = Array.isArray(statsData.conditions) ? statsData.conditions : [];
  if (statsData.color !== undefined) payload.color = statsData.color;
  if (statsData.avatar !== undefined) payload.avatar = statsData.avatar || null;
  if (statsData.hidden !== undefined) payload.hidden = Boolean(statsData.hidden);
  if (statsData.is_ally !== undefined) payload.is_ally = Boolean(statsData.is_ally);
  if (statsData.name_hidden !== undefined) payload.name_hidden = Boolean(statsData.name_hidden);
  if (statsData.monster_id !== undefined) payload.monster_id = statsData.monster_id ? String(statsData.monster_id).slice(0, 128) : null;
  if (statsData.initiative !== undefined) payload.initiative = Number(statsData.initiative);

  await updateDoc(tokenRef, payload);
}

export async function deleteMapToken(tokenId) {
  if (!tokenId) return;
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'map_tokens', tokenId));
}

export async function syncHeroTokensToMap(mapId, playerProfiles, existingTokens = []) {
  if (!mapId || !Array.isArray(playerProfiles)) return 0;
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  let addedCount = 0;

  const existingHeroUids = new Set(
    existingTokens
      .filter((t) => t.map_id === mapId && t.type === 'player')
      .map((t) => t.character_id)
  );

  playerProfiles.forEach((p, idx) => {
    if (existingHeroUids.has(p.uid)) return;

    const tokenRef = doc(collection(firestore, 'map_tokens'));
    const heroLevel = Number(p.level || 1);
    const calculatedHp = 18 + heroLevel * 6;
    const calculatedMana = 10 + heroLevel * 4;

    batch.set(tokenRef, {
      map_id: mapId,
      name: p.username || 'Herói',
      type: 'player',
      character_id: p.uid,
      owner_id: p.uid,
      color: '#60a5fa',
      avatar: p.photoURL || null,
      x: 10 + ((idx * 8) % 80),
      y: 84 - Math.floor(idx / 10) * 8,
      size: 'M',
      hp: calculatedHp,
      max_hp: calculatedHp,
      ac: 14,
      mana: calculatedMana,
      max_mana: calculatedMana,
      conditions: [],
      initiative: 0,
      hidden: false,
      is_ally: true,
      name_hidden: false,
      monster_id: null,
      updatedAt: serverTimestamp(),
    });
    addedCount++;
  });

  if (addedCount > 0) {
    await batch.commit();
  }
  return addedCount;
}

export async function broadcastMapPing({ map_id, user_id, user_name, x, y, color = '#38bdf8' }) {
  if (!map_id) return;
  const firestore = requireDb();
  await addDoc(collection(firestore, 'map_pings'), {
    map_id: String(map_id),
    user_id: String(user_id || 'anon'),
    user_name: String(user_name || 'Aventureiro').slice(0, 60),
    x: Math.max(0, Math.min(100, Number(x))),
    y: Math.max(0, Math.min(100, Number(y))),
    color,
    createdAt: serverTimestamp(),
  });
}

/**
 * Transmissão em tempo real de rolagem de dados 3D (unitário ou múltiplos dados, ex: 3d20, 4d4)
 */
export async function broadcastMapDiceRoll({
  map_id,
  user_id,
  user_name,
  user_role = 'player',
  sides,
  count = 1,
  results = null,
  roll,
  seed = Math.random(),
}) {
  if (!map_id || !sides) return null;
  const firestore = requireDb();
  const validSides = [4, 6, 8, 10, 12, 20].includes(Number(sides)) ? Number(sides) : 20;

  let safeResults = [];
  if (Array.isArray(results) && results.length > 0) {
    safeResults = results
      .slice(0, 20)
      .map((v) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n >= 1 && n <= validSides
          ? n
          : Math.floor(Math.random() * validSides) + 1;
      });
  } else {
    const safeCount = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)));
    if (
      safeCount === 1 &&
      Number.isFinite(Number(roll)) &&
      Number(roll) >= 1 &&
      Number(roll) <= validSides
    ) {
      safeResults = [Math.floor(Number(roll))];
    } else {
      for (let i = 0; i < safeCount; i += 1) {
        safeResults.push(Math.floor(Math.random() * validSides) + 1);
      }
    }
  }

  const safeCount = safeResults.length;
  const total = safeResults.reduce((acc, v) => acc + v, 0);
  const maxHits = safeResults.filter((v) => v === validSides).length;
  const fumbleHits = validSides === 20 ? safeResults.filter((v) => v === 1).length : 0;
  const allMax = safeResults.every((v) => v === validSides);
  const allFumble = validSides === 20 && safeResults.every((v) => v === 1);

  const isMax =
    safeCount === 1
      ? safeResults[0] === validSides
      : allMax || (validSides === 20 && maxHits > 0);
  const isFumble = validSides === 20 && allFumble;
  const formula = safeCount > 1 ? `${safeCount}d${validSides}` : `d${validSides}`;

  const nowMs = Date.now();
  const rollPayload = {
    event_type: 'dice_roll',
    map_id: String(map_id),
    user_id: String(user_id || 'anon'),
    user_name: String(user_name || 'Aventureiro').slice(0, 60),
    user_role: String(user_role || 'player'),
    sides: validSides,
    count: safeCount,
    results: safeResults,
    roll: total,
    total,
    formula,
    max_hits: maxHits,
    fumble_hits: fumbleHits,
    all_max: Boolean(allMax),
    seed: Number(seed),
    is_max: Boolean(isMax),
    is_fumble: Boolean(isFumble),
    x: 50,
    y: 50,
    color: isMax ? '#f59e0b' : isFumble ? '#f43f5e' : '#38bdf8',
    createdAtMs: nowMs,
    createdAt: serverTimestamp(),
  };

  // Usa map_pings (coleção já autorizada no Firestore em produção para Mestre e Jogadores)
  const docRef = await addDoc(collection(firestore, 'map_pings'), rollPayload);

  // Limite estrito das últimas 15 rolagens de dados: apaga a 15ª mais antiga ao entrar uma nova
  try {
    const snap = await getDocs(collection(firestore, 'map_pings'));
    const getDocTime = (d) => {
      const data = d.data();
      if (data?.createdAt?.toMillis) return data.createdAt.toMillis();
      if (data?.createdAt?.seconds) return data.createdAt.seconds * 1000;
      if (typeof data?.createdAtMs === 'number') return data.createdAtMs;
      return nowMs;
    };

    const rollDocs = snap.docs.filter(
      (d) => d.data()?.event_type === 'dice_roll' || d.data()?.roll !== undefined
    );
    if (rollDocs.length > 15) {
      const sortedRolls = [...rollDocs].sort((a, b) => getDocTime(b) - getDocTime(a));
      const excessRolls = sortedRolls.slice(15);
      await Promise.all(
        excessRolls.map((oldDoc) => deleteDoc(doc(firestore, 'map_pings', oldDoc.id)))
      );
    }

    // Limpa também pings de radar expirados (> 30s) para manter a coleção enxuta
    const expiredPings = snap.docs.filter((d) => {
      const data = d.data();
      if (data?.event_type === 'dice_roll' || data?.roll !== undefined) return false;
      const t = getDocTime(d);
      return t > 0 && nowMs - t > 30000;
    });
    if (expiredPings.length > 0) {
      await Promise.all(
        expiredPings.map((oldPing) => deleteDoc(doc(firestore, 'map_pings', oldPing.id)))
      );
    }
  } catch (cleanupErr) {
    console.warn('Aviso ao manter limite de 15 rolagens:', cleanupErr);
  }

  return {
    id: docRef.id,
    ...rollPayload,
  };
}

// =========================================================================
// FICHA EDITÁVEL EM PDF (Ficha.pdf) — SINCRONIZAÇÃO EM TEMPO REAL
// =========================================================================

function sanitizeSheetFieldValue(val) {
  if (typeof val === 'boolean') return val;
  if (val === null || val === undefined) return '';
  return String(val).slice(0, 6000);
}

function isPermissionDeniedError(err) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'permission-denied' ||
    code.includes('permission') ||
    msg.includes('insufficient permissions') ||
    msg.includes('permission_denied')
  );
}

/**
 * Inscreve-se em tempo real na ficha editável (Ficha.pdf) de um herói.
 * Usa a coleção dedicada `character_sheets/{uid}` e mantém listener em tempo real
 * no perfil (`profiles/{uid}.sheet_fields`) enquanto o documento em `character_sheets`
 * ainda não existir ou caso as regras da nova coleção ainda não tenham sido publicadas,
 * garantindo sincronização instantânea (estilo mapa tático) entre Jogador e Mestre
 * sem precisar fechar e reabrir a ficha.
 */
export function subscribeCharacterSheet(heroUid, onData, onError) {
  if (!heroUid) return () => {};
  const firestore = requireDb();
  const sheetRef = doc(firestore, 'character_sheets', heroUid);
  const profileRef = doc(firestore, 'profiles', heroUid);

  let active = true;
  let unsubProfile = null;
  let primaryDenied = false;
  let sheetDocExists = false;

  const stopProfileListener = () => {
    if (typeof unsubProfile === 'function') {
      unsubProfile();
      unsubProfile = null;
    }
  };

  const ensureProfileListener = (storageMode) => {
    if (!active || unsubProfile) return;
    unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (!active || sheetDocExists) return;
        const data = snap.exists() ? snap.data() : {};
        onData({
          uid: heroUid,
          fields: data?.sheet_fields && typeof data.sheet_fields === 'object' ? data.sheet_fields : {},
          updatedBy: data?.sheet_updated_by || null,
          updatedByName: data?.sheet_updated_by_name || null,
          updatedByRole: data?.sheet_updated_by_role || null,
          updatedBySession: data?.sheet_updated_by_session || null,
          updatedAt: data?.sheet_updated_at || data?.updatedAt || null,
          storageMode: primaryDenied ? 'profile-fallback' : storageMode,
          docExists: false,
        });
      },
      (err) => {
        if (active && onError) onError(err);
      }
    );
  };

  const unsubPrimary = onSnapshot(
    sheetRef,
    (snap) => {
      if (!active || primaryDenied) return;
      if (snap.exists()) {
        sheetDocExists = true;
        stopProfileListener();
        const data = snap.data();
        onData({
          uid: heroUid,
          fields: data?.fields && typeof data.fields === 'object' ? data.fields : {},
          updatedBy: data?.updatedBy || null,
          updatedByName: data?.updatedByName || null,
          updatedByRole: data?.updatedByRole || null,
          updatedBySession: data?.updatedBySession || null,
          updatedAt: data?.updatedAt || null,
          storageMode: 'collection',
          docExists: true,
        });
      } else {
        // Documento em character_sheets ainda não foi criado: mantém listener em tempo real
        // em profiles/{uid} para refletir instantaneamente qualquer edição legada ou em fallback
        sheetDocExists = false;
        ensureProfileListener('collection');
      }
    },
    (err) => {
      if (!active) return;
      if (isPermissionDeniedError(err)) {
        primaryDenied = true;
        sheetDocExists = false;
        ensureProfileListener('profile-fallback');
      } else if (onError) {
        onError(err);
      }
    }
  );

  return () => {
    active = false;
    if (typeof unsubPrimary === 'function') unsubPrimary();
    stopProfileListener();
  };
}

/**
 * Salva um ou mais campos editados da ficha (Ficha.pdf) de forma granular,
 * evitando conflito quando Jogador e Mestre editam campos diferentes simultaneamente.
 * Verifica existência antes de chamar updateDoc para não disparar falso permission-denied
 * na regra `resource.data.uid` quando o documento de `character_sheets/{uid}` ainda não existe.
 */
export async function saveCharacterSheetFields(
  heroUid,
  fieldPatch,
  editorMeta = {},
  optionsOrStorage = 'collection'
) {
  if (!heroUid || !fieldPatch || typeof fieldPatch !== 'object') return null;
  const entries = Object.entries(fieldPatch).filter(([k]) => /^[A-Za-z0-9_-]+$/.test(k));
  if (entries.length === 0) return null;

  const opts =
    typeof optionsOrStorage === 'string'
      ? { preferredStorage: optionsOrStorage, docExists: false, sessionId: null }
      : {
          preferredStorage: optionsOrStorage?.preferredStorage || 'collection',
          docExists: Boolean(optionsOrStorage?.docExists),
          sessionId: optionsOrStorage?.sessionId || null,
        };

  const firestore = requireDb();
  const cleanFieldsMap = {};
  entries.forEach(([k, v]) => {
    cleanFieldsMap[k] = sanitizeSheetFieldValue(v);
  });

  const editorUid = editorMeta?.uid ? String(editorMeta.uid).slice(0, 128) : null;
  const editorName = editorMeta?.username ? String(editorMeta.username).slice(0, 60) : null;
  const editorRole = editorMeta?.role === 'master' ? 'master' : 'player';
  const sessionId = opts.sessionId ? String(opts.sessionId).slice(0, 64) : null;

  const saveToProfileFallback = async () => {
    const profileRef = doc(firestore, 'profiles', heroUid);
    await setDoc(
      profileRef,
      {
        sheet_fields: cleanFieldsMap,
        sheet_updated_by: editorUid,
        sheet_updated_by_name: editorName,
        sheet_updated_by_role: editorRole,
        sheet_updated_by_session: sessionId,
        sheet_updated_at: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { storageMode: 'profile-fallback', docExists: false };
  };

  if (opts.preferredStorage === 'profile-fallback') {
    return await saveToProfileFallback();
  }

  const sheetRef = doc(firestore, 'character_sheets', heroUid);
  const dotPayload = {
    uid: heroUid,
    updatedBy: editorUid,
    updatedByName: editorName,
    updatedByRole: editorRole,
    updatedBySession: sessionId,
    updatedAt: serverTimestamp(),
  };
  entries.forEach(([k]) => {
    dotPayload[`fields.${k}`] = cleanFieldsMap[k];
  });

  const createSheetDocument = async () => {
    let initialFields = { ...cleanFieldsMap };
    try {
      const profSnap = await getDoc(doc(firestore, 'profiles', heroUid));
      const legacy = profSnap.exists() ? profSnap.data()?.sheet_fields : null;
      if (legacy && typeof legacy === 'object') {
        initialFields = { ...legacy, ...cleanFieldsMap };
      }
    } catch {}

    await setDoc(sheetRef, {
      uid: heroUid,
      fields: initialFields,
      updatedBy: editorUid,
      updatedByName: editorName,
      updatedByRole: editorRole,
      updatedBySession: sessionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { storageMode: 'collection', docExists: true };
  };

  try {
    if (opts.docExists) {
      await updateDoc(sheetRef, dotPayload);
      return { storageMode: 'collection', docExists: true };
    }

    // Antes do primeiro updateDoc, confirma existência do documento para chamar create limpo
    // (evitando falso permission-denied em `resource.data.uid` quando o doc ainda não existe)
    const existingSnap = await getDoc(sheetRef);
    if (existingSnap.exists()) {
      await updateDoc(sheetRef, dotPayload);
      return { storageMode: 'collection', docExists: true };
    }

    try {
      return await createSheetDocument();
    } catch (createErr) {
      // Se outro usuário criou o documento no mesmo milissegundo, faz updateDoc sem createdAt
      if (isPermissionDeniedError(createErr)) {
        try {
          const retrySnap = await getDoc(sheetRef);
          if (retrySnap.exists()) {
            await updateDoc(sheetRef, dotPayload);
            return { storageMode: 'collection', docExists: true };
          }
        } catch {}
        return await saveToProfileFallback();
      }
      throw createErr;
    }
  } catch (err) {
    if (err?.code === 'not-found') {
      try {
        return await createSheetDocument();
      } catch (createErr) {
        if (isPermissionDeniedError(createErr)) {
          return await saveToProfileFallback();
        }
        throw createErr;
      }
    }
    if (isPermissionDeniedError(err)) {
      return await saveToProfileFallback();
    }
    throw err;
  }
}

// =========================================================================
// MÚSICA & PLAYLIST SINCRONIZADA DA MESA EM TEMPO REAL (TABLETOP JUKEBOX)
// =========================================================================

const AUDIO_CHUNK_SIZE = 720000;
const AUDIO_MAX_CHUNKS = 15; // ~10.8 MB base64 (~8 MB arquivo MP3/OGG/WebM)
const audioTrackBlobCache = new Map();

function sanitizeTrackEntry(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const sourceType = ['youtube', 'url', 'upload', 'synth'].includes(raw.sourceType)
    ? raw.sourceType
    : 'synth';
  const entry = {
    id: String(raw.id || `track-${idx}-${Date.now()}`).slice(0, 128),
    title: String(raw.title || 'Faixa Sem Título').trim().slice(0, 120) || 'Faixa Sem Título',
    artist: String(raw.artist || '').trim().slice(0, 80),
    category: String(raw.category || 'tavern').slice(0, 32),
    sourceType,
    synthId: raw.synthId ? String(raw.synthId).slice(0, 32) : '',
    youtubeId: raw.youtubeId ? String(raw.youtubeId).slice(0, 32) : '',
    url: raw.url ? String(raw.url).trim().slice(0, 2000) : '',
    duration: Number.isFinite(Number(raw.duration)) && Number(raw.duration) > 0
      ? Math.min(86400, Math.round(Number(raw.duration) * 10) / 10)
      : 0,
    chunkCount: Number.isFinite(Number(raw.chunkCount)) ? Math.max(0, Math.min(32, Math.floor(Number(raw.chunkCount)))) : 0,
    mimeType: raw.mimeType ? String(raw.mimeType).slice(0, 64) : '',
  };
  if (typeof raw.inlineDataUrl === 'string' && raw.inlineDataUrl.length <= 680000) {
    entry.inlineDataUrl = raw.inlineDataUrl;
  }
  return entry;
}

/**
 * Inscreve-se em tempo real no estado de áudio/playlist sincronizado da mesa (`table_audio/main`).
 * Mantém fallback automático para `map_rolls/table_audio_state` (sem campo `createdAt`, portanto
 * ignorado por `orderBy('createdAt')` em `diceRolls`) caso as novas regras ainda não tenham sido publicadas.
 */
export function subscribeTableAudio(onData, onError) {
  const firestore = requireDb();
  const primaryRef = doc(firestore, 'table_audio', 'main');
  const fallbackRef = doc(firestore, 'map_rolls', 'table_audio_state');

  let active = true;
  let primaryDenied = false;
  let primaryDocExists = false;
  let unsubFallback = null;

  const stopFallback = () => {
    if (typeof unsubFallback === 'function') {
      unsubFallback();
      unsubFallback = null;
    }
  };

  const emitSnapshot = (snap, storageMode) => {
    if (!active) return;
    if (!snap.exists()) {
      onData({ exists: false, storageMode, data: null });
      return;
    }
    const raw = snap.data() || {};
    onData({
      exists: true,
      storageMode,
      hasPendingWrites: Boolean(snap.metadata?.hasPendingWrites),
      data: {
        playlist: Array.isArray(raw.playlist) ? raw.playlist : null,
        currentTrackId: raw.currentTrackId || null,
        currentIndex: Number.isFinite(Number(raw.currentIndex)) ? Number(raw.currentIndex) : 0,
        isPlaying: Boolean(raw.isPlaying),
        basePositionSec: Number.isFinite(Number(raw.basePositionSec)) ? Math.max(0, Number(raw.basePositionSec)) : 0,
        anchorClientMs: Number.isFinite(Number(raw.anchorClientMs)) ? Number(raw.anchorClientMs) : null,
        serverUpdatedAtMs: raw.serverUpdatedAt?.toMillis
          ? raw.serverUpdatedAt.toMillis()
          : raw.serverUpdatedAt?.seconds
          ? raw.serverUpdatedAt.seconds * 1000
          : null,
        loopMode: ['playlist', 'one', 'off'].includes(raw.loopMode) ? raw.loopMode : 'playlist',
        shuffle: Boolean(raw.shuffle),
        syncVersion: Number.isFinite(Number(raw.syncVersion)) ? Number(raw.syncVersion) : 0,
        updatedBy: raw.updatedBy || null,
        updatedByName: raw.updatedByName || null,
      },
    });
  };

  const ensureFallbackListener = () => {
    if (!active || unsubFallback) return;
    unsubFallback = onSnapshot(
      fallbackRef,
      (snap) => {
        if (!active || primaryDocExists) return;
        emitSnapshot(snap, primaryDenied ? 'fallback' : 'collection');
      },
      (err) => {
        if (active && onError) onError(err);
      }
    );
  };

  const unsubPrimary = onSnapshot(
    primaryRef,
    (snap) => {
      if (!active || primaryDenied) return;
      if (snap.exists()) {
        primaryDocExists = true;
        stopFallback();
        emitSnapshot(snap, 'collection');
      } else {
        primaryDocExists = false;
        ensureFallbackListener();
      }
    },
    (err) => {
      if (!active) return;
      if (isPermissionDeniedError(err)) {
        primaryDenied = true;
        primaryDocExists = false;
        ensureFallbackListener();
      } else if (onError) {
        onError(err);
      }
    }
  );

  return () => {
    active = false;
    if (typeof unsubPrimary === 'function') unsubPrimary();
    stopFallback();
  };
}

/**
 * Persiste alterações de reprodução/playlist do Mestre para todos os clientes em tempo real.
 */
export async function saveTableAudioState(statePatch, preferredStorage = 'collection') {
  const firestore = requireDb();
  const payload = {
    updatedAt: serverTimestamp(),
  };

  if (Array.isArray(statePatch.playlist)) {
    payload.playlist = statePatch.playlist
      .slice(0, 100)
      .map((item, idx) => sanitizeTrackEntry(item, idx))
      .filter(Boolean);
  }
  if (statePatch.currentTrackId !== undefined) {
    payload.currentTrackId = statePatch.currentTrackId ? String(statePatch.currentTrackId).slice(0, 128) : null;
  }
  if (statePatch.currentIndex !== undefined) {
    payload.currentIndex = Math.max(-1, Math.min(100, Math.floor(Number(statePatch.currentIndex) || 0)));
  }
  if (statePatch.isPlaying !== undefined) {
    payload.isPlaying = Boolean(statePatch.isPlaying);
  }
  if (statePatch.basePositionSec !== undefined) {
    payload.basePositionSec = Math.max(0, Math.min(86400, Math.round(Number(statePatch.basePositionSec || 0) * 100) / 100));
  }
  if (statePatch.anchorClientMs !== undefined) {
    payload.anchorClientMs = Math.max(0, Math.round(Number(statePatch.anchorClientMs) || Date.now()));
  }
  if (statePatch.loopMode !== undefined) {
    payload.loopMode = ['playlist', 'one', 'off'].includes(statePatch.loopMode) ? statePatch.loopMode : 'playlist';
  }
  if (statePatch.shuffle !== undefined) {
    payload.shuffle = Boolean(statePatch.shuffle);
  }
  if (statePatch.syncVersion !== undefined) {
    payload.syncVersion = Math.max(0, Math.min(100000000, Math.floor(Number(statePatch.syncVersion) || 0)));
    payload.serverUpdatedAt = serverTimestamp();
  }
  if (statePatch.updatedBy !== undefined) {
    payload.updatedBy = statePatch.updatedBy ? String(statePatch.updatedBy).slice(0, 128) : null;
  }
  if (statePatch.updatedByName !== undefined) {
    payload.updatedByName = statePatch.updatedByName ? String(statePatch.updatedByName).slice(0, 60) : null;
  }

  const writeFallback = async () => {
    const fallbackRef = doc(firestore, 'map_rolls', 'table_audio_state');
    await setDoc(fallbackRef, payload, { merge: true });
    return { storageMode: 'fallback' };
  };

  if (preferredStorage === 'fallback') {
    return await writeFallback();
  }

  try {
    const primaryRef = doc(firestore, 'table_audio', 'main');
    await setDoc(primaryRef, payload, { merge: true });
    return { storageMode: 'collection' };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      return await writeFallback();
    }
    throw err;
  }
}

/**
 * Faz upload de arquivo de áudio (MP3/OGG/WebM/M4A) em chunks para `table_audio/main/audio_chunks`
 * ou inline caso seja compacto (<= 680 KB).
 */
export async function uploadTableAudioTrackFile(trackId, dataUrl, mimeType = 'audio/mpeg') {
  if (!trackId || typeof dataUrl !== 'string') {
    throw new Error('Arquivo de áudio inválido.');
  }

  if (dataUrl.length <= 680000) {
    return {
      inlineDataUrl: dataUrl,
      chunkCount: 0,
      mimeType,
    };
  }

  const parsed = parseDataUrlParts(dataUrl);
  if (!parsed || !parsed.isBase64 || !parsed.body) {
    throw new Error('Formato de arquivo de áudio não suportado.');
  }

  const totalChunks = Math.ceil(parsed.body.length / AUDIO_CHUNK_SIZE);
  if (totalChunks > AUDIO_MAX_CHUNKS) {
    throw new Error(
      'Arquivo de áudio muito grande (máx. ~8 MB). Para músicas longas, use um link do YouTube ou URL direta de áudio.'
    );
  }

  const firestore = requireDb();
  const chunks = [];
  for (let i = 0; i < totalChunks; i += 1) {
    chunks.push({
      index: i,
      data: parsed.body.slice(i * AUDIO_CHUNK_SIZE, (i + 1) * AUDIO_CHUNK_SIZE),
    });
  }

  try {
    for (let i = 0; i < chunks.length; i += 3) {
      const slice = chunks.slice(i, i + 3);
      await Promise.all(
        slice.map((chunk) =>
          setDoc(doc(firestore, 'table_audio', 'main', 'audio_chunks', `${trackId}_${chunk.index}`), {
            track_id: trackId,
            index: chunk.index,
            data: chunk.data,
            createdAt: serverTimestamp(),
          })
        )
      );
    }

    try {
      const localBlobUrl = base64ToBlobUrl(parsed.body, parsed.mime || mimeType);
      audioTrackBlobCache.set(trackId, localBlobUrl);
    } catch {}

    return {
      inlineDataUrl: null,
      chunkCount: totalChunks,
      mimeType: parsed.mime || mimeType,
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      throw new Error(
        'Publicação de arquivos de áudio acima de 500 KB requer publicar firestore.rules no Firebase. Para usar agora mesmo sem deploy, cole um link do YouTube ou URL direta.'
      );
    }
    throw err;
  }
}

/**
 * Carrega e monta em cache (Blob URL) um arquivo de áudio enviado pelo Mestre.
 */
export async function loadTableAudioTrackUrl(track) {
  if (!track) return null;
  if (track.sourceType === 'url') return track.url || null;
  if (track.sourceType !== 'upload') return null;
  if (track.inlineDataUrl) return track.inlineDataUrl;
  if (audioTrackBlobCache.has(track.id)) {
    return audioTrackBlobCache.get(track.id);
  }

  try {
    const firestore = requireDb();
    const snap = await getDocs(
      query(
        collection(firestore, 'table_audio', 'main', 'audio_chunks'),
        where('track_id', '==', track.id)
      )
    );
    if (snap.empty) return null;

    const ordered = snap.docs
      .map((d) => d.data())
      .filter((d) => typeof d?.data === 'string' && d.data.length > 0)
      .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));

    if (ordered.length === 0) return null;

    const fullBase64 = ordered.map((c) => c.data).join('');
    const blobUrl = base64ToBlobUrl(fullBase64, track.mimeType || 'audio/mpeg');
    audioTrackBlobCache.set(track.id, blobUrl);
    return blobUrl;
  } catch {
    return null;
  }
}

export async function deleteTableAudioTrackChunks(trackId) {
  if (!trackId) return;
  const cached = audioTrackBlobCache.get(trackId);
  if (cached && cached.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(cached);
    } catch {}
  }
  audioTrackBlobCache.delete(trackId);

  try {
    const firestore = requireDb();
    const snap = await getDocs(
      query(
        collection(firestore, 'table_audio', 'main', 'audio_chunks'),
        where('track_id', '==', trackId)
      )
    );
    if (!snap.empty) {
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    }
  } catch {}
}
