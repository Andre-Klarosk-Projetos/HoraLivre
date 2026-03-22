import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
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

function buildBillingRecordPayload(tenantId, reference, data = {}) {
  return {
    tenantId: tenantId || '',
    reference: reference || getMonthReference(),
    billingMode: normalizeBillingMode(data.billingMode),
    completedAppointments: toNumber(data.completedAppointments, 0),
    unitPrice: toNumber(data.unitPrice, 0),
    fixedMonthlyPrice: toNumber(data.fixedMonthlyPrice, 0),
    annualPrice: toNumber(data.annualPrice, 0),
    annualBillingMonth: data.annualBillingMonth ? toNumber(data.annualBillingMonth, 0) : null,
    amount: toNumber(data.amount, 0),
    status: normalizeBillingStatus(data.status),
    notes: data.notes || '',
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

export async function listBillingRecordsByTenant(tenantId) {
  if (!tenantId) {
    return [];
  }

  const recordsQuery = query(
    collection(db, BILLING_RECORDS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('reference', 'desc')
  );

  const snapshot = await getDocs(recordsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listBillingRecordsByMonth(monthReference) {
  if (!monthReference) {
    return [];
  }

  const recordsQuery = query(
    collection(db, BILLING_RECORDS_COLLECTION),
    where('reference', '==', monthReference),
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

  const recordsQuery = query(
    collection(db, BILLING_RECORDS_COLLECTION),
    where('tenantId', '==', tenantId),
    where('reference', '==', monthReference)
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

export async function createBillingRecordForTenant(tenantId, monthReference, data = {}) {
  if (!tenantId) {
    throw new Error('Tenant inválido para criar cobrança.');
  }

  const reference = monthReference || getMonthReference();
  const existingRecord = await getBillingRecordByTenantAndMonth(tenantId, reference);
  const payload = buildBillingRecordPayload(tenantId, reference, data);

  if (existingRecord?.id) {
    await updateDoc(doc(db, BILLING_RECORDS_COLLECTION, existingRecord.id), {
      ...payload,
      createdAt: existingRecord.createdAt || payload.createdAt
    });

    return {
      id: existingRecord.id,
      ...payload,
      createdAt: existingRecord.createdAt || payload.createdAt
    };
  }

  const createdReference = await addDoc(collection(db, BILLING_RECORDS_COLLECTION), payload);

  return {
    id: createdReference.id,
    ...payload
  };
}

export async function updateBillingRecord(recordId, data = {}) {
  if (!recordId) {
    throw new Error('Cobrança inválida para atualização.');
  }

  const reference = doc(db, BILLING_RECORDS_COLLECTION, recordId);

  await updateDoc(reference, {
    ...(data.billingMode !== undefined ? { billingMode: normalizeBillingMode(data.billingMode) } : {}),
    ...(data.completedAppointments !== undefined
      ? { completedAppointments: toNumber(data.completedAppointments, 0) }
      : {}),
    ...(data.unitPrice !== undefined ? { unitPrice: toNumber(data.unitPrice, 0) } : {}),
    ...(data.fixedMonthlyPrice !== undefined
      ? { fixedMonthlyPrice: toNumber(data.fixedMonthlyPrice, 0) }
      : {}),
    ...(data.annualPrice !== undefined ? { annualPrice: toNumber(data.annualPrice, 0) } : {}),
    ...(data.annualBillingMonth !== undefined
      ? { annualBillingMonth: data.annualBillingMonth ? toNumber(data.annualBillingMonth, 0) : null }
      : {}),
    ...(data.amount !== undefined ? { amount: toNumber(data.amount, 0) } : {}),
    ...(data.status !== undefined ? { status: normalizeBillingStatus(data.status) } : {}),
    ...(data.notes !== undefined ? { notes: data.notes || '' } : {}),
    updatedAt: new Date().toISOString()
  });
}

export async function markBillingRecordAsPaid(recordId) {
  await updateBillingRecord(recordId, {
    status: 'paid'
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
  const reference = monthReference || getMonthReference();
  const currentMonthNumber = getMonthNumberFromReference(reference);

  const amount = calculateBillingForPeriod({
    billingMode,
    completedAppointments,
    fixedMonthlyPrice,
    annualPrice,
    annualBillingMonth,
    currentMonthNumber,
    pricePerExecutedService
  });

  return createBillingRecordForTenant(tenantId, reference, {
    billingMode,
    completedAppointments,
    unitPrice: pricePerExecutedService,
    fixedMonthlyPrice,
    annualPrice,
    annualBillingMonth,
    amount,
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