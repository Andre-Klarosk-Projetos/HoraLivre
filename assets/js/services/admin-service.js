import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';
import { listTenants } from './tenant-service.js';
import { getBillingSettingsByTenant, calculateBillingForPeriod } from './billing-service.js';
import { getPlanById } from './plan-service.js';
import { countCompletedAppointments } from './appointment-service.js';
import { getStartAndEndOfCurrentMonth } from '../utils/date-utils.js';

function resolveEffectiveBillingMode(tenant, billingSettings, plan) {
  return (
    billingSettings?.billingMode ||
    tenant?.billingMode ||
    plan?.billingMode ||
    'free'
  );
}

function resolveEffectiveFixedPrice(tenant, billingSettings, plan) {
  return Number(
    billingSettings?.fixedMonthlyPrice ??
    plan?.price ??
    tenant?.fixedMonthlyPrice ??
    0
  );
}

function resolveEffectiveUnitPrice(tenant, billingSettings, plan) {
  return Number(
    billingSettings?.pricePerExecutedService ??
    plan?.pricePerExecutedService ??
    tenant?.pricePerExecutedService ??
    0
  );
}

export async function getPlatformSettings() {
  const reference = doc(db, 'platformSettings', 'main');
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function savePlatformSettings(data) {
  const reference = doc(db, 'platformSettings', 'main');

  await setDoc(
    reference,
    {
      ...data,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

export async function getAdminDashboardMetrics() {
  const tenants = await listTenants();
  const { startIso, endIso } = getStartAndEndOfCurrentMonth();

  let trialCount = 0;
  let activeCount = 0;
  let blockedCount = 0;
  let totalRevenue = 0;
  let totalCompleted = 0;

  for (const tenant of tenants) {
    if (tenant.subscriptionStatus === 'trial') {
      trialCount += 1;
    }

    if (tenant.subscriptionStatus === 'active') {
      activeCount += 1;
    }

    if (tenant.subscriptionStatus === 'blocked' || tenant.isBlocked === true) {
      blockedCount += 1;
    }

    const plan = tenant.planId ? await getPlanById(tenant.planId) : null;
    const billingSettings = await getBillingSettingsByTenant(tenant.id);
    const completedAppointments = await countCompletedAppointments(tenant.id, startIso, endIso);

    const effectiveBillingMode = resolveEffectiveBillingMode(tenant, billingSettings, plan);
    const effectiveFixedPrice = resolveEffectiveFixedPrice(tenant, billingSettings, plan);
    const effectiveUnitPrice = resolveEffectiveUnitPrice(tenant, billingSettings, plan);

    const totalAmount = calculateBillingForPeriod({
      billingMode: effectiveBillingMode,
      completedAppointments,
      fixedMonthlyPrice: effectiveFixedPrice,
      pricePerExecutedService: effectiveUnitPrice
    });

    totalCompleted += completedAppointments;
    totalRevenue += totalAmount;
  }

  return {
    tenants: tenants.length,
    trial: trialCount,
    active: activeCount,
    blocked: blockedCount,
    completed: totalCompleted,
    revenue: totalRevenue
  };
}