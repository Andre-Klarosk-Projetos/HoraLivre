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

export async function bootstrapHoraLivreBase() {
  const now = new Date().toISOString();

  const results = [];

  results.push(
    await ensureDocument('platformSettings', 'main', {
      platformName: 'HoraLivre',
      supportWhatsapp: '5511999999999',
      supportWhatsappMessage: 'Olá, preciso de ajuda com o HoraLivre.',
      supportEmail: 'ia.klar.leao@gmail.com',
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('plans', 'free', {
      name: 'Free',
      billingMode: 'free',
      price: 0,
      pricePerExecutedService: 0,
      maxAppointmentsPerMonth: 30,
      maxClients: 50,
      maxServices: 5,
      publicPageEnabled: true,
      reportsEnabled: false,
      active: true,
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('plans', 'basico_fixo', {
      name: 'Básico Fixo',
      billingMode: 'fixed_plan',
      price: 49.9,
      pricePerExecutedService: 0,
      maxAppointmentsPerMonth: 300,
      maxClients: 500,
      maxServices: 30,
      publicPageEnabled: true,
      reportsEnabled: true,
      active: true,
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('plans', 'uso_concluido', {
      name: 'Uso por Concluído',
      billingMode: 'per_service',
      price: 0,
      pricePerExecutedService: 1.5,
      maxAppointmentsPerMonth: 999999,
      maxClients: 999999,
      maxServices: 999999,
      publicPageEnabled: true,
      reportsEnabled: true,
      active: true,
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('tenants', 'tenant_001', {
      ownerUserId: '',
      businessName: 'Barbearia do João',
      slug: 'barbearia-do-joao',
      ownerName: 'João',
      ownerEmail: 'joao@barbearia.com',
      ownerPhone: '55119988887777',
      planId: 'uso_concluido',
      billingMode: 'per_service',
      subscriptionStatus: 'active',
      trialStartsAt: null,
      trialEndsAt: null,
      isBlocked: false,
      logoUrl: 'https://dummyimage.com/300x300/000/fff.png&text=Barbearia+do+Joao',
      coverUrl: '',
      whatsapp: '55119988887777',
      instagram: '@barbeariadojoao',
      description: 'Barbearia premium com atendimento agendado.',
      address: 'Rua Exemplo, 123',
      publicPageEnabled: true,
      completedAppointmentsCurrentPeriod: 0,
      amountDueCurrentPeriod: 0,
      createdAt: now,
      updatedAt: now
    })
  );

  results.push(
    await ensureDocument('billingSettings', 'billing_tenant_001', {
      tenantId: 'tenant_001',
      billingMode: 'per_service',
      fixedMonthlyPrice: 0,
      pricePerExecutedService: 1.5,
      currency: 'BRL',
      manualBilling: true,
      dueDay: 10,
      createdAt: now,
      updatedAt: now
    })
  );

  return results;
}