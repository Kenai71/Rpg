import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
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
import {
  MAX_FOG_OPS,
  buildPlayerSpawnFogOp,
  normalizeFogOfWar,
  normalizeFogOp,
} from './map-fog';
import { sanitizeMediaUrl } from './upload-security';

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
      const sanitized = sanitizeMediaUrl(String(photoURL).trim());
      if (!sanitized) {
        throw new Error('URL de foto de perfil inválida ou bloqueada por segurança.');
      }
      cleanPhoto = sanitized;
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

const HD_MAP_CHUNK_SIZE = 740000; // Múltiplo exato de 4 (decodificação base64 bloco a bloco sem concatenar string gigante)
const HD_MAP_MAX_CHUNKS = 30; // Até ~16,6 MB binários (~22,2 MB base64), seguro dentro do limite de 32 chunks das regras Firestore
const SINGLE_DOC_IMAGE_LIMIT = 885000;
const mapHdUrlCache = new Map();
const mapHdLoadingPromises = new Map();

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

function blobToBase64Parts(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseDataUrlParts(reader.result);
      if (parsed && parsed.isBase64 && parsed.body.length > 0) {
        resolve({ mime: blob.type || parsed.mime || 'image/webp', body: parsed.body });
      } else {
        reject(new Error('Falha ao preparar blocos HD da imagem.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler dados HD da imagem.'));
    reader.readAsDataURL(blob);
  });
}

function decodeBase64ChunksToBlobUrl(chunkStrings, mimeType = 'image/webp') {
  if (typeof window === 'undefined' || typeof atob === 'undefined') {
    return `data:${mimeType};base64,${chunkStrings.join('')}`;
  }

  const byteParts = [];
  let carry = '';

  for (let c = 0; c < chunkStrings.length; c += 1) {
    const combined = carry + chunkStrings[c];
    const isLast = c === chunkStrings.length - 1;
    const usableLen = isLast ? combined.length : combined.length - (combined.length % 4);
    const slice = combined.slice(0, usableLen);
    carry = isLast ? '' : combined.slice(usableLen);

    if (slice.length > 0) {
      const binary = atob(slice);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      byteParts.push(bytes);
    }
  }

  const blob = new Blob(byteParts, { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Converte uma string Base64 única (ex: trilha de áudio em chunks) em Blob URL segura em memória.
 */
function base64ToBlobUrl(base64Body, mimeType = 'audio/mpeg') {
  if (typeof base64Body !== 'string' || base64Body.length === 0) return null;
  return decodeBase64ChunksToBlobUrl([base64Body], mimeType);
}

/**
 * Executa qualquer volume de operações em lotes seguros de no máximo 400 escritas
 * (respeitando o limite rígido de 500 operações/batch do Cloud Firestore).
 */
async function commitChunkedBatchOps(firestore, ops = [], chunkSize = 400) {
  if (!Array.isArray(ops) || ops.length === 0) return;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(firestore);
    const slice = ops.slice(i, i + chunkSize);
    slice.forEach((op) => {
      if (op.type === 'delete') batch.delete(op.ref);
      else if (op.type === 'set') batch.set(op.ref, op.data, op.options || undefined);
      else if (op.type === 'update') batch.update(op.ref, op.data);
    });
    await batch.commit();
  }
}

async function writeChunkWithRetry(chunkRef, payload, maxAttempts = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await setDoc(chunkRef, payload);
      return;
    } catch (err) {
      lastErr = err;
      // Erro de permissão não adianta repetir — dispara fallback imediatamente
      if (err?.code === 'permission-denied') {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 350 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Carrega a imagem em resolução máxima (HD) de um mapa, reassemblando os chunks
 * da subcoleção `maps/{mapId}/image_chunks` quando o mapa excede 1 MiB.
 * Mantém cache em memória (Blob URL), desduplica carregamentos simultâneos e
 * decodifica bloco-a-bloco para baixo consumo de RAM mesmo em mapas de 15+ MB.
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
  if (mapHdLoadingPromises.has(cacheKey)) {
    return mapHdLoadingPromises.get(cacheKey);
  }

  const loadPromise = (async () => {
    try {
      const firestore = requireDb();
      const chunksSnap = await getDocs(collection(firestore, 'maps', map.id, 'image_chunks'));
      if (chunksSnap.empty) return fallback;

      const ordered = chunksSnap.docs
        .map((d) => d.data())
        .filter((d) => typeof d?.data === 'string' && d.data.length > 0)
        .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));

      if (ordered.length < chunkCount) {
        console.warn(
          `Mapa ${map.id} possui chunks HD incompletos (${ordered.length}/${chunkCount}); mantendo imagem base.`
        );
        return fallback;
      }

      const mime = map.hd_mime_type || 'image/webp';
      const firstData = ordered[0]?.data || '';
      const resolvedUrl = firstData.startsWith('data:')
        ? ordered.map((c) => c.data).join('')
        : decodeBase64ChunksToBlobUrl(
            ordered.map((c) => c.data),
            mime
          );

      mapHdUrlCache.set(cacheKey, resolvedUrl);
      return resolvedUrl;
    } catch (err) {
      console.warn('Usando imagem base do mapa (chunks HD indisponíveis):', err?.message || err);
      return fallback;
    } finally {
      mapHdLoadingPromises.delete(cacheKey);
    }
  })();

  mapHdLoadingPromises.set(cacheKey, loadPromise);
  return loadPromise;
}

export async function createMap({
  title,
  imageUrl,
  hdBlob = null,
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
  onProgress = null,
}) {
  const report = (percent, label) => {
    if (typeof onProgress === 'function') {
      onProgress({ percent: Math.max(0, Math.min(100, Math.round(percent))), label });
    }
  };

  const firestore = requireDb();
  const mapsRef = collection(firestore, 'maps');
  const mapRef = doc(mapsRef);
  const cleanTitle = String(title || 'Mapa Sem Nome').trim().slice(0, 150);

  // Preserva a proporção EXATA mesmo se a imagem original exceder 32768px em algum eixo
  let safeNaturalW =
    Number.isFinite(Number(naturalWidth)) && Number(naturalWidth) >= 1
      ? Math.round(Number(naturalWidth))
      : null;
  let safeNaturalH =
    Number.isFinite(Number(naturalHeight)) && Number(naturalHeight) >= 1
      ? Math.round(Number(naturalHeight))
      : null;

  if (safeNaturalW && safeNaturalH && (safeNaturalW > 32768 || safeNaturalH > 32768)) {
    const r = Math.min(32768 / safeNaturalW, 32768 / safeNaturalH);
    safeNaturalW = Math.max(1, Math.round(safeNaturalW * r));
    safeNaturalH = Math.max(1, Math.round(safeNaturalH * r));
  } else {
    if (safeNaturalW) safeNaturalW = Math.min(32768, safeNaturalW);
    if (safeNaturalH) safeNaturalH = Math.min(32768, safeNaturalH);
  }

  const resolvedGridSize =
    Number.isFinite(Number(gridSize)) && Number(gridSize) >= 10
      ? Math.max(10, Math.min(300, Math.round(Number(gridSize))))
      : computeAutoGridSize(safeNaturalW || 1400, safeNaturalH || 900);

  let finalImageUrl = String(imageUrl || '').trim();
  let hdChunkCount = 0;
  let hdMimeType = null;

  // Resolve payload HD a partir de hdBlob (preferido, menor uso de RAM) ou hdDataUrl legado
  let hdParts = null;
  if (hdBlob && typeof Blob !== 'undefined' && hdBlob instanceof Blob && hdBlob.size > 0) {
    report(6, 'Preparando blocos Ultra HD...');
    hdParts = await blobToBase64Parts(hdBlob);
  } else if (typeof hdDataUrl === 'string' && hdDataUrl.length > SINGLE_DOC_IMAGE_LIMIT) {
    const parsed = parseDataUrlParts(hdDataUrl);
    if (parsed && parsed.isBase64 && parsed.body.length > 0) {
      hdParts = { mime: parsed.mime, body: parsed.body };
    }
  }

  // Se houver versão HD maior que 1 documento Firestore, grava chunks com retry automático e progresso ao vivo
  if (hdParts && hdParts.body.length > SINGLE_DOC_IMAGE_LIMIT) {
    const totalChunks = Math.ceil(hdParts.body.length / HD_MAP_CHUNK_SIZE);
    if (totalChunks >= 1 && totalChunks <= HD_MAP_MAX_CHUNKS) {
      const chunks = [];
      for (let i = 0; i < totalChunks; i += 1) {
        chunks.push({
          index: i,
          data: hdParts.body.slice(i * HD_MAP_CHUNK_SIZE, (i + 1) * HD_MAP_CHUNK_SIZE),
        });
      }

      const uploadedChunkRefs = [];
      try {
        let completed = 0;
        // Lotes de 2 chunks em paralelo (estável em conexões lentas e seguro contra limite de 10 MiB/req)
        for (let i = 0; i < chunks.length; i += 2) {
          const slice = chunks.slice(i, i + 2);
          await Promise.all(
            slice.map(async (chunk) => {
              const chunkRef = doc(firestore, 'maps', mapRef.id, 'image_chunks', String(chunk.index));
              await writeChunkWithRetry(chunkRef, {
                map_id: mapRef.id,
                index: chunk.index,
                data: chunk.data,
                createdAt: serverTimestamp(),
              });
              uploadedChunkRefs.push(chunkRef);
              completed += 1;
              const pct = 10 + Math.round((completed / chunks.length) * 80);
              report(pct, `Enviando mapa Ultra HD (${completed}/${chunks.length} blocos)...`);
            })
          );
        }

        hdChunkCount = chunks.length;
        hdMimeType = hdParts.mime;

        // Já popula o cache local com Blob URL para exibição instantânea sem esperar releitura
        try {
          const localBlobUrl =
            hdBlob && typeof URL !== 'undefined'
              ? URL.createObjectURL(hdBlob)
              : decodeBase64ChunksToBlobUrl(
                  chunks.map((c) => c.data),
                  hdParts.mime
                );
          mapHdUrlCache.set(`${mapRef.id}_${hdChunkCount}`, localBlobUrl);
        } catch {}
      } catch (chunkErr) {
        console.warn(
          'Subcoleção HD indisponível ou interrompida; salvando mapa em alta qualidade otimizada no documento principal:',
          chunkErr?.message || chunkErr
        );
        // Limpa blocos órfãos se o upload foi interrompido no meio
        if (uploadedChunkRefs.length > 0) {
          Promise.all(uploadedChunkRefs.map((ref) => deleteDoc(ref).catch(() => {}))).catch(() => {});
        }
        hdChunkCount = 0;
        hdMimeType = null;
        if (fallbackImageUrl && fallbackImageUrl.length <= SINGLE_DOC_IMAGE_LIMIT) {
          finalImageUrl = fallbackImageUrl;
        }
      }
    } else if (fallbackImageUrl && fallbackImageUrl.length <= SINGLE_DOC_IMAGE_LIMIT) {
      // Se exceder o teto de chunks, usa sempre o fallback de alta qualidade (nunca a miniatura de 1100px!)
      finalImageUrl = fallbackImageUrl;
    }
  }

  if (finalImageUrl.length > 940000) {
    if (fallbackImageUrl && fallbackImageUrl.length <= 940000) {
      finalImageUrl = fallbackImageUrl;
    } else {
      throw new Error('A imagem do mapa excede o limite suportado. Tente outro formato (WebP/JPG/PNG).');
    }
  }

  report(94, 'Registrando mapa na mesa...');

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
  report(100, 'Mapa pronto na mesa!');
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

/**
 * Adiciona operações à Névoa de Guerra Manual de forma atômica (runTransaction),
 * evitando sobrescrita quando múltiplos jogadores exploram o mapa simultaneamente.
/**
 * Assina os documentos de exploração individual de Névoa de Guerra (`maps/{mapId}/player_fog/{uid}`).
 * - Mestre ouve todos os jogadores do mapa.
 * - Jogador ouve EXCLUSIVAMENTE o próprio documento `{uid}` (privacidade total + mínimo de leituras).
 */
export function subscribePlayerFog(mapId, isMaster, currentUserId, onData, onError) {
  if (!mapId) {
    onData?.([]);
    return () => {};
  }
  const firestore = requireDb();

  if (isMaster) {
    const colRef = collection(firestore, 'maps', String(mapId), 'player_fog');
    return onSnapshot(
      colRef,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() }));
        onData?.(docs);
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          onData?.([]);
          return;
        }
        onError?.(err);
      }
    );
  }

  if (!currentUserId) {
    onData?.([]);
    return () => {};
  }

  const docRef = doc(firestore, 'maps', String(mapId), 'player_fog', String(currentUserId));
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onData?.([]);
        return;
      }
      onData?.([{ id: snap.id, uid: snap.id, ...snap.data() }]);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        onData?.([]);
        return;
      }
      onError?.(err);
    }
  );
}

