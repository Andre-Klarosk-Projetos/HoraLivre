import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function listPlans() {
  const plansQuery = query(
    collection(db, 'plans'),
    orderBy('name')
  );

  const snapshot = await getDocs(plansQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function getPlanById(planId) {
  if (!planId) {
    return null;
  }

  const reference = doc(db, 'plans', planId);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function createPlan(data) {
  return addDoc(collection(db, 'plans'), {
    name: data.name,
    billingMode: data.billingMode || 'free',
    price: Number(data.price || 0),
    pricePerExecutedService: Number(data.pricePerExecutedService || 0),
    publicPageEnabled: data.publicPageEnabled !== false,
    reportsEnabled: data.reportsEnabled !== false,
    maxServices: Number(data.maxServices || 0),
    maxCustomers: Number(data.maxCustomers || 0),
    maxAppointmentsMonth: Number(data.maxAppointmentsMonth || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function updatePlan(planId, data) {
  const reference = doc(db, 'plans', planId);

  await updateDoc(reference, {
    name: data.name,
    billingMode: data.billingMode || 'free',
    price: Number(data.price || 0),
    pricePerExecutedService: Number(data.pricePerExecutedService || 0),
    publicPageEnabled: data.publicPageEnabled !== false,
    reportsEnabled: data.reportsEnabled !== false,
    maxServices: Number(data.maxServices || 0),
    maxCustomers: Number(data.maxCustomers || 0),
    maxAppointmentsMonth: Number(data.maxAppointmentsMonth || 0),
    updatedAt: new Date().toISOString()
  });
}

export async function savePlanById(planId, data) {
  const reference = doc(db, 'plans', planId);

  await setDoc(reference, {
    name: data.name,
    billingMode: data.billingMode || 'free',
    price: Number(data.price || 0),
    pricePerExecutedService: Number(data.pricePerExecutedService || 0),
    publicPageEnabled: data.publicPageEnabled !== false,
    reportsEnabled: data.reportsEnabled !== false,
    maxServices: Number(data.maxServices || 0),
    maxCustomers: Number(data.maxCustomers || 0),
    maxAppointmentsMonth: Number(data.maxAppointmentsMonth || 0),
    updatedAt: new Date().toISOString()
  }, { merge: true });
}