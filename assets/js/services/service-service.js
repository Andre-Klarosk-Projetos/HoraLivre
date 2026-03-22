import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function listServicesByTenant(tenantId) {
  const servicesQuery = query(
    collection(db, 'services'),
    where('tenantId', '==', tenantId),
    orderBy('name')
  );

  const snapshot = await getDocs(servicesQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listActiveServicesByTenant(tenantId) {
  const servicesQuery = query(
    collection(db, 'services'),
    where('tenantId', '==', tenantId),
    where('isActive', '==', true),
    orderBy('name')
  );

  const snapshot = await getDocs(servicesQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function createService(data) {
  const payload = {
    tenantId: data.tenantId,
    name: data.name,
    description: data.description || '',
    durationMinutes: Number(data.durationMinutes || 0),
    price: Number(data.price || 0),
    isActive: data.isActive !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return addDoc(collection(db, 'services'), payload);
}

export async function updateService(serviceId, data) {
  const reference = doc(db, 'services', serviceId);

  await updateDoc(reference, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export async function toggleServiceActive(serviceId, isActive) {
  const reference = doc(db, 'services', serviceId);

  await updateDoc(reference, {
    isActive: Boolean(isActive),
    updatedAt: new Date().toISOString()
  });
}

export async function deleteService(serviceId) {
  const reference = doc(db, 'services', serviceId);
  await deleteDoc(reference);
}