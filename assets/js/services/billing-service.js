import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';
import {
  getMonthReference,
  getMonthNumberFromReference
} from '../utils/date-utils.js';

const BILLING_SETTINGS_COLLECTION = 'billingSettings';
const BILLING_RECORDS_COLLECTION = 'billingRecords';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBillingStatus(value) {
  return String(value || 'pending').trim() || 'pending';
}

function normalizeBillingMode(value) {
  return String(value || 'free').trim() || 'free';
}

export function normalizeMonthReference(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return getMonthReference();
  }

  const normalized = raw.replace(/-/g, '/').replace(/\s+/g, '');
  const match = normalized.match(/^(\d{4})\/(\d{1,2})$/);

  if (!match) {
    return getMonthReference();
  }

  const year = match[1];
  const month = String(match[2]).padStart(2, '0');

  return `${year}/${month}`;
}

function buildBillingSettingsPayload(tenantId, data = {}) {
  return {
    tenantId: tenantId || '',
    billingMode: normalizeBillingMode(data.billingMode),
    fixedMonthlyPrice: toNumber(data.fixedMonthlyPrice, 0),
    annualPrice: toNumber(data.annualPrice, 0),
    annualBillingMonth: data.annualBillingMonth ? toNumber(data.annualBillingMonth, 0) : null,
    pricePerExecutedService: toNumber(data.pricePerExecutedService, 0),
    updatedAt: new Date().toISOString()
  };
}