/**
 * Grava operações de descoberta de Névoa de Guerra no documento dedicado do jogador
 * (`maps/{mapId}/player_fog/{uid}`) via transação isolada — zero contenção em `maps/{mapId}`
 * mesmo com dezenas de jogadores explorando simultaneamente e zero risco de estourar 1 MiB.
 */
export async function appendPlayerFogOpsTx(
  mapId,
  playerUid,
  newOps = [],
  { requireEnabled = true, resetVersion = null } = {}
) {
  if (!mapId || !playerUid || !Array.isArray(newOps) || newOps.length === 0) return false;
  const firestore = requireDb();
  const safeMapId = String(mapId).slice(0, 128);
  const safeUid = String(playerUid).slice(0, 128);
  const mapRef = doc(firestore, 'maps', safeMapId);
  const playerFogRef = doc(firestore, 'maps', safeMapId, 'player_fog', safeUid);

  let targetVersion =
    typeof resetVersion === 'number' && Number.isFinite(resetVersion)
      ? Math.max(0, Math.floor(resetVersion))
      : null;

  if (requireEnabled || targetVersion === null) {
    try {
      const mapSnap = await getDoc(mapRef);
      if (!mapSnap.exists()) return false;
      const mapFog = normalizeFogOfWar(mapSnap.data()?.fog_of_war);
      if (requireEnabled && !mapFog.enabled) return false;
      targetVersion = mapFog.resetVersion;
    } catch {
      return false;
    }
  }

  const PLAYER_FOG_MAX_OPS = 220;
  let updated = false;

  try {
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(playerFogRef);
      const existingData = snap.exists() ? snap.data() : null;
      const sameVersion =
        existingData && Math.floor(Number(existingData.resetVersion) || 0) === targetVersion;
      const baseOps = sameVersion && Array.isArray(existingData.ops) ? existingData.ops : [];
      const existingIds = new Set(baseOps.map((o) => o?.id).filter(Boolean));

      const nowMs = Date.now();
      const validNew = newOps
        .map((raw, i) =>
          normalizeFogOp({ ...raw, viewerUid: safeUid, ts: raw?.ts || nowMs }, baseOps.length + i)
        )
        .filter((op) => op && !existingIds.has(op.id));
      if (validNew.length === 0) return;

      const mergedOps = [...baseOps, ...validNew].slice(-PLAYER_FOG_MAX_OPS);
      tx.set(playerFogRef, {
        uid: safeUid,
        map_id: safeMapId,
        resetVersion: targetVersion,
        ops: mergedOps,
        updatedAt: serverTimestamp(),
      });
      updated = true;
    });
  } catch (err) {
    // Fallback compatível caso firestore.rules antigas ainda não tenham `player_fog` publicado
    if (isPermissionDeniedError(err)) {
      return appendMapFogOpsTx(safeMapId, newOps, { requireEnabled });
    }
    throw err;
  }

  return updated;
}

/**
 * Adiciona operações à Névoa de Guerra Manual de forma atômica (runTransaction).
 */
export async function appendMapFogOpsTx(mapId, newOps = [], { requireEnabled = true } = {}) {
  if (!mapId || !Array.isArray(newOps) || newOps.length === 0) return false;
  const firestore = requireDb();
  const mapRef = doc(firestore, 'maps', String(mapId));

  let updated = false;
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(mapRef);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const currentFog = normalizeFogOfWar(data.fog_of_war);
    if (requireEnabled && !currentFog.enabled) return;

    const existingIds = new Set(currentFog.ops.map((o) => o.id));
    const nowMs = Date.now();
    const validNew = newOps
      .map((raw, i) => normalizeFogOp({ ...raw, ts: raw?.ts || nowMs }, currentFog.ops.length + i))
      .filter((op) => op && !existingIds.has(op.id));
    if (validNew.length === 0) return;

    const mergedOps = [...currentFog.ops, ...validNew].slice(-MAX_FOG_OPS);
    tx.update(mapRef, {
      fog_of_war: {
        ...currentFog,
        ops: mergedOps,
      },
      updatedAt: serverTimestamp(),
    });
    updated = true;
  });

  return updated;
}

export async function setActiveMapTx(activeMapId) {
  const firestore = requireDb();
  const mapsSnap = await getDocs(collection(firestore, 'maps'));
  const ops = mapsSnap.docs.map((d) => ({
    type: 'update',
    ref: d.ref,
    data: {
      is_active: d.id === activeMapId,
      updatedAt: serverTimestamp(),
    },
  }));
  await commitChunkedBatchOps(firestore, ops);
}

