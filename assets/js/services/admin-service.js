import {
  doc,
  getDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';
import { listTenants } from './tenant-service.js';
import {
  getBillingSettingsByTenant,
  calculateBillingForPeriod,
  listBillingRecordsByMonth,
  normalizeMonthReference
} from './billing-service.js';
import { getPlanById } from './plan-service.js';
import { countCompletedAppointments } from './appointment-service.js';
import { getStartAndEndOfCurrentMonth, getMonthReference } from '../utils/date-utils.js';

function resolveEffectiveBillingMode(company, billingSettings, plan) {
  return (
    billingSettings?.billingMode ||
    company?.billingMode ||
    plan?.billingMode ||
    'free'
  );
}

function resolveEffectiveFixedPrice(company, billingSettings, plan) {
  return Number(
    billingSettings?.fixedMonthlyPrice ??
    plan?.price ??
    company?.fixedMonthlyPrice ??
    0
  );
}

function resolveEffectiveAnnualPrice(company, billingSettings, plan) {
  return Number(
    billingSettings?.annualPrice ??
    plan?.annualPrice ??
    company?.annualPrice ??
    0
  );
}

function resolveEffectiveUnitPrice(company, billingSettings, plan) {
  return Number(
    billingSettings?.pricePerExecutedService ??
    plan?.pricePerExecutedService ??
    company?.pricePerExecutedService ??
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
  const companies = await listTenants();
  const { startIso, endIso } = getStartAndEndOfCurrentMonth();

  let trialCount = 0;
  let activeCount = 0;
  let blockedCount = 0;
  let totalRevenue = 0;
  let totalCompleted = 0;

  for (const company of companies) {
    if (company.subscriptionStatus === 'trial') {
      trialCount += 1;
    }

    if (company.subscriptionStatus === 'active') {
      activeCount += 1;
    }

    if (company.subscriptionStatus === 'blocked' || company.isBlocked === true) {
      blockedCount += 1;
    }
  }

  const monthReference = normalizeMonthReference(getMonthReference());
  const currentMonthRecords = await listBillingRecordsByMonth(monthReference);

  if (currentMonthRecords.length > 0) {
    totalRevenue = currentMonthRecords.reduce((sum, record) => {
      return sum + Number(record.totalAmount || 0);
    }, 0);

    totalCompleted = currentMonthRecords.reduce((sum, record) => {
      return sum + Number(record.completedAppointments || 0);
    }, 0);
  } else {
    for (const company of companies) {
      const plan = company.planId ? await getPlanById(company.planId) : null;
      const billingSettings = await getBillingSettingsByTenant(company.id);
      const completedAppointments = await countCompletedAppointments(company.id, startIso, endIso);

      const effectiveBillingMode = resolveEffectiveBillingMode(company, billingSettings, plan);
      const effectiveFixedPrice = resolveEffectiveFixedPrice(company, billingSettings, plan);
      const effectiveAnnualPrice = resolveEffectiveAnnualPrice(company, billingSettings, plan);
      const effectiveUnitPrice = resolveEffectiveUnitPrice(company, billingSettings, plan);

      const totalAmount = calculateBillingForPeriod({
        billingMode: effectiveBillingMode,
        completedAppointments,
        fixedMonthlyPrice: effectiveFixedPrice,
        annualPrice: effectiveAnnualPrice,
        pricePerExecutedService: effectiveUnitPrice
      });

      totalCompleted += completedAppointments;
      totalRevenue += totalAmount;
    }
  }

  return {
    tenants: companies.length,
    trial: trialCount,
    active: activeCount,
    blocked: blockedCount,
    completed: totalCompleted,
    revenue: totalRevenue
  };
}