function buildBillingRecordPayload(data = {}) {
  const monthRef = normalizeMonthReference(data.monthRef || data.reference || getMonthReference());

  return {
    tenantId: data.tenantId || '',
    monthRef,
    reference: monthRef,
    billingMode: normalizeBillingMode(data.billingMode),
    completedAppointments: toNumber(data.completedAppointments, 0),
    unitPrice: toNumber(data.unitPrice, 0),
    fixedAmount: toNumber(data.fixedAmount ?? data.fixedMonthlyPrice, 0),
    fixedMonthlyPrice: toNumber(data.fixedMonthlyPrice ?? data.fixedAmount, 0),
    annualAmount: toNumber(data.annualAmount ?? data.annualPrice, 0),
    annualPrice: toNumber(data.annualPrice ?? data.annualAmount, 0),
    annualBillingMonth: data.annualBillingMonth ? toNumber(data.annualBillingMonth, 0) : null,
    totalAmount: toNumber(data.totalAmount ?? data.amount, 0),
    amount: toNumber(data.amount ?? data.totalAmount, 0),
    status: normalizeBillingStatus(data.status),
    notes: data.notes || '',
    companyNameSnapshot: data.companyNameSnapshot || '',
    companyWhatsappSnapshot: data.companyWhatsappSnapshot || '',
    planIdSnapshot: data.planIdSnapshot || '',
    subscriptionStatusSnapshot: data.subscriptionStatusSnapshot || '',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function calculateBillingForPeriod({
  billingMode,
  completedAppointments = 0,
  fixedMonthlyPrice = 0,
  annualPrice = 0,
  annualBillingMonth = null,
  currentMonthNumber = null,
  pricePerExecutedService = 0
}) {
  if (billingMode === 'free') {
    return 0;
  }

  if (billingMode === 'fixed_plan' || billingMode === 'monthly_plan') {
    return toNumber(fixedMonthlyPrice, 0);
  }

  if (billingMode === 'annual_plan') {
    if (!annualBillingMonth || !currentMonthNumber) {
      return 0;
    }

    return Number(currentMonthNumber) === Number(annualBillingMonth)
      ? toNumber(annualPrice, 0)
      : 0;
  }

  if (billingMode === 'per_service') {
    return toNumber(completedAppointments, 0) * toNumber(pricePerExecutedService, 0);
  }

  return 0;
}

export async function getBillingSettingsByTenant(tenantId) {
  if (!tenantId) {
    return null;
  }

  const settingsQuery = query(
    collection(db, BILLING_SETTINGS_COLLECTION),
    where('tenantId', '==', tenantId)
  );

  const snapshot = await getDocs(settingsQuery);

  if (snapshot.empty) {
    return null;
  }

  const documentItem = snapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function saveBillingSettingsForTenant(tenantId, data = {}) {
  if (!tenantId) {
    throw new Error('Tenant inválido para salvar configuração de cobrança.');
  }

  const existingSettings = await getBillingSettingsByTenant(tenantId);
  const payload = buildBillingSettingsPayload(tenantId, data);

  if (existingSettings?.id) {
    await updateDoc(doc(db, BILLING_SETTINGS_COLLECTION, existingSettings.id), payload);

    return {
      id: existingSettings.id,
      ...payload
    };
  }

  const createdReference = await addDoc(collection(db, BILLING_SETTINGS_COLLECTION), payload);

  return {
    id: createdReference.id,
    ...payload
  };
}

export async function listBillingRecords() {
  const recordsQuery = query(
    collection(db, BILLING_RECORDS_COLLECTION),
    orderBy('monthRef', 'desc')
  );

  const snapshot = await getDocs(recordsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listBillingRecordsByTenant(tenantId) {
  if (!tenantId) {
    return [];
  }

  const recordsQuery = query(
    collection(db, BILLING_RECORDS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('monthRef', 'desc')
  );

  const snapshot = await getDocs(recordsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listBillingRecordsByMonth(monthReference) {
  const monthRef = normalizeMonthReference(monthReference);

  const recordsQuery = query(
    collection(db, BILLING_RECORDS_COLLECTION),
    where('monthRef', '==', monthRef),
    orderBy('tenantId')
  );

  const snapshot = await getDocs(recordsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function getBillingRecordByTenantAndMonth(tenantId, monthReference) {
  if (!tenantId || !monthReference) {
    return null;
  }

  const monthRef = normalizeMonthReference(monthReference);

  const recordsQuery = query(
    collection(db, BILLING_RECORDS_COLLECTION),
    where('tenantId', '==', tenantId),
    where('monthRef', '==', monthRef)
  );

  const snapshot = await getDocs(recordsQuery);

  if (snapshot.empty) {
    return null;
  }

  const documentItem = snapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function getCurrentMonthBillingRecordForTenant(tenantId) {
  return getBillingRecordByTenantAndMonth(tenantId, getMonthReference());
}

export async function createOrReplaceBillingRecord(recordId, data = {}) {
  if (!recordId) {
    throw new Error('Identificador da cobrança é obrigatório.');
  }

  const payload = buildBillingRecordPayload(data);
  const reference = doc(db, BILLING_RECORDS_COLLECTION, recordId);
  const snapshot = await getDoc(reference);

  const finalPayload = {
    ...payload,
    createdAt: snapshot.exists()
      ? snapshot.data()?.createdAt || payload.createdAt
      : payload.createdAt
  };

  await setDoc(reference, finalPayload, { merge: true });

  return {
    id: recordId,
    ...finalPayload
  };
}

export async function createBillingRecordForTenant(tenantId, monthReference, data = {}) {
  if (!tenantId) {
    throw new Error('Tenant inválido para criar cobrança.');
  }

  const monthRef = normalizeMonthReference(monthReference || getMonthReference());
  const recordId = `billing_${monthRef}_${tenantId}`;

  return createOrReplaceBillingRecord(recordId, {
    ...data,
    tenantId,
    monthRef
  });
}

export async function updateBillingRecord(recordId, data = {}) {
  if (!recordId) {
    throw new Error('Cobrança inválida para atualização.');
  }

  const reference = doc(db, BILLING_RECORDS_COLLECTION, recordId);

  await updateDoc(reference, {
    ...(data.monthRef !== undefined
      ? {
          monthRef: normalizeMonthReference(data.monthRef),
          reference: normalizeMonthReference(data.monthRef)
        }
      : {}),
    ...(data.reference !== undefined
      ? {
          reference: normalizeMonthReference(data.reference),
          monthRef: normalizeMonthReference(data.reference)
        }
      : {}),
    ...(data.billingMode !== undefined ? { billingMode: normalizeBillingMode(data.billingMode) } : {}),
    ...(data.completedAppointments !== undefined
      ? { completedAppointments: toNumber(data.completedAppointments, 0) }
      : {}),
    ...(data.unitPrice !== undefined ? { unitPrice: toNumber(data.unitPrice, 0) } : {}),
    ...(data.fixedAmount !== undefined ? { fixedAmount: toNumber(data.fixedAmount, 0) } : {}),
    ...(data.fixedMonthlyPrice !== undefined ? { fixedMonthlyPrice: toNumber(data.fixedMonthlyPrice, 0) } : {}),
    ...(data.annualAmount !== undefined ? { annualAmount: toNumber(data.annualAmount, 0) } : {}),
    ...(data.annualPrice !== undefined ? { annualPrice: toNumber(data.annualPrice, 0) } : {}),
    ...(data.annualBillingMonth !== undefined
      ? { annualBillingMonth: data.annualBillingMonth ? toNumber(data.annualBillingMonth, 0) : null }
      : {}),
    ...(data.totalAmount !== undefined ? { totalAmount: toNumber(data.totalAmount, 0) } : {}),
    ...(data.amount !== undefined ? { amount: toNumber(data.amount, 0) } : {}),
    ...(data.status !== undefined ? { status: normalizeBillingStatus(data.status) } : {}),
    ...(data.notes !== undefined ? { notes: data.notes || '' } : {}),
    ...(data.companyNameSnapshot !== undefined ? { companyNameSnapshot: data.companyNameSnapshot || '' } : {}),
    ...(data.companyWhatsappSnapshot !== undefined ? { companyWhatsappSnapshot: data.companyWhatsappSnapshot || '' } : {}),
    ...(data.planIdSnapshot !== undefined ? { planIdSnapshot: data.planIdSnapshot || '' } : {}),
    ...(data.subscriptionStatusSnapshot !== undefined
      ? { subscriptionStatusSnapshot: data.subscriptionStatusSnapshot || '' }
      : {}),
    updatedAt: new Date().toISOString()
  });
}

export async function markBillingRecordAsPaid(recordId) {
  await updateBillingRecord(recordId, {
    status: 'paid'
  });
}

export async function markBillingRecordAsPending(recordId) {
  await updateBillingRecord(recordId, {
    status: 'pending'
  });
}

export async function generateBillingRecordForTenant({
  tenantId,
  monthReference,
  billingMode,
  completedAppointments = 0,
  fixedMonthlyPrice = 0,
  annualPrice = 0,
  annualBillingMonth = null,
  pricePerExecutedService = 0,
  notes = ''
}) {
  const monthRef = normalizeMonthReference(monthReference || getMonthReference());
  const currentMonthNumber = getMonthNumberFromReference(monthRef);

  const totalAmount = calculateBillingForPeriod({
    billingMode,
    completedAppointments,
    fixedMonthlyPrice,
    annualPrice,
    annualBillingMonth,
    currentMonthNumber,
    pricePerExecutedService
  });

  return createBillingRecordForTenant(tenantId, monthRef, {
    tenantId,
    monthRef,
    billingMode,
    completedAppointments,
    unitPrice: pricePerExecutedService,
    fixedAmount: fixedMonthlyPrice,
    fixedMonthlyPrice,
    annualAmount: annualPrice,
    annualPrice,
    annualBillingMonth,
    totalAmount,
    amount: totalAmount,
    status: 'pending',
    notes
  });
}

/* aliases de compatibilidade */

export async function getCurrentMonthBillingRecord(tenantId) {
  return getCurrentMonthBillingRecordForTenant(tenantId);
}

export async function saveBillingSettings(tenantId, data = {}) {
  return saveBillingSettingsForTenant(tenantId, data);
}

export async function getBillingSettings(tenantId) {
  return getBillingSettingsByTenant(tenantId);
}

export async function createBillingRecord(tenantId, monthReference, data = {}) {
  return createBillingRecordForTenant(tenantId, monthReference, data);
}