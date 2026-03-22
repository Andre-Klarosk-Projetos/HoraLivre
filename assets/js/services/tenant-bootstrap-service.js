import {
  doc,
  getDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

async function ensureDocument(collectionName, documentId, data) {
  const reference = doc(db, collectionName, documentId);
  const snapshot = await getDoc(reference);

  if (snapshot.exists()) {
    return {
      created: false,
      id: documentId
    };
  }

  await setDoc(reference, data);

  return {
    created: true,
    id: documentId
  };
}

export async function bootstrapTenantOperationalData() {
  const now = new Date().toISOString();

  const results = [];

  results.push(
    await ensureDocument('services', 'service_001', {
      tenantId: 'tenant_001',
      name: 'Corte Masculino',
      description: 'Corte tradicional masculino.',
      durationMinutes: 45,
      price: 35,
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('services', 'service_002', {
      tenantId: 'tenant_001',
      name: 'Barba',
      description: 'Modelagem e acabamento de barba.',
      durationMinutes: 30,
      price: 25,
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('services', 'service_003', {
      tenantId: 'tenant_001',
      name: 'Corte e Barba',
      description: 'Pacote completo de corte e barba.',
      durationMinutes: 75,
      price: 55,
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('customers', 'customer_001', {
      tenantId: 'tenant_001',
      name: 'Carlos Silva',
      phone: '55119977776666',
      email: 'carlos@email.com',
      notes: 'Prefere corte mais baixo na lateral.',
      totalAppointments: 2,
      totalSpent: 90,
      lastAppointmentAt: '2026-03-20T14:00:00.000Z',
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('customers', 'customer_002', {
      tenantId: 'tenant_001',
      name: 'Marcos Souza',
      phone: '55119966665555',
      email: 'marcos@email.com',
      notes: 'Cliente recorrente.',
      totalAppointments: 1,
      totalSpent: 35,
      lastAppointmentAt: '2026-03-18T16:00:00.000Z',
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('appointments', 'appointment_001', {
      tenantId: 'tenant_001',
      customerId: 'customer_001',
      customerName: 'Carlos Silva',
      serviceId: 'service_003',
      serviceName: 'Corte e Barba',
      startAt: '2026-03-20T14:00:00.000Z',
      endAt: '2026-03-20T15:15:00.000Z',
      price: 55,
      status: 'completed',
      source: 'panel',
      notes: 'Atendimento concluído normalmente.',
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('appointments', 'appointment_002', {
      tenantId: 'tenant_001',
      customerId: 'customer_002',
      customerName: 'Marcos Souza',
      serviceId: 'service_001',
      serviceName: 'Corte Masculino',
      startAt: '2026-03-21T16:00:00.000Z',
      endAt: '2026-03-21T16:45:00.000Z',
      price: 35,
      status: 'scheduled',
      source: 'panel',
      notes: '',
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('billingRecords', 'billing_2026_03_tenant_001', {
      tenantId: 'tenant_001',
      monthRef: '2026-03',
      billingMode: 'per_service',
      completedAppointments: 1,
      unitPrice: 1.5,
      fixedAmount: 0,
      totalAmount: 1.5,
      status: 'pending',
      generatedAt: now,
      paidAt: null,
      notes: ''
    })
  );

  return results;
}