export async function deleteMapWithTokens(mapId) {
  if (!mapId) return;
  const firestore = requireDb();

  // Remove chunks HD associados em lotes controlados (suporta mapas grandes de até 30 chunks)
  try {
    const chunksSnap = await getDocs(collection(firestore, 'maps', mapId, 'image_chunks'));
    if (!chunksSnap.empty) {
      const docs = chunksSnap.docs;
      for (let i = 0; i < docs.length; i += 5) {
        const slice = docs.slice(i, i + 5);
        await Promise.all(slice.map((c) => deleteDoc(c.ref).catch(() => {})));
      }
    }
  } catch {}

  // Remove documentos de exploração individual de névoa associados ao mapa
  try {
    const fogSnap = await getDocs(collection(firestore, 'maps', mapId, 'player_fog'));
    if (!fogSnap.empty) {
      await commitChunkedBatchOps(
        firestore,
        fogSnap.docs.map((d) => ({ type: 'delete', ref: d.ref }))
      );
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

  // Remove traços livres associados ao mapa (evita órfãos no Firestore)
  try {
    await clearMapDrawings(mapId);
  } catch {}

  const ops = [];

  // Deleta tokens associados
  const tokensSnap = await getDocs(
    query(collection(firestore, 'map_tokens'), where('map_id', '==', mapId))
  );
  tokensSnap.forEach((t) => ops.push({ type: 'delete', ref: t.ref }));

  // Deleta o mapa
  ops.push({ type: 'delete', ref: doc(firestore, 'maps', mapId) });

  // Se o mapa era ativo, checa se há outro mapa para promover a ativo
  const allMapsSnap = await getDocs(collection(firestore, 'maps'));
  const otherMaps = allMapsSnap.docs.filter((d) => d.id !== mapId);
  const deletedWasActive = allMapsSnap.docs.some((d) => d.id === mapId && d.data()?.is_active);

  if (deletedWasActive && otherMaps.length > 0) {
    ops.push({
      type: 'update',
      ref: otherMaps[0].ref,
      data: { is_active: true, updatedAt: serverTimestamp() },
    });
  }

  await commitChunkedBatchOps(firestore, ops);
}

export function getTokenSyncGroupId(token) {
  if (!token) return null;
  if (typeof token.sync_group_id === 'string' && token.sync_group_id.trim()) {
    return token.sync_group_id.trim();
  }
  if (token.type === 'player' && token.character_id) {
    return `hero:${token.character_id}`;
  }
  if (token.id) {
    return `tok:${token.id}`;
  }
  return null;
}

export async function createMapToken(data) {
  const firestore = requireDb();
  const tokensRef = collection(firestore, 'map_tokens');
  const tokenRef = doc(tokensRef);

  const cleanName = String(data.name || 'Guerreiro').trim().slice(0, 100);
  const size = ['S', 'M', 'L', 'H', 'G'].includes(data.size) ? data.size : 'M';
  const type = ['player', 'npc', 'monster'].includes(data.type) ? data.type : 'player';

  const xVal = typeof data.x === 'number' ? data.x : Number(data.x);
  const yVal = typeof data.y === 'number' ? data.y : Number(data.y);
  const finalX = Number.isFinite(xVal) ? Math.max(0, Math.min(100, Math.round(xVal * 10000) / 10000)) : 50;
  const finalY = Number.isFinite(yVal) ? Math.max(0, Math.min(100, Math.round(yVal * 10000) / 10000)) : 50;

  const isAllyDefault = type === 'player';
  const nameHiddenDefault = type === 'monster';
  const resolvedMoveLimit =
    data.move_limit !== undefined
      ? data.move_limit === null
        ? null
        : Math.max(0, Math.min(200, Math.round((Number(data.move_limit) || 0) * 10) / 10))
      : type === 'player'
      ? null
      : 9;
  const syncGroupId =
    typeof data.sync_group_id === 'string' && data.sync_group_id.trim()
      ? data.sync_group_id.trim().slice(0, 128)
      : type === 'player' && data.character_id
      ? `hero:${String(data.character_id).slice(0, 118)}`
      : data.npc_id
      ? `npc:${String(data.npc_id).slice(0, 118)}`
      : `tok:${tokenRef.id}`;

  await setDoc(tokenRef, {
    map_id: String(data.map_id),
    name: cleanName,
    type,
    character_id: data.character_id || null,
    owner_id: data.owner_id || null,
    sync_group_id: syncGroupId,
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
    npc_id: data.npc_id ? String(data.npc_id).slice(0, 128) : null,
    npc_profession: data.npc_profession ? String(data.npc_profession).slice(0, 120) : null,
    npc_role: data.npc_role ? String(data.npc_role).slice(0, 60) : null,
    move_limit: resolvedMoveLimit,
    move_used: 0,
    updatedAt: serverTimestamp(),
  });

  // Assim que um jogador é inserido no mapa, descobre um pequeno círculo em volta dele (apenas p/ ele)
  if (type === 'player') {
    const playerUid = data.owner_id || data.character_id;
    const spawnOp = buildPlayerSpawnFogOp(playerUid, finalX, finalY);
    if (spawnOp && playerUid) {
      appendPlayerFogOpsTx(String(data.map_id), playerUid, [spawnOp], { requireEnabled: true }).catch(
        () => {}
      );
    }
  }

  return tokenRef.id;
}

export async function updateMapTokenPosition(tokenId, { x, y, move_used }) {
  if (!tokenId) return;
  const firestore = requireDb();
  const tokenRef = doc(firestore, 'map_tokens', tokenId);

  const numX = Number(x);
  const numY = Number(y);
  if (!Number.isFinite(numX) || !Number.isFinite(numY)) return;

  const payload = {
    x: Math.max(0, Math.min(100, Math.round(numX * 10000) / 10000)),
    y: Math.max(0, Math.min(100, Math.round(numY * 10000) / 10000)),
    updatedAt: serverTimestamp(),
  };

  if (move_used !== undefined && Number.isFinite(Number(move_used))) {
    payload.move_used = Math.max(0, Math.min(500, Math.round(Number(move_used) * 100) / 100));
  }

  await updateDoc(tokenRef, payload);
}

// Campos de vitalidade/combate sincronizados automaticamente entre todos os mapas para o mesmo token
const CROSS_MAP_SYNCED_TOKEN_FIELDS = [
  'hp',
  'max_hp',
  'mana',
  'max_mana',
  'ac',
  'conditions',
  'name',
  'size',
  'color',
  'avatar',
  'is_ally',
  'name_hidden',
  'light_radius',
  'light_color',
  'move_limit',
];

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
  if (statsData.conditions !== undefined) payload.conditions = Array.isArray(statsData.conditions) ? statsData.conditions.slice(0, 20) : [];
  if (statsData.color !== undefined) payload.color = statsData.color;
  if (statsData.avatar !== undefined) payload.avatar = statsData.avatar || null;
  if (statsData.hidden !== undefined) payload.hidden = Boolean(statsData.hidden);
  if (statsData.is_ally !== undefined) payload.is_ally = Boolean(statsData.is_ally);
  if (statsData.name_hidden !== undefined) payload.name_hidden = Boolean(statsData.name_hidden);
  if (statsData.monster_id !== undefined) payload.monster_id = statsData.monster_id ? String(statsData.monster_id).slice(0, 128) : null;
  if (statsData.initiative !== undefined) payload.initiative = Number(statsData.initiative);
  if (statsData.light_radius !== undefined) {
    payload.light_radius =
      statsData.light_radius === null
        ? null
        : Math.max(0, Math.min(80, Math.round(Number(statsData.light_radius) || 0)));
  }
  if (statsData.light_color !== undefined) {
    payload.light_color = statsData.light_color ? String(statsData.light_color).slice(0, 32) : null;
  }
  if (statsData.move_limit !== undefined) {
    payload.move_limit =
      statsData.move_limit === null
        ? null
        : Math.max(0, Math.min(200, Math.round(Number(statsData.move_limit) * 10) / 10));
  }
  if (statsData.move_used !== undefined) {
    payload.move_used = Math.max(0, Math.min(500, Math.round((Number(statsData.move_used) || 0) * 100) / 100));
  }

  await updateDoc(tokenRef, payload);

  // Propaga vida e atributos compartilhados em tempo real para todas as cópias deste token nos demais mapas
  const sharedPatch = {};
  CROSS_MAP_SYNCED_TOKEN_FIELDS.forEach((field) => {
    if (payload[field] !== undefined) {
      sharedPatch[field] = payload[field];
    }
  });

  if (Object.keys(sharedPatch).length === 0) return;

  try {
    const targetSnap = await getDoc(tokenRef);
    if (!targetSnap.exists()) return;
    const targetData = { id: targetSnap.id, ...targetSnap.data() };
    const syncGroupId = getTokenSyncGroupId(targetData);
    const charId = targetData.type === 'player' ? targetData.character_id : null;

    const siblingRefs = new Map();

    if (syncGroupId) {
      const byGroupSnap = await getDocs(
        query(collection(firestore, 'map_tokens'), where('sync_group_id', '==', syncGroupId))
      );
      byGroupSnap.forEach((d) => {
        if (d.id !== tokenId) siblingRefs.set(d.id, d.ref);
      });
    }

    // Compatibilidade com tokens de heróis antigos (antes de sync_group_id existir)
    if (charId) {
      const byCharSnap = await getDocs(
        query(collection(firestore, 'map_tokens'), where('character_id', '==', charId))
      );
      byCharSnap.forEach((d) => {
        if (d.id !== tokenId) siblingRefs.set(d.id, d.ref);
      });
    }

    if (siblingRefs.size === 0) return;

    const batch = writeBatch(firestore);
    const propagatedUpdate = {
      ...sharedPatch,
      ...(syncGroupId ? { sync_group_id: syncGroupId } : {}),
      updatedAt: serverTimestamp(),
    };

    if (!targetData.sync_group_id && syncGroupId) {
      batch.update(tokenRef, { sync_group_id: syncGroupId });
    }
    siblingRefs.forEach((ref) => {
      batch.update(ref, propagatedUpdate);
    });

    await batch.commit();
  } catch (err) {
    console.warn('Aviso ao propagar vida do token para outros mapas:', err?.message || err);
  }
}

export async function deleteMapToken(tokenId) {
  if (!tokenId) return;
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'map_tokens', tokenId));
}

/**
 * Sincroniza os tokens selecionados pelo Mestre (heróis, aliados, NPCs e monstros ativos)
 * para o mapa alvo, preservando 100% da vida atual/máxima, mana, CA, condições e vinculando
 * suas identidades (`sync_group_id`) para manter a vida sincronizada entre todos os mapas.
 */
