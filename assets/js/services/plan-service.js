import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPlanPayload(data = {}, { isCreate = false } = {}) {
  const payload = {
    name: normalizeString(data.name),
    description: normalizeString(data.description),
    featured: normalizeBoolean(data.featured, false),
    highlighted: normalizeBoolean(data.highlighted, false),
    displayOrder: normalizeNumber(data.displayOrder, 0),
    billingMode: normalizeString(data.billingMode, 'free') || 'free',
    price: normalizeNumber(data.price, 0),
    annualPrice: normalizeNumber(data.annualPrice, 0),
    annualBillingMonth: normalizeNullableNumber(data.annualBillingMonth),
    pricePerExecutedService: normalizeNumber(data.pricePerExecutedService, 0),
    publicPageEnabled: normalizeBoolean(data.publicPageEnabled, true),
    reportsEnabled: normalizeBoolean(data.reportsEnabled, true),
    maxServices: normalizeNumber(data.maxServices, 0),
    maxCustomers: normalizeNumber(data.maxCustomers, 0),
    maxAppointmentsMonth: normalizeNumber(
      data.maxAppointmentsMonth ?? data.maxAppointmentsPerMonth,
      0
    ),
    updatedAt: new Date().toISOString()
  };

  if (isCreate) {
    payload.createdAt = new Date().toISOString();
  }

  return payload;
}

export async function listPlans() {
  const plansQuery = query(
    collection(db, 'plans'),
    orderBy('displayOrder')
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
  const payload = buildPlanPayload(data, { isCreate: true });
  return addDoc(collection(db, 'plans'), payload);
}

export async function updatePlan(planId, data) {
  if (!planId) {
    throw new Error('Plano inválido para atualização.');
  }

  const reference = doc(db, 'plans', planId);
  const payload = buildPlanPayload(data);

  await updateDoc(reference, payload);
}

export async function deletePlan(planId) {
  if (!planId) {
    throw new Error('Plano inválido para exclusão.');
  }

  await deleteDoc(doc(db, 'plans', planId));
}
