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

export function calculateBillingForPeriod({
  billingMode,
  completedAppointments,
  fixedMonthlyPrice,
  pricePerExecutedService
}) {
  if (billingMode === 'fixed_plan') {
    return Number(fixedMonthlyPrice || 0);
  }

  if (billingMode === 'per_service') {
    return Number(completedAppointments || 0) * Number(pricePerExecutedService || 0);
  }

  return 0;
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
    pricePerExecutedService: Number(data.pricePerExecutedService || 0),
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function createOrReplaceBillingRecord(recordId, data) {
  const reference = doc(db, 'billingRecords', recordId);

  await setDoc(reference, {
    ...data,
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
    ...documentItem.data()
  }));
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