export async function syncTokensToMap(targetMapId, selectedItems = [], existingMapTokens = []) {
  if (!targetMapId || !Array.isArray(selectedItems) || selectedItems.length === 0) return 0;
  const firestore = requireDb();
  const batch = writeBatch(firestore);
  let addedCount = 0;
  let updatedLinksCount = 0;

  const existingKeysOnTarget = new Set();
  const existingCharIdsOnTarget = new Set();

  existingMapTokens
    .filter((t) => t.map_id === targetMapId)
    .forEach((t) => {
      const key = getTokenSyncGroupId(t);
      if (key) existingKeysOnTarget.add(key);
      if (t.type === 'player' && t.character_id) {
        existingCharIdsOnTarget.add(t.character_id);
      }
    });

  const existingCountOffset = existingMapTokens.filter((t) => t.map_id === targetMapId).length;
  const playerSpawnFogOps = [];

  selectedItems.forEach((item, idx) => {
    const syncGroupId = String(item.sync_group_id || '').trim().slice(0, 128);
    if (!syncGroupId) return;
    if (existingKeysOnTarget.has(syncGroupId)) return;
    if (item.type === 'player' && item.character_id && existingCharIdsOnTarget.has(item.character_id)) {
      return;
    }

    const tokenRef = doc(collection(firestore, 'map_tokens'));
    const slotIdx = existingCountOffset + addedCount;
    const type = ['player', 'npc', 'monster'].includes(item.type) ? item.type : 'player';
    const size = ['S', 'M', 'L', 'H', 'G'].includes(item.size) ? item.size : 'M';
    const maxHp = Math.max(1, Math.floor(Number(item.max_hp ?? 20)));
    const hp = Math.max(0, Math.floor(Number(item.hp ?? maxHp)));
    const maxMana = Math.max(0, Math.floor(Number(item.max_mana ?? 10)));
    const mana = Math.max(0, Math.floor(Number(item.mana ?? maxMana)));
    const spawnX = 12 + ((slotIdx * 8) % 76);
    const spawnY = Math.max(12, 84 - Math.floor(slotIdx / 10) * 9);

    batch.set(tokenRef, {
      map_id: targetMapId,
      name: String(item.name || 'Guerreiro').trim().slice(0, 100),
      type,
      character_id: item.character_id || null,
      owner_id: item.owner_id || null,
      sync_group_id: syncGroupId,
      color: item.color || (type === 'player' ? '#60a5fa' : type === 'npc' ? '#10b981' : '#ef4444'),
      avatar: item.avatar || null,
      x: spawnX,
      y: spawnY,
      size,
      hp,
      max_hp: maxHp,
      ac: Math.max(0, Math.floor(Number(item.ac ?? 12))),
      mana,
      max_mana: maxMana,
      conditions: Array.isArray(item.conditions) ? item.conditions.slice(0, 20) : [],
      initiative: Math.floor(Number(item.initiative || 0)),
      hidden: Boolean(item.hidden),
      is_ally: item.is_ally !== undefined ? Boolean(item.is_ally) : type === 'player',
      name_hidden: item.name_hidden !== undefined ? Boolean(item.name_hidden) : type === 'monster',
      monster_id: item.monster_id ? String(item.monster_id).slice(0, 128) : null,
      light_radius:
        item.light_radius !== undefined && item.light_radius !== null
          ? Math.max(0, Math.min(80, Math.round(Number(item.light_radius) || 0)))
          : null,
      light_color: item.light_color ? String(item.light_color).slice(0, 32) : null,
      move_limit:
        item.move_limit !== undefined && item.move_limit !== null && Number.isFinite(Number(item.move_limit))
          ? Math.max(0, Math.min(200, Math.round(Number(item.move_limit) * 10) / 10))
          : null,
      move_used: 0,
      updatedAt: serverTimestamp(),
    });

    if (type === 'player') {
      const playerUid = item.owner_id || item.character_id;
      const spawnOp = buildPlayerSpawnFogOp(playerUid, spawnX, spawnY);
      if (spawnOp) playerSpawnFogOps.push(spawnOp);
    }

    // Vincula também os tokens de origem legados (que ainda não tinham sync_group_id) para manter a vida sincronizada entre os mapas
    if (Array.isArray(item.sourceTokenIdsToLink) && item.sourceTokenIdsToLink.length > 0) {
      item.sourceTokenIdsToLink.forEach((srcId) => {
        if (!srcId) return;
        batch.update(doc(firestore, 'map_tokens', srcId), {
          sync_group_id: syncGroupId,
        });
        updatedLinksCount += 1;
      });
    }

    existingKeysOnTarget.add(syncGroupId);
    if (type === 'player' && item.character_id) {
      existingCharIdsOnTarget.add(item.character_id);
    }
    addedCount += 1;
  });

  if (addedCount > 0 || updatedLinksCount > 0) {
    await batch.commit();
  }
  // Assim que jogadores são inseridos no mapa com névoa ativa, descobrem um pequeno círculo ao redor de si
  if (playerSpawnFogOps.length > 0) {
    await Promise.all(
      playerSpawnFogOps.map((op) =>
        op?.viewerUid
          ? appendPlayerFogOpsTx(targetMapId, op.viewerUid, [op], { requireEnabled: true }).catch(
              () => {}
            )
          : Promise.resolve()
      )
    );
  }
  return addedCount;
}

