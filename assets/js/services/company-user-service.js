import {
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

import {
  doc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db, secondaryAuth } from '../config/firebase-init.js';
import { createTenant } from './tenant-service.js';
import { saveBillingSettingsForTenant } from './billing-service.js';

export async function createCompanyClientWithAccess({
  businessName,
  slug,
  whatsapp,
  email,
  password,
  planId,
  subscriptionStatus,
  billingMode,
  fixedMonthlyPrice,
  annualPrice,
  annualBillingMonth,
  pricePerExecutedService,
  publicPageEnabled,
  reportsEnabled,
  trialEndsAt,
  ownerName
}) {
  const credential = await createUserWithEmailAndPassword(
    secondaryAuth,
    email,
    password
  );

  const uid = credential.user.uid;

  const tenantReference = await createTenant({
    businessName,
    slug,
    whatsapp,
    planId,
    billingMode,
    fixedMonthlyPrice,
    annualPrice,
    annualBillingMonth,
    pricePerExecutedService,
    subscriptionStatus,
    publicPageEnabled,
    reportsEnabled,
    trialEndsAt,
    isBlocked: subscriptionStatus === 'blocked'
  });

  const tenantId = tenantReference.id;

  await setDoc(doc(db, 'tenantUsers', uid), {
    uid,
    tenantId,
    email,
    name: ownerName || businessName,
    role: 'owner',
    createdAt: new Date().toISOString()
  });

  await saveBillingSettingsForTenant(tenantId, {
    billingMode,
    fixedMonthlyPrice,
    annualPrice,
    annualBillingMonth,
    pricePerExecutedService
  });

  return {
    uid,
    tenantId
  };
}