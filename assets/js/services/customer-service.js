import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function listTenantCustomers(tenantId) {
  if (!tenantId) {
    return [];
  }

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

export async function listTenantCustomersForSelect(tenantId) {
  return listTenantCustomers(tenantId);
}

export async function getTenantCustomerById(customerId) {
  if (!customerId) {
    return null;
  }

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

export async function createTenantCustomer(data) {
  return addDoc(collection(db, 'customers'), {
    tenantId: data.tenantId || '',
    name: data.name || '',
    phone: data.phone || '',
    email: data.email || '',
    notes: data.notes || '',
    totalAppointments: Number(data.totalAppointments || 0),
    completedAppointments: Number(data.completedAppointments || 0),
    lastAppointmentAt: data.lastAppointmentAt || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function updateTenantCustomer(customerId, data) {
  if (!customerId) {
    throw new Error('Cliente inválido para atualização.');
  }

  const reference = doc(db, 'customers', customerId);

  await updateDoc(reference, {
    ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
    ...(data.name !== undefined ? { name: data.name || '' } : {}),
    ...(data.phone !== undefined ? { phone: data.phone || '' } : {}),
    ...(data.email !== undefined ? { email: data.email || '' } : {}),
    ...(data.notes !== undefined ? { notes: data.notes || '' } : {}),
    ...(data.totalAppointments !== undefined
      ? { totalAppointments: Number(data.totalAppointments || 0) }
      : {}),
    ...(data.completedAppointments !== undefined
      ? { completedAppointments: Number(data.completedAppointments || 0) }
      : {}),
    ...(data.lastAppointmentAt !== undefined
      ? { lastAppointmentAt: data.lastAppointmentAt || null }
      : {}),
    updatedAt: new Date().toISOString()
  });
}

export async function deleteTenantCustomer(customerId) {
  if (!customerId) {
    throw new Error('Cliente inválido para exclusão.');
  }

  await deleteDoc(doc(db, 'customers', customerId));
}

export async function saveTenantCustomer(customerId, data) {
  if (customerId) {
    await updateTenantCustomer(customerId, data);
    return { id: customerId };
  }

  return createTenantCustomer(data);
}

/*
  Aliases de compatibilidade
  Mantidos para não quebrar arquivos antigos do projeto.
*/

export async function listCustomersByTenant(tenantId) {
  return listTenantCustomers(tenantId);
}

export async function listCustomersForSelect(tenantId) {
  return listTenantCustomersForSelect(tenantId);
}

export async function getCustomerById(customerId) {
  return getTenantCustomerById(customerId);
}

export async function createCustomer(data) {
  return createTenantCustomer(data);
}

export async function updateCustomer(customerId, data) {
  return updateTenantCustomer(customerId, data);
}

export async function deleteCustomer(customerId) {
  return deleteTenantCustomer(customerId);
}