export async function syncHeroTokensToMap(mapId, playerProfiles, existingTokens = []) {
  if (!mapId || !Array.isArray(playerProfiles)) return 0;

  const items = playerProfiles.map((p) => {
    const heroLevel = Number(p.level || 1);
    const calculatedHp = 18 + heroLevel * 6;
    const calculatedMana = 10 + heroLevel * 4;
    const existingHeroToken = existingTokens.find(
      (t) => t.type === 'player' && t.character_id === p.uid
    );

    return {
      sync_group_id: `hero:${p.uid}`,
      name: p.username || existingHeroToken?.name || 'Herói',
      type: 'player',
      character_id: p.uid,
      owner_id: p.uid,
      color: existingHeroToken?.color || '#60a5fa',
      avatar: p.photoURL || existingHeroToken?.avatar || null,
      size: existingHeroToken?.size || 'M',
      hp: existingHeroToken ? existingHeroToken.hp : calculatedHp,
      max_hp: existingHeroToken ? existingHeroToken.max_hp : calculatedHp,
      ac: existingHeroToken ? existingHeroToken.ac : 14,
      mana: existingHeroToken ? existingHeroToken.mana : calculatedMana,
      max_mana: existingHeroToken ? existingHeroToken.max_mana : calculatedMana,
      conditions: Array.isArray(existingHeroToken?.conditions) ? existingHeroToken.conditions : [],
      initiative: existingHeroToken?.initiative || 0,
      hidden: false,
      is_ally: true,
      name_hidden: false,
      monster_id: null,
      sourceTokenIdsToLink: existingHeroToken && !existingHeroToken.sync_group_id ? [existingHeroToken.id] : [],
    };
  });

  return syncTokensToMap(mapId, items, existingTokens);
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

  // Limite estrito das últimas 15 rolagens de dados: consulta limitada (60 docs) e deleção tolerante a permissões
  try {
    const snap = await getDocs(
      query(collection(firestore, 'map_pings'), orderBy('createdAt', 'desc'), limit(60))
    );
    const getDocTime = (d) => {
      const data = d.data();
      if (data?.createdAt?.toMillis) return data.createdAt.toMillis();
      if (data?.createdAt?.seconds) return data.createdAt.seconds * 1000;
      if (typeof data?.createdAtMs === 'number') return data.createdAtMs;
      return nowMs;
    };

    const isMasterActor = user_role === 'master';
    const canDeleteDoc = (d) => isMasterActor || d.data()?.user_id === String(user_id || '');

    const rollDocs = snap.docs.filter(
      (d) => d.data()?.event_type === 'dice_roll' || d.data()?.roll !== undefined
    );
    if (rollDocs.length > 15) {
      const sortedRolls = [...rollDocs].sort((a, b) => getDocTime(b) - getDocTime(a));
      const excessRolls = sortedRolls.slice(15).filter(canDeleteDoc);
      await Promise.all(
        excessRolls.map((oldDoc) =>
          deleteDoc(doc(firestore, 'map_pings', oldDoc.id)).catch(() => {})
        )
      );
    }

    // Limpa também pings de radar expirados (> 30s) para manter a coleção enxuta
    const expiredPings = snap.docs.filter((d) => {
      if (!canDeleteDoc(d)) return false;
      const data = d.data();
      if (data?.event_type === 'dice_roll' || data?.roll !== undefined) return false;
      const t = getDocTime(d);
      return t > 0 && nowMs - t > 30000;
    });
    if (expiredPings.length > 0) {
      await Promise.all(
        expiredPings.map((oldPing) =>
          deleteDoc(doc(firestore, 'map_pings', oldPing.id)).catch(() => {})
        )
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

/**
 * Limpa todo o histórico/chat de rolagens de dados da mesa (exclusivo do Mestre).
 * Remove apenas documentos de rolagem de dados em `map_pings` e `map_rolls`,
 * preservando pings de radar ativos e o documento de fallback de áudio `table_audio_state`.
 */
export async function clearMapDiceRollsHistory() {
  const firestore = requireDb();
  let deletedCount = 0;

  try {
    const pingsSnap = await getDocs(collection(firestore, 'map_pings'));
    const pingRolls = pingsSnap.docs.filter((d) => {
      const data = d.data();
      return data?.event_type === 'dice_roll' || data?.roll !== undefined;
    });
    if (pingRolls.length > 0) {
      await Promise.all(
        pingRolls.map((d) => deleteDoc(doc(firestore, 'map_pings', d.id)))
      );
      deletedCount += pingRolls.length;
    }
  } catch (err) {
    console.error('Erro ao limpar histórico de dados (map_pings):', err);
    throw err;
  }

  try {
    const rollsSnap = await getDocs(collection(firestore, 'map_rolls'));
    const legacyRolls = rollsSnap.docs.filter((d) => {
      if (d.id.startsWith('table_')) return false;
      const data = d.data();
      return (
        data?.event_type === 'dice_roll' ||
        data?.roll !== undefined ||
        data?.sides !== undefined
      );
    });
    if (legacyRolls.length > 0) {
      await Promise.all(
        legacyRolls.map((d) => deleteDoc(doc(firestore, 'map_rolls', d.id)))
      );
      deletedCount += legacyRolls.length;
    }
  } catch (err) {
    console.warn('Aviso ao limpar histórico legado de map_rolls:', err);
  }

  return deletedCount;
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
        lastSfx: raw.lastSfx && typeof raw.lastSfx === 'object' ? raw.lastSfx : null,
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
  if (statePatch.lastSfx !== undefined) {
    payload.lastSfx = statePatch.lastSfx
      ? {
          id: String(statePatch.lastSfx.id || `${Date.now()}`).slice(0, 64),
          sfxId: String(statePatch.lastSfx.sfxId || '').slice(0, 40),
          triggeredAtMs: Math.round(Number(statePatch.lastSfx.triggeredAtMs) || Date.now()),
          triggeredByName: String(statePatch.lastSfx.triggeredByName || 'Mestre').slice(0, 60),
        }
      : null;
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

// =========================================================================
// HANDOUTS SINCRONIZADOS (IMAGENS, CARTAS, ENIGMAS EM TELA CHEIA)
// =========================================================================

function getDocTimeMs(d) {
  if (!d) return 0;
  const ts = d.shownAt || d.updatedAt || d.createdAt;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof d.createdAtMs === 'number') return d.createdAtMs;
  if (typeof d.shownAtMs === 'number') return d.shownAtMs;
  return 0;
}

export function subscribeTableHandouts(isMaster, userUid, onData, onError) {
  const firestore = requireDb();
  const primaryCol = collection(firestore, 'table_handouts');
  const fallbackDocRef = doc(firestore, 'map_rolls', 'table_handouts_fallback');

  let active = true;
  let primaryDenied = false;
  let unsubFallback = null;

  const filterForViewer = (list) => {
    const sorted = [...list].sort((a, b) => getDocTimeMs(b) - getDocTimeMs(a));
    if (isMaster) return sorted;
    return sorted.filter((h) => {
      if (!h.is_active) return false;
      const vis = Array.isArray(h.visible_to) && h.visible_to.length > 0 ? h.visible_to : ['all'];
      return vis.includes('all') || (userUid && vis.includes(userUid));
    });
  };

  const ensureFallback = () => {
    if (!active || unsubFallback) return;
    unsubFallback = onSnapshot(
      fallbackDocRef,
      (snap) => {
        if (!active) return;
        const list = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items : [];
        onData({ items: filterForViewer(list), storageMode: 'fallback' });
      },
      (err) => {
        if (active && onError) onError(err);
      }
    );
  };

  const q = isMaster ? primaryCol : query(primaryCol, where('is_active', '==', true));
  const unsubPrimary = onSnapshot(
    q,
    (snap) => {
      if (!active || primaryDenied) return;
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData({ items: filterForViewer(list), storageMode: 'collection' });
    },
    (err) => {
      if (!active) return;
      if (isPermissionDeniedError(err)) {
        primaryDenied = true;
        ensureFallback();
      } else if (onError) {
        onError(err);
      }
    }
  );

  return () => {
    active = false;
    if (typeof unsubPrimary === 'function') unsubPrimary();
    if (typeof unsubFallback === 'function') unsubFallback();
  };
}

export async function createTableHandout(
  { title, subtitle = '', content = '', imageUrl = '', style = 'combined', visible_to = ['all'], is_active = true, created_by = null },
  preferredStorage = 'collection'
) {
  const firestore = requireDb();
  const cleanTitle = String(title || 'Pergaminho Misterioso').trim().slice(0, 150) || 'Pergaminho Misterioso';
  const cleanSubtitle = String(subtitle || '').trim().slice(0, 120);
  const cleanContent = String(content || '').trim().slice(0, 8000);
  const cleanImage = String(imageUrl || '').trim().slice(0, 840000);
  const cleanStyle = ['parchment', 'image', 'combined'].includes(style) ? style : 'combined';
  const cleanVis = Array.isArray(visible_to) && visible_to.length > 0 ? visible_to.slice(0, 60) : ['all'];
  const nowMs = Date.now();

  const saveFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_handouts_fallback');
    const id = `hnd-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items : [];
      const next = prev.map((h) => (is_active ? { ...h, is_active: false } : h));
      next.unshift({
        id,
        title: cleanTitle,
        subtitle: cleanSubtitle,
        content: cleanContent,
        imageUrl: cleanImage,
        style: cleanStyle,
        visible_to: cleanVis,
        is_active: Boolean(is_active),
        created_by: created_by || null,
        shownAtMs: is_active ? nowMs : 0,
        createdAtMs: nowMs,
      });
      tx.set(ref, { items: next.slice(0, 20), updatedAt: serverTimestamp() }, { merge: true });
    });
    return { id, storageMode: 'fallback' };
  };

  if (preferredStorage === 'fallback') return saveFallback();

  try {
    // Se abrir imediatamente, desativa outros handouts ativos para foco limpo na tela
    if (is_active) {
      const activeSnap = await getDocs(query(collection(firestore, 'table_handouts'), where('is_active', '==', true)));
      if (!activeSnap.empty) {
        const batch = writeBatch(firestore);
        activeSnap.forEach((d) => batch.update(d.ref, { is_active: false, updatedAt: serverTimestamp() }));
        await batch.commit();
      }
    }

    const docRef = await addDoc(collection(firestore, 'table_handouts'), {
      title: cleanTitle,
      subtitle: cleanSubtitle,
      content: cleanContent,
      imageUrl: cleanImage,
      style: cleanStyle,
      visible_to: cleanVis,
      is_active: Boolean(is_active),
      created_by: created_by || null,
      shownAt: is_active ? serverTimestamp() : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, storageMode: 'collection' };
  } catch (err) {
    if (isPermissionDeniedError(err)) return saveFallback();
    throw err;
  }
}

export async function setTableHandoutActive(handoutId, nextActive, visible_to = null, preferredStorage = 'collection') {
  if (!handoutId) return;
  const firestore = requireDb();

  const updateFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_handouts_fallback');
    const nowMs = Date.now();
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items : [];
      const next = prev.map((h) => {
        if (h.id === handoutId) {
          return {
            ...h,
            is_active: Boolean(nextActive),
            ...(Array.isArray(visible_to) && visible_to.length > 0 ? { visible_to } : {}),
            ...(nextActive ? { shownAtMs: nowMs } : {}),
          };
        }
        return nextActive ? { ...h, is_active: false } : h;
      });
      tx.set(ref, { items: next, updatedAt: serverTimestamp() }, { merge: true });
    });
  };

  if (preferredStorage === 'fallback') return updateFallback();

  try {
    const batch = writeBatch(firestore);
    if (nextActive) {
      const activeSnap = await getDocs(query(collection(firestore, 'table_handouts'), where('is_active', '==', true)));
      activeSnap.forEach((d) => {
        if (d.id !== handoutId) {
          batch.update(d.ref, { is_active: false, updatedAt: serverTimestamp() });
        }
      });
    }
    const patch = {
      is_active: Boolean(nextActive),
      updatedAt: serverTimestamp(),
    };
    if (nextActive) patch.shownAt = serverTimestamp();
    if (Array.isArray(visible_to) && visible_to.length > 0) patch.visible_to = visible_to.slice(0, 60);

    batch.update(doc(firestore, 'table_handouts', handoutId), patch);
    await batch.commit();
  } catch (err) {
    if (isPermissionDeniedError(err)) return updateFallback();
    throw err;
  }
}

export async function deleteTableHandout(handoutId, preferredStorage = 'collection') {
  if (!handoutId) return;
  const firestore = requireDb();

  const deleteFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_handouts_fallback');
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items : [];
      tx.set(ref, { items: prev.filter((h) => h.id !== handoutId), updatedAt: serverTimestamp() }, { merge: true });
    });
  };

  if (preferredStorage === 'fallback') return deleteFallback();

  try {
    await deleteDoc(doc(firestore, 'table_handouts', handoutId));
  } catch (err) {
    if (isPermissionDeniedError(err)) return deleteFallback();
    throw err;
  }
}

// =========================================================================
// SUSSURROS PRIVADOS (WHISPERS EXCLUSIVOS DO MESTRE PARA 1 JOGADOR)
// =========================================================================

export function subscribeTableWhispers(isMaster, userUid, onData, onError) {
  const firestore = requireDb();
  const primaryCol = collection(firestore, 'table_whispers');
  const fallbackDocRef = doc(firestore, 'map_rolls', 'table_whispers_fallback');

  let active = true;
  let primaryDenied = false;
  let unsubFallback = null;

  const filterAndSort = (list) => {
    const filtered = isMaster
      ? list
      : list.filter((w) => userUid && w.target_uid === userUid);
    return [...filtered].sort((a, b) => getDocTimeMs(b) - getDocTimeMs(a)).slice(0, 40);
  };

  const ensureFallback = () => {
    if (!active || unsubFallback) return;
    unsubFallback = onSnapshot(
      fallbackDocRef,
      (snap) => {
        if (!active) return;
        const list = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items : [];
        onData({ items: filterAndSort(list), storageMode: 'fallback' });
      },
      (err) => {
        if (active && onError) onError(err);
      }
    );
  };

  if (!isMaster && !userUid) {
    onData({ items: [], storageMode: 'collection' });
    return () => {};
  }

  const q = isMaster ? primaryCol : query(primaryCol, where('target_uid', '==', userUid));
  const unsubPrimary = onSnapshot(
    q,
    (snap) => {
      if (!active || primaryDenied) return;
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData({ items: filterAndSort(list), storageMode: 'collection' });
    },
    (err) => {
      if (!active) return;
      if (isPermissionDeniedError(err)) {
        primaryDenied = true;
        ensureFallback();
      } else if (onError) {
        onError(err);
      }
    }
  );

  return () => {
    active = false;
    if (typeof unsubPrimary === 'function') unsubPrimary();
    if (typeof unsubFallback === 'function') unsubFallback();
  };
}

export async function sendTableWhisper(
  { target_uid, target_name, sender_uid, sender_name = 'Mestre', message, category = 'secret' },
  preferredStorage = 'collection'
) {
  if (!target_uid) throw new Error('Selecione o jogador destinatário.');
  const cleanMsg = String(message || '').trim().slice(0, 2000);
  if (!cleanMsg) throw new Error('Escreva a mensagem do sussurro.');

  const firestore = requireDb();
  const cleanCat = ['secret', 'perception', 'lore', 'warning'].includes(category) ? category : 'secret';
  const nowMs = Date.now();

  const saveFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_whispers_fallback');
    const id = `wsp-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items : [];
      const next = [
        {
          id,
          target_uid: String(target_uid).slice(0, 128),
          target_name: String(target_name || 'Aventureiro').slice(0, 60),
          sender_uid: sender_uid ? String(sender_uid).slice(0, 128) : null,
          sender_name: String(sender_name || 'Mestre').slice(0, 60),
          message: cleanMsg,
          category: cleanCat,
          read: false,
          createdAtMs: nowMs,
        },
        ...prev,
      ].slice(0, 40);
      tx.set(ref, { items: next, updatedAt: serverTimestamp() }, { merge: true });
    });
    return { id, storageMode: 'fallback' };
  };

  if (preferredStorage === 'fallback') return saveFallback();

  try {
    const docRef = await addDoc(collection(firestore, 'table_whispers'), {
      target_uid: String(target_uid).slice(0, 128),
      target_name: String(target_name || 'Aventureiro').slice(0, 60),
      sender_uid: sender_uid ? String(sender_uid).slice(0, 128) : null,
      sender_name: String(sender_name || 'Mestre').slice(0, 60),
      message: cleanMsg,
      category: cleanCat,
      read: false,
      createdAt: serverTimestamp(),
      readAt: null,
    });
    return { id: docRef.id, storageMode: 'collection' };
  } catch (err) {
    if (isPermissionDeniedError(err)) return saveFallback();
    throw err;
  }
}

export async function markTableWhisperRead(whisperId, preferredStorage = 'collection') {
  if (!whisperId) return;
  const firestore = requireDb();

  const markFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_whispers_fallback');
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items : [];
      const next = prev.map((w) => (w.id === whisperId ? { ...w, read: true } : w));
      tx.set(ref, { items: next, updatedAt: serverTimestamp() }, { merge: true });
    });
  };

  if (preferredStorage === 'fallback') return markFallback();

  try {
    await updateDoc(doc(firestore, 'table_whispers', whisperId), {
      read: true,
      readAt: serverTimestamp(),
    });
  } catch (err) {
    if (isPermissionDeniedError(err)) return markFallback();
  }
}

