import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function listCustomersByTenant(tenantId) {
  const customersQuery = query(
    collection(db, 'customers'),
    where('tenantId', '==', tenantId),
    orderBy('name')
  );

  const snapshot = await getDocs(customersQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function getCustomerById(customerId) {
  const reference = doc(db, 'customers', customerId);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function createCustomer(data) {
  const payload = {
    tenantId: data.tenantId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    notes: data.notes || '',
    totalAppointments: Number(data.totalAppointments || 0),
    totalSpent: Number(data.totalSpent || 0),
    lastAppointmentAt: data.lastAppointmentAt || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return addDoc(collection(db, 'customers'), payload);
}

export async function updateCustomer(customerId, data) {
  const reference = doc(db, 'customers', customerId);

  await updateDoc(reference, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteCustomer(customerId) {
  const reference = doc(db, 'customers', customerId);
  await deleteDoc(reference);
}

export async function findCustomerByPhone(tenantId, phone) {
  const customerQuery = query(
    collection(db, 'customers'),
    where('tenantId', '==', tenantId),
    where('phone', '==', phone),
    limit(1)
  );

  const snapshot = await getDocs(customerQuery);

  if (snapshot.empty) {
    return null;
  }

  const documentItem = snapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function updateCustomerStats(customerId, stats) {
  const reference = doc(db, 'customers', customerId);

  await updateDoc(reference, {
    totalAppointments: Number(stats.totalAppointments || 0),
    totalSpent: Number(stats.totalSpent || 0),
    lastAppointmentAt: stats.lastAppointmentAt || null,
    updatedAt: new Date().toISOString()
  });
}