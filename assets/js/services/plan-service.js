import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function listPlans() {
  const plansQuery = query(collection(db, 'plans'), orderBy('name'));
  const snapshot = await getDocs(plansQuery);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data()
  }));
}

export async function getPlanById(planId) {
  const ref = doc(db, 'plans', planId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function createPlan(data) {
  const payload = {
    name: data.name,
    billingMode: data.billingMode,
    price: Number(data.price || 0),
    pricePerExecutedService: Number(data.pricePerExecutedService || 0),
    maxAppointmentsPerMonth: Number(data.maxAppointmentsPerMonth || 0),
    maxClients: Number(data.maxClients || 0),
    maxServices: Number(data.maxServices || 0),
    publicPageEnabled: Boolean(data.publicPageEnabled),
    reportsEnabled: Boolean(data.reportsEnabled),
    active: Boolean(data.active),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return addDoc(collection(db, 'plans'), payload);
}

export async function updatePlan(planId, data) {
  const ref = doc(db, 'plans', planId);

  await updateDoc(ref, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}