export async function deleteTableWhisper(whisperId, preferredStorage = 'collection') {
  if (!whisperId) return;
  const firestore = requireDb();

  const delFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_whispers_fallback');
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.items) ? snap.data().items : [];
      tx.set(ref, { items: prev.filter((w) => w.id !== whisperId), updatedAt: serverTimestamp() }, { merge: true });
    });
  };

  if (preferredStorage === 'fallback') return delFallback();

  try {
    await deleteDoc(doc(firestore, 'table_whispers', whisperId));
  } catch (err) {
    if (isPermissionDeniedError(err)) return delFallback();
    throw err;
  }
}

// =========================================================================
// BAÚ DE LOOT / SAQUE PÓS-COMBATE (VISIBILIDADE SELETIVA + TRANSAÇÃO ATÔMICA)
// =========================================================================

function sanitizeLootItem(raw, idx = 0) {
  const validTypes = new Set([
    'weapon', 'shield', 'head', 'face', 'neck', 'body', 'hands', 'waist', 'feet', 'ring', 'consumable', 'misc',
  ]);
  const rarity = ['COMUM', 'INCOMUM', 'RARO', 'ÉPICO', 'LENDÁRIO', 'MÍTICO'].includes(
    String(raw?.rarity || '').toUpperCase()
  )
    ? String(raw.rarity).toUpperCase()
    : getRarityFromItem(raw);
  const type = validTypes.has(raw?.type) ? raw.type : 'misc';
  const rawDesc = String(raw?.description || '').trim().slice(0, 800);
  const description = /^<(COMUM|INCOMUM|RARO|ÉPICO|LENDÁRIO|MÍTICO)>/i.test(rawDesc)
    ? rawDesc
    : `<${rarity}> ${rawDesc || 'Item encontrado no baú de saque.'}`;

  return {
    id: String(raw?.id || `loot-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`).slice(0, 80),
    name: String(raw?.name || 'Objeto Misterioso').trim().slice(0, 100) || 'Objeto Misterioso',
    description,
    rarity,
    type,
    qty: Math.max(1, Math.min(99, Math.floor(Number(raw?.qty) || 1))),
    status: ['available', 'claimed', 'discarded'].includes(raw?.status) ? raw.status : 'available',
    claimedBy: raw?.claimedBy || null,
    claimedByName: raw?.claimedByName || null,
    discardedByName: raw?.discardedByName || null,
  };
}

export function subscribeLootChests(isMaster, userUid, onData, onError) {
  const firestore = requireDb();
  const primaryCol = collection(firestore, 'loot_chests');
  const fallbackDocRef = doc(firestore, 'map_rolls', 'table_loot_fallback');

  let active = true;
  let primaryDenied = false;
  let unsubFallback = null;

  const filterAndSort = (list) => {
    const filtered = isMaster
      ? list
      : list.filter((c) => {
          if (c.status !== 'open') return false;
          const vis = Array.isArray(c.visible_to) ? c.visible_to : [];
          return vis.includes('all') || (userUid && vis.includes(userUid));
        });
    return [...filtered].sort((a, b) => getDocTimeMs(b) - getDocTimeMs(a));
  };

  const ensureFallback = () => {
    if (!active || unsubFallback) return;
    unsubFallback = onSnapshot(
      fallbackDocRef,
      (snap) => {
        if (!active) return;
        const list = snap.exists() && Array.isArray(snap.data()?.chests) ? snap.data().chests : [];
        onData({ items: filterAndSort(list), storageMode: 'fallback' });
      },
      (err) => {
        if (active && onError) onError(err);
      }
    );
  };

  if (!isMaster && !userUid) {
    onData({ items: [], storageMode: 'collection' });
    return () => {};
  }

  const q = isMaster
    ? primaryCol
    : query(primaryCol, where('visible_to', 'array-contains-any', ['all', userUid]));

  const unsubPrimary = onSnapshot(
    q,
    (snap) => {
      if (!active || primaryDenied) return;
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData({ items: filterAndSort(list), storageMode: 'collection' });
    },
    (err) => {
      if (!active) return;
      if (isPermissionDeniedError(err)) {
        primaryDenied = true;
        ensureFallback();
      } else if (onError) {
        onError(err);
      }
    }
  );

  return () => {
    active = false;
    if (typeof unsubPrimary === 'function') unsubPrimary();
    if (typeof unsubFallback === 'function') unsubFallback();
  };
}

export async function createLootChest(
  { title, theme = '', gold = 0, visible_to = ['all'], items = [], status = 'open', created_by = null },
  preferredStorage = 'collection'
) {
  const firestore = requireDb();
  const cleanTitle = String(title || 'Baú de Saque').trim().slice(0, 120) || 'Baú de Saque';
  const cleanTheme = String(theme || '').trim().slice(0, 120);
  const cleanGold = Math.max(0, Math.min(2000000000, Math.floor(Number(gold) || 0)));
  const cleanVis = Array.isArray(visible_to) && visible_to.length > 0 ? visible_to.slice(0, 60) : ['all'];
  const cleanItems = (Array.isArray(items) ? items : []).slice(0, 40).map((it, i) => sanitizeLootItem(it, i));
  const cleanStatus = status === 'closed' ? 'closed' : 'open';
  const nowMs = Date.now();

  const saveFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_loot_fallback');
    const id = `chest-${nowMs}-${Math.random().toString(36).slice(2, 6)}`;
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.chests) ? snap.data().chests : [];
      const next = [
        {
          id,
          title: cleanTitle,
          theme: cleanTheme,
          status: cleanStatus,
          gold: cleanGold,
          visible_to: cleanVis,
          items: cleanItems,
          logs: [],
          created_by: created_by || null,
          createdAtMs: nowMs,
        },
        ...prev,
      ].slice(0, 20);
      tx.set(ref, { chests: next, updatedAt: serverTimestamp() }, { merge: true });
    });
    return { id, storageMode: 'fallback' };
  };

  if (preferredStorage === 'fallback') return saveFallback();

  try {
    const docRef = await addDoc(collection(firestore, 'loot_chests'), {
      title: cleanTitle,
      theme: cleanTheme,
      status: cleanStatus,
      gold: cleanGold,
      visible_to: cleanVis,
      items: cleanItems,
      logs: [],
      created_by: created_by || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, storageMode: 'collection' };
  } catch (err) {
    if (isPermissionDeniedError(err)) return saveFallback();
    throw err;
  }
}

export async function updateLootChest(chestId, patch, preferredStorage = 'collection') {
  if (!chestId) return;
  const firestore = requireDb();

  const sanitized = {};
  if (patch.title !== undefined) sanitized.title = String(patch.title || 'Baú de Saque').trim().slice(0, 120);
  if (patch.status !== undefined) sanitized.status = patch.status === 'closed' ? 'closed' : 'open';
  if (patch.gold !== undefined) sanitized.gold = Math.max(0, Math.min(2000000000, Math.floor(Number(patch.gold) || 0)));
  if (Array.isArray(patch.visible_to) && patch.visible_to.length > 0) sanitized.visible_to = patch.visible_to.slice(0, 60);
  if (Array.isArray(patch.items)) sanitized.items = patch.items.slice(0, 40).map((it, i) => sanitizeLootItem(it, i));

  const updateFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_loot_fallback');
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.chests) ? snap.data().chests : [];
      const next = prev.map((c) => (c.id === chestId ? { ...c, ...sanitized } : c));
      tx.set(ref, { chests: next, updatedAt: serverTimestamp() }, { merge: true });
    });
  };

  if (preferredStorage === 'fallback') return updateFallback();

  try {
    await updateDoc(doc(firestore, 'loot_chests', chestId), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isPermissionDeniedError(err)) return updateFallback();
    throw err;
  }
}

