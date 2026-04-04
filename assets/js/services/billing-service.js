import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db } from '../firebase-config.js';

/* ======================================================
   HELPERS
====================================================== */

function normalizeMonthReference(monthRef) {
  if (!monthRef) return null;

  return String(monthRef)
    .replace('/', '-')   // 🔥 CORREÇÃO PRINCIPAL
    .slice(0, 7);        // YYYY-MM
}

function generateBillingId(tenantId, monthRef) {
  const normalized = normalizeMonthReference(monthRef);

  if (!tenantId || !normalized) {
    throw new Error('Dados inválidos para gerar ID de cobrança.');
  }

  // 🔥 NUNCA usar "/" aqui
  return `billing_${normalized}_${tenantId}`;
}

function getBillingCollection() {
  return collection(db, 'billingRecords');
}

/* ======================================================
   LISTAGEM
====================================================== */

export async function listBillingRecords() {
  const snapshot = await getDocs(getBillingCollection());

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export async function listBillingRecordsByMonth(monthRef) {
  const normalized = normalizeMonthReference(monthRef);

  const q = query(
    getBillingCollection(),
    where('monthRef', '==', normalized)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export async function listBillingRecordsByTenant(tenantId) {
  const q = query(
    getBillingCollection(),
    where('tenantId', '==', tenantId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

/* ======================================================
   CRIAÇÃO DE COBRANÇA
====================================================== */

export async function generateBillingRecordForTenant(data) {
  const {
    tenantId,
    monthReference,
    billingMode = 'free',
    completedAppointments = 0,
    fixedMonthlyPrice = 0,
    annualPrice = 0,
    annualBillingMonth = null,
    pricePerExecutedService = 0,
    notes = '',
    companyNameSnapshot = '',
    companyWhatsappSnapshot = '',
    planIdSnapshot = '',
    subscriptionStatusSnapshot = ''
  } = data;

  const normalizedMonth = normalizeMonthReference(monthReference);

  if (!tenantId || !normalizedMonth) {
    throw new Error('Tenant ou mês inválido.');
  }

  const billingId = generateBillingId(tenantId, normalizedMonth);

  let amount = 0;

  // 💰 cálculo conforme tipo
  if (billingMode === 'per_service') {
    amount = completedAppointments * pricePerExecutedService;
  } else if (billingMode === 'fixed_plan') {
    amount = fixedMonthlyPrice;
  } else if (billingMode === 'annual_plan') {
    const currentMonth = Number(normalizedMonth.split('-')[1]);

    if (Number(annualBillingMonth) === currentMonth) {
      amount = annualPrice;
    } else {
      amount = 0;
    }
  }

  const billingDoc = {
    tenantId,
    monthRef: normalizedMonth,
    billingMode,
    completedAppointments,
    amount,
    paidAmount: 0,
    status: 'pending',
    createdAt: new Date(),

    // snapshots
    companyNameSnapshot,
    companyWhatsappSnapshot,
    planIdSnapshot,
    subscriptionStatusSnapshot,

    notes,
    annualBillingMonth
  };

  await setDoc(
    doc(db, 'billingRecords', billingId),
    billingDoc,
    { merge: true }
  );

  return billingId;
}

/* ======================================================
   MARCAR COMO PAGO
====================================================== */

export async function markBillingRecordAsPaid(recordId) {
  if (!recordId) {
    throw new Error('ID inválido.');
  }

  const ref = doc(db, 'billingRecords', recordId);

  await updateDoc(ref, {
    status: 'paid',
    paidAmount: 1, // você pode ajustar depois para valor real
    paidAt: new Date()
  });
}