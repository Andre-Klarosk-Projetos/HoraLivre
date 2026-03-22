import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function getBillingSettingsByTenant(tenantId) {
  const directReference = doc(db, 'billingSettings', `billing_${tenantId}`);
  const directSnapshot = await getDoc(directReference);

  if (directSnapshot.exists()) {
    return {
      id: directSnapshot.id,
      ...directSnapshot.data()
    };
  }

  const legacyReference = doc(db, 'billingSettings', `billing_${tenantId.replace('tenant_', 'tenant_')}`);
  const legacySnapshot = await getDoc(legacyReference);

  if (legacySnapshot.exists()) {
    return {
      id: legacySnapshot.id,
      ...legacySnapshot.data()
    };
  }

  const settingsQuery = query(
    collection(db, 'billingSettings'),
    where('tenantId', '==', tenantId),
    limit(1)
  );

  const querySnapshot = await getDocs(settingsQuery);

  if (querySnapshot.empty) {
    return null;
  }

  const documentItem = querySnapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function saveBillingSettings(recordId, data) {
  const reference = doc(db, 'billingSettings', recordId);

  await setDoc(
    reference,
    {
      ...data,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

export async function listBillingRecords() {
  const billingQuery = query(
    collection(db, 'billingRecords'),
    orderBy('monthRef', 'desc')
  );

  const snapshot = await getDocs(billingQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listBillingRecordsByTenant(tenantId) {
  const billingQuery = query(
    collection(db, 'billingRecords'),
    where('tenantId', '==', tenantId),
    orderBy('monthRef', 'desc')
  );

  const snapshot = await getDocs(billingQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function getBillingRecordByTenantAndMonth(tenantId, monthRef) {
  const billingQuery = query(
    collection(db, 'billingRecords'),
    where('tenantId', '==', tenantId),
    where('monthRef', '==', monthRef),
    limit(1)
  );

  const snapshot = await getDocs(billingQuery);

  if (snapshot.empty) {
    return null;
  }

  const documentItem = snapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function generateBillingRecord(data) {
  const payload = {
    tenantId: data.tenantId,
    monthRef: data.monthRef,
    billingMode: data.billingMode,
    completedAppointments: Number(data.completedAppointments || 0),
    unitPrice: Number(data.unitPrice || 0),
    fixedAmount: Number(data.fixedAmount || 0),
    totalAmount: Number(data.totalAmount || 0),
    status: data.status || 'pending',
    generatedAt: new Date().toISOString(),
    paidAt: data.paidAt || null,
    notes: data.notes || ''
  };

  return addDoc(collection(db, 'billingRecords'), payload);
}

export async function createOrReplaceBillingRecord(documentId, data) {
  const reference = doc(db, 'billingRecords', documentId);

  await setDoc(reference, {
    tenantId: data.tenantId,
    monthRef: data.monthRef,
    billingMode: data.billingMode,
    completedAppointments: Number(data.completedAppointments || 0),
    unitPrice: Number(data.unitPrice || 0),
    fixedAmount: Number(data.fixedAmount || 0),
    totalAmount: Number(data.totalAmount || 0),
    status: data.status || 'pending',
    generatedAt: new Date().toISOString(),
    paidAt: data.paidAt || null,
    notes: data.notes || ''
  });
}

export async function markBillingRecordAsPaid(recordId) {
  const reference = doc(db, 'billingRecords', recordId);

  await updateDoc(reference, {
    status: 'paid',
    paidAt: new Date().toISOString()
  });
}

export async function markBillingRecordAsPending(recordId) {
  const reference = doc(db, 'billingRecords', recordId);

  await updateDoc(reference, {
    status: 'pending',
    paidAt: null
  });
}

export function calculateBillingForPeriod({
  billingMode,
  completedAppointments,
  fixedMonthlyPrice,
  pricePerExecutedService
}) {
  const normalizedBillingMode = String(billingMode || '').trim();
  const normalizedCompletedAppointments = Number(completedAppointments || 0);
  const normalizedFixedMonthlyPrice = Number(fixedMonthlyPrice || 0);
  const normalizedPricePerExecutedService = Number(pricePerExecutedService || 0);

  if (normalizedBillingMode === 'fixed_plan') {
    return normalizedFixedMonthlyPrice;
  }

  if (normalizedBillingMode === 'per_service') {
    return normalizedCompletedAppointments * normalizedPricePerExecutedService;
  }

  return 0;
}