export async function deleteLootChest(chestId, preferredStorage = 'collection') {
  if (!chestId) return;
  const firestore = requireDb();

  const delFallback = async () => {
    const ref = doc(firestore, 'map_rolls', 'table_loot_fallback');
    await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() && Array.isArray(snap.data()?.chests) ? snap.data().chests : [];
      tx.set(ref, { chests: prev.filter((c) => c.id !== chestId), updatedAt: serverTimestamp() }, { merge: true });
    });
  };

  if (preferredStorage === 'fallback') return delFallback();

  try {
    await deleteDoc(doc(firestore, 'loot_chests', chestId));
  } catch (err) {
    if (isPermissionDeniedError(err)) return delFallback();
    throw err;
  }
}

/**
 * Transação atômica: transfere 1 ou mais itens selecionados do Baú de Loot para a mochila do jogador.
 * Impede duplicação por cliques simultâneos e respeita os slots disponíveis da mochila.
 */
export async function claimLootChestItemsTx(
  chestId,
  uid,
  username,
  itemIds = [],
  preferredStorage = 'collection'
) {
  if (!chestId || !uid || !Array.isArray(itemIds) || itemIds.length === 0) return { claimedCount: 0 };
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', uid);
  const wantedSet = new Set(itemIds);
  const actorName = String(username || 'Aventureiro').slice(0, 60);

  const applyClaim = (chestData, prof) => {
    if (chestData.status !== 'open') throw new Error('Este baú já foi fechado pelo Mestre.');
    const vis = Array.isArray(chestData.visible_to) ? chestData.visible_to : [];
    if (!vis.includes('all') && !vis.includes(uid)) {
      throw new Error('Você não tem acesso a este baú.');
    }

    const inv = [...prof.inventory];
    const maxSlots = prof.slots || 10;
    const chestItems = Array.isArray(chestData.items) ? [...chestData.items] : [];
    const logs = Array.isArray(chestData.logs) ? [...chestData.logs] : [];
    const claimedNames = [];

    const nextChestItems = chestItems.map((it) => {
      if (!wantedSet.has(it.id) || it.status !== 'available') return it;

      const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
      const existingIdx = inv.findIndex(
        (bagItem) =>
          bagItem.name.toLowerCase() === String(it.name || '').toLowerCase() &&
          (bagItem.description || '') === (it.description || '')
      );

      if (existingIdx >= 0) {
        inv[existingIdx] = { ...inv[existingIdx], qty: (Number(inv[existingIdx].qty) || 1) + qty };
      } else {
        if (inv.length >= maxSlots) {
          throw new Error(`Mochila cheia (${inv.length}/${maxSlots} slots)! Libere espaço ou jogue itens fora.`);
        }
        inv.push({
          name: it.name,
          qty,
          description: it.description || '',
          type: it.type || getItemType(it),
        });
      }

      claimedNames.push(qty > 1 ? `${qty}x ${it.name}` : it.name);
      return {
        ...it,
        status: 'claimed',
        claimedBy: uid,
        claimedByName: actorName,
      };
    });

    if (claimedNames.length === 0) {
      throw new Error('Os itens selecionados já foram coletados ou descartados.');
    }

    logs.unshift({
      text: `${actorName} guardou ${claimedNames.join(', ')} na mochila`,
      action: 'claim',
      atMs: Date.now(),
    });

    return {
      nextInventory: inv,
      nextChestItems,
      nextLogs: logs.slice(0, 60),
      claimedCount: claimedNames.length,
    };
  };

  if (preferredStorage === 'fallback') {
    const fallbackRef = doc(firestore, 'map_rolls', 'table_loot_fallback');
    let claimedCount = 0;
    await runTransaction(firestore, async (tx) => {
      const [profSnap, fbSnap] = await Promise.all([tx.get(profileRef), tx.get(fallbackRef)]);
      if (!profSnap.exists()) throw new Error('Perfil não encontrado.');
      const prof = normalizeProfile(profSnap.data(), profSnap.id);
      const chests = fbSnap.exists() && Array.isArray(fbSnap.data()?.chests) ? fbSnap.data().chests : [];
      const targetChest = chests.find((c) => c.id === chestId);
      if (!targetChest) throw new Error('Baú não encontrado.');

      const res = applyClaim(targetChest, prof);
      claimedCount = res.claimedCount;

      const nextChests = chests.map((c) =>
        c.id === chestId ? { ...c, items: res.nextChestItems, logs: res.nextLogs } : c
      );
      tx.update(profileRef, { inventory: res.nextInventory, updatedAt: serverTimestamp() });
      tx.set(fallbackRef, { chests: nextChests, updatedAt: serverTimestamp() }, { merge: true });
    });
    return { claimedCount };
  }

  const chestRef = doc(firestore, 'loot_chests', chestId);
  let claimedCount = 0;
  await runTransaction(firestore, async (tx) => {
    const [profSnap, chestSnap] = await Promise.all([tx.get(profileRef), tx.get(chestRef)]);
    if (!profSnap.exists()) throw new Error('Perfil não encontrado.');
    if (!chestSnap.exists()) throw new Error('Baú não encontrado.');

    const prof = normalizeProfile(profSnap.data(), profSnap.id);
    const res = applyClaim(chestSnap.data(), prof);
    claimedCount = res.claimedCount;

    tx.update(profileRef, { inventory: res.nextInventory, updatedAt: serverTimestamp() });
    tx.update(chestRef, {
      items: res.nextChestItems,
      logs: res.nextLogs,
      updatedAt: serverTimestamp(),
    });
  });
  return { claimedCount };
}

/**
 * Transação atômica: joga fora / descarta 1 ou mais itens indesejados do Baú de Loot (ex: graveto, pedra, teia).
 */
export async function discardLootChestItemsTx(
  chestId,
  uid,
  username,
  itemIds = [],
  preferredStorage = 'collection'
) {
  if (!chestId || !Array.isArray(itemIds) || itemIds.length === 0) return { discardedCount: 0 };
  const firestore = requireDb();
  const wantedSet = new Set(itemIds);
  const actorName = String(username || 'Aventureiro').slice(0, 60);

  const applyDiscard = (chestData) => {
    if (chestData.status !== 'open') throw new Error('Este baú já foi fechado.');
    const chestItems = Array.isArray(chestData.items) ? [...chestData.items] : [];
    const logs = Array.isArray(chestData.logs) ? [...chestData.logs] : [];
    const discardedNames = [];

    const nextChestItems = chestItems.map((it) => {
      if (!wantedSet.has(it.id) || it.status !== 'available') return it;
      discardedNames.push(it.name);
      return {
        ...it,
        status: 'discarded',
        discardedByName: actorName,
      };
    });

    if (discardedNames.length === 0) {
      throw new Error('Nenhum item disponível selecionado para jogar fora.');
    }

    logs.unshift({
      text: `${actorName} jogou fora ${discardedNames.join(', ')}`,
      action: 'discard',
      atMs: Date.now(),
    });

    return {
      nextChestItems,
      nextLogs: logs.slice(0, 60),
      discardedCount: discardedNames.length,
    };
  };

  if (preferredStorage === 'fallback') {
    const fallbackRef = doc(firestore, 'map_rolls', 'table_loot_fallback');
    let discardedCount = 0;
    await runTransaction(firestore, async (tx) => {
      const fbSnap = await tx.get(fallbackRef);
      const chests = fbSnap.exists() && Array.isArray(fbSnap.data()?.chests) ? fbSnap.data().chests : [];
      const targetChest = chests.find((c) => c.id === chestId);
      if (!targetChest) throw new Error('Baú não encontrado.');
      const res = applyDiscard(targetChest);
      discardedCount = res.discardedCount;
      const nextChests = chests.map((c) =>
        c.id === chestId ? { ...c, items: res.nextChestItems, logs: res.nextLogs } : c
      );
      tx.set(fallbackRef, { chests: nextChests, updatedAt: serverTimestamp() }, { merge: true });
    });
    return { discardedCount };
  }

  const chestRef = doc(firestore, 'loot_chests', chestId);
  let discardedCount = 0;
  await runTransaction(firestore, async (tx) => {
    const chestSnap = await tx.get(chestRef);
    if (!chestSnap.exists()) throw new Error('Baú não encontrado.');
    const res = applyDiscard(chestSnap.data());
    discardedCount = res.discardedCount;
    tx.update(chestRef, {
      items: res.nextChestItems,
      logs: res.nextLogs,
      updatedAt: serverTimestamp(),
    });
  });
  return { discardedCount };
}

/**
 * Transação atômica: coleta o ouro do Baú de Loot (pegar tudo ou parte específica para o jogador).
 */
