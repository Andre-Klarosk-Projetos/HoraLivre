import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export function isAnnualBillingMonth(currentMonthNumber, annualBillingMonth) {
  return Number(currentMonthNumber || 0) === Number(annualBillingMonth || 0);
}

export function calculateBillingForPeriod({
  billingMode,
  completedAppointments,
  fixedMonthlyPrice,
  annualPrice,
  annualBillingMonth,
  currentMonthNumber,
  pricePerExecutedService
}) {
  if (billingMode === 'fixed_plan') {
    return Number(fixedMonthlyPrice || 0);
  }

  if (billingMode === 'annual_plan') {
    if (!isAnnualBillingMonth(currentMonthNumber, annualBillingMonth)) {
      return 0;
    }

    return Number(annualPrice || 0);
  }

  if (billingMode === 'per_service') {
    return Number(completedAppointments || 0) * Number(pricePerExecutedService || 0);
  }

  return 0;
}

export function normalizeMonthReference(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  if (/^\d{4}\/\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return raw.replace('-', '/');
  }

  return raw;
}

export async function getBillingSettingsByTenant(tenantId) {
  if (!tenantId) {
    return null;
  }

  const reference = doc(db, 'billingSettings', tenantId);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function saveBillingSettingsForTenant(tenantId, data) {
  const reference = doc(db, 'billingSettings', tenantId);

  await setDoc(reference, {
    tenantId,
    billingMode: data.billingMode || 'free',
    fixedMonthlyPrice: Number(data.fixedMonthlyPrice || 0),
    annualPrice: Number(data.annualPrice || 0),
    annualBillingMonth: Number(data.annualBillingMonth || 0) || null,
    pricePerExecutedService: Number(data.pricePerExecutedService || 0),
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function createOrReplaceBillingRecord(recordId, data) {
  const reference = doc(db, 'billingRecords', recordId);

  await setDoc(reference, {
    ...data,
    monthRef: normalizeMonthReference(data.monthRef),
    totalAmount: Number(data.totalAmount || 0),
    completedAppointments: Number(data.completedAppointments || 0),
    unitPrice: Number(data.unitPrice || 0),
    fixedAmount: Number(data.fixedAmount || 0),
    annualAmount: Number(data.annualAmount || 0),
    annualBillingMonth: Number(data.annualBillingMonth || 0) || null,
    status: data.status || 'pending',
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function listBillingRecords() {
  const recordsQuery = query(
    collection(db, 'billingRecords'),
    orderBy('monthRef', 'desc')
  );

  const snapshot = await getDocs(recordsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data(),
    monthRef: normalizeMonthReference(documentItem.data().monthRef)
  }));
}

export async function listBillingRecordsByMonth(monthRef) {
  const normalizedMonthRef = normalizeMonthReference(monthRef);

  if (!normalizedMonthRef) {
    return [];
  }

  const recordsQuery = query(
    collection(db, 'billingRecords'),
    where('monthRef', '==', normalizedMonthRef)
  );

  const snapshot = await getDocs(recordsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data(),
    monthRef: normalizeMonthReference(documentItem.data().monthRef)
  }));
}

export async function getBillingRecordByTenantAndMonth(tenantId, monthRef) {
  const normalizedMonthRef = normalizeMonthReference(monthRef);

  if (!tenantId || !normalizedMonthRef) {
    return null;
  }

  const recordsQuery = query(
    collection(db, 'billingRecords'),
    where('tenantId', '==', tenantId),
    where('monthRef', '==', normalizedMonthRef)
  );

  const snapshot = await getDocs(recordsQuery);

  if (snapshot.empty) {
    return null;
  }

  const documentItem = snapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data(),
    monthRef: normalizeMonthReference(documentItem.data().monthRef)
  };
}

export async function markBillingRecordAsPaid(recordId) {
  const reference = doc(db, 'billingRecords', recordId);

  await updateDoc(reference, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function markBillingRecordAsPending(recordId) {
  const reference = doc(db, 'billingRecords', recordId);

  await updateDoc(reference, {
    status: 'pending',
    updatedAt: new Date().toISOString()
  });
}