export async function claimLootChestGoldTx(
  chestId,
  uid,
  username,
  requestedAmount = null,
  preferredStorage = 'collection'
) {
  if (!chestId || !uid) return { collected: 0 };
  const firestore = requireDb();
  const profileRef = doc(firestore, 'profiles', uid);
  const actorName = String(username || 'Aventureiro').slice(0, 60);

  const computeGoldTake = (chestData) => {
    if (chestData.status !== 'open') throw new Error('Este baú já foi fechado.');
    const available = Math.max(0, Math.floor(Number(chestData.gold) || 0));
    if (available <= 0) throw new Error('Não há mais ouro disponível neste baú.');
    const take =
      requestedAmount !== null && Number.isFinite(Number(requestedAmount)) && Number(requestedAmount) > 0
        ? Math.min(available, Math.floor(Number(requestedAmount)))
        : available;
    const logs = Array.isArray(chestData.logs) ? [...chestData.logs] : [];
    logs.unshift({
      text: `${actorName} coletou ${take}G de ouro`,
      action: 'gold',
      atMs: Date.now(),
    });
    return { take, remaining: available - take, nextLogs: logs.slice(0, 60) };
  };

  if (preferredStorage === 'fallback') {
    const fallbackRef = doc(firestore, 'map_rolls', 'table_loot_fallback');
    let collected = 0;
    await runTransaction(firestore, async (tx) => {
      const [profSnap, fbSnap] = await Promise.all([tx.get(profileRef), tx.get(fallbackRef)]);
      if (!profSnap.exists()) throw new Error('Perfil não encontrado.');
      const prof = normalizeProfile(profSnap.data(), profSnap.id);
      const chests = fbSnap.exists() && Array.isArray(fbSnap.data()?.chests) ? fbSnap.data().chests : [];
      const targetChest = chests.find((c) => c.id === chestId);
      if (!targetChest) throw new Error('Baú não encontrado.');
      const res = computeGoldTake(targetChest);
      collected = res.take;
      const nextChests = chests.map((c) =>
        c.id === chestId ? { ...c, gold: res.remaining, logs: res.nextLogs } : c
      );
      tx.update(profileRef, { gold: prof.gold + res.take, updatedAt: serverTimestamp() });
      tx.set(fallbackRef, { chests: nextChests, updatedAt: serverTimestamp() }, { merge: true });
    });
    return { collected };
  }

  const chestRef = doc(firestore, 'loot_chests', chestId);
  let collected = 0;
  await runTransaction(firestore, async (tx) => {
    const [profSnap, chestSnap] = await Promise.all([tx.get(profileRef), tx.get(chestRef)]);
    if (!profSnap.exists()) throw new Error('Perfil não encontrado.');
    if (!chestSnap.exists()) throw new Error('Baú não encontrado.');
    const prof = normalizeProfile(profSnap.data(), profSnap.id);
    const res = computeGoldTake(chestSnap.data());
    collected = res.take;

    tx.update(profileRef, { gold: prof.gold + res.take, updatedAt: serverTimestamp() });
    tx.update(chestRef, {
      gold: res.remaining,
      logs: res.nextLogs,
      updatedAt: serverTimestamp(),
    });
  });
  return { collected };
}

/* ============================================================================
 * DESENHO LIVRE & MARCAÇÕES TÁTICAS NO MAPA (map_drawings — tempo real)
 * Jogadores criam e apagam seus próprios traços; Mestre pode apagar traços de
 * qualquer jogador ou apagar tudo (Mestre + Jogadores) em um clique.
 * ========================================================================== */

function sanitizeDrawingPoints(points) {
  if (!Array.isArray(points)) return [];
  return points
    .slice(0, 240)
    .map((pt) => {
      const x = Number(pt?.x ?? (Array.isArray(pt) ? pt[0] : NaN));
      const y = Number(pt?.y ?? (Array.isArray(pt) ? pt[1] : NaN));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        x: Math.max(0, Math.min(100, Math.round(x * 100) / 100)),
        y: Math.max(0, Math.min(100, Math.round(y * 100) / 100)),
      };
    })
    .filter(Boolean);
}

export function subscribeMapDrawings(mapId, onData, onError) {
  if (!mapId) {
    onData?.([]);
    return () => {};
  }
  const firestore = requireDb();
  const q = query(
    collection(firestore, 'map_drawings'),
    where('map_id', '==', String(mapId)),
    limit(250)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : Number(a.createdAtMs) || 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : Number(b.createdAtMs) || 0;
        return ta - tb;
      });
      onData?.(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        onData?.([]);
        return;
      }
      if (onError) onError(err);
    }
  );
}

export async function createMapDrawing({
  map_id,
  author_id,
  author_name,
  author_role = 'player',
  color = '#38bdf8',
  width = 4,
  points = [],
}) {
  if (!map_id || !author_id) return null;
  const cleanPoints = sanitizeDrawingPoints(points);
  if (cleanPoints.length === 0) return null;

  const firestore = requireDb();
  const ref = doc(collection(firestore, 'map_drawings'));
  await setDoc(ref, {
    map_id: String(map_id).slice(0, 128),
    author_id: String(author_id).slice(0, 128),
    author_name: String(author_name || 'Aventureiro').trim().slice(0, 60),
    author_role: author_role === 'master' ? 'master' : 'player',
    color: String(color || '#38bdf8').slice(0, 32),
    width: Math.max(1, Math.min(24, Number(width) || 4)),
    points: cleanPoints,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteMapDrawing(drawingId) {
  if (!drawingId) return;
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'map_drawings', drawingId));
}

export async function clearMapDrawings(mapId, { authorId = null, onlyPlayers = false } = {}) {
  if (!mapId) return 0;
  const firestore = requireDb();
  const snap = await getDocs(
    query(collection(firestore, 'map_drawings'), where('map_id', '==', String(mapId)))
  );
  if (snap.empty) return 0;

  const toDelete = snap.docs.filter((d) => {
    const data = d.data();
    if (authorId) return data.author_id === authorId;
    if (onlyPlayers) return data.author_role !== 'master';
    return true;
  });

  if (toDelete.length === 0) return 0;

  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = writeBatch(firestore);
    toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return toDelete.length;
}

/* ============================================================================
 * BIBLIOTECA & GERADOR DE NPCs ATRELADOS À HISTÓRIA (npcs — exclusivo Mestre)
 * ========================================================================== */

function sanitizeNpcPayload(data = {}, isCreate = false) {
  const out = {};
  if (isCreate || data.name !== undefined) {
    out.name = String(data.name || 'NPC Sem Nome').trim().slice(0, 100);
  }
  if (isCreate || data.profession !== undefined) {
    out.profession = String(data.profession || 'Cidadão').trim().slice(0, 120);
  }
  if (isCreate || data.race !== undefined) {
    out.race = String(data.race || 'Humano').trim().slice(0, 80);
  }
  if (isCreate || data.attitude !== undefined) {
    const valid = ['Aliado', 'Neutro', 'Misterioso', 'Hostil'];
    out.attitude = valid.includes(data.attitude) ? data.attitude : 'Neutro';
  }
  if (isCreate || data.appearance !== undefined) {
    out.appearance = String(data.appearance || '').trim().slice(0, 1500);
  }
  if (isCreate || data.personality !== undefined) {
    out.personality = String(data.personality || '').trim().slice(0, 1500);
  }
  if (isCreate || data.story_hook !== undefined) {
    out.story_hook = String(data.story_hook || '').trim().slice(0, 2000);
  }
  if (isCreate || data.secret !== undefined) {
    out.secret = String(data.secret || '').trim().slice(0, 2000);
  }
  if (isCreate || data.description !== undefined) {
    out.description = String(data.description || '').trim().slice(0, 4000);
  }
  if (isCreate || data.notes !== undefined) {
    out.notes = String(data.notes || '').slice(0, 5000);
  }
  if (isCreate || data.story_context !== undefined) {
    out.story_context = String(data.story_context || '').trim().slice(0, 1500);
  }
  if (isCreate || data.avatar_color !== undefined) {
    out.avatar_color = String(data.avatar_color || '#38bdf8').slice(0, 40);
  }
  if (isCreate || data.hp !== undefined) {
    out.hp = Math.max(0, Math.min(10000, Math.floor(Number(data.hp ?? 22))));
  }
  if (isCreate || data.max_hp !== undefined) {
    out.max_hp = Math.max(1, Math.min(10000, Math.floor(Number(data.max_hp ?? data.hp ?? 22))));
  }
  if (isCreate || data.ac !== undefined) {
    out.ac = Math.max(1, Math.min(50, Math.floor(Number(data.ac ?? 12))));
  }
  if (isCreate || data.mana !== undefined) {
    out.mana = Math.max(0, Math.min(10000, Math.floor(Number(data.mana ?? 0))));
  }
  if (isCreate || data.max_mana !== undefined) {
    out.max_mana = Math.max(0, Math.min(10000, Math.floor(Number(data.max_mana ?? data.mana ?? 0))));
  }
  if (isCreate || data.speed !== undefined) {
    out.speed = Math.max(0, Math.min(200, Math.round((Number(data.speed ?? 9) || 9) * 10) / 10));
  }
  if (isCreate && data.created_by) {
    out.created_by = String(data.created_by).slice(0, 128);
  }
  out.updatedAt = serverTimestamp();
  if (isCreate) {
    out.createdAt = serverTimestamp();
  }
  return out;
}

export function subscribeNpcs(onData, onError) {
  const firestore = requireDb();
  const q = query(collection(firestore, 'npcs'), limit(250));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : Number(a.createdAtMs) || 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : Number(b.createdAtMs) || 0;
        return tb - ta;
      });
      onData?.(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        onData?.([]);
        return;
      }
      if (onError) onError(err);
    }
  );
}

export async function createNpc(data) {
  const firestore = requireDb();
  const ref = doc(collection(firestore, 'npcs'));
  await setDoc(ref, sanitizeNpcPayload(data, true));
  return ref.id;
}

export async function updateNpc(npcId, updates) {
  if (!npcId) return;
  const firestore = requireDb();
  await updateDoc(doc(firestore, 'npcs', npcId), sanitizeNpcPayload(updates, false));
}

export async function deleteNpc(npcId) {
  if (!npcId) return;
  const firestore = requireDb();
  await deleteDoc(doc(firestore, 'npcs', npcId));
}

export async function removeNpcTokensFromMap(npcId, mapId = null) {
  if (!npcId) return 0;
  const firestore = requireDb();
  const snap = await getDocs(
    query(collection(firestore, 'map_tokens'), where('npc_id', '==', String(npcId)))
  );
  if (snap.empty) return 0;

  const targets = mapId
    ? snap.docs.filter((d) => d.data()?.map_id === String(mapId))
    : snap.docs;
  if (targets.length === 0) return 0;

  await commitChunkedBatchOps(
    firestore,
    targets.map((d) => ({ type: 'delete', ref: d.ref }))
  );
  return targets.length;
}
