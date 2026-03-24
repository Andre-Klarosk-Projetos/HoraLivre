import {
  addDoc,
  collection,
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

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNullableString(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value).trim();
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeSpecialDates(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      date: normalizeString(item?.date),
      openingTime: normalizeString(item?.openingTime || item?.start),
      closingTime: normalizeString(item?.closingTime || item?.end),
      lunchStartTime: normalizeString(item?.lunchStartTime),
      lunchEndTime: normalizeString(item?.lunchEndTime),
      enabled: item?.enabled !== false
    }))
    .filter((item) => item.date);
}

function normalizeBusinessHours(value = {}) {
  return {
    workingDays: normalizeStringArray(value.workingDays),
    openingTime: normalizeString(value.openingTime),
    closingTime: normalizeString(value.closingTime),
    lunchStartTime: normalizeString(value.lunchStartTime),
    lunchEndTime: normalizeString(value.lunchEndTime),
    slotIntervalMinutes: normalizeNumber(value.slotIntervalMinutes, 30),
    holidays: normalizeStringArray(value.holidays),
    blockedDates: normalizeStringArray(value.blockedDates),
    specialDates: normalizeSpecialDates(value.specialDates)
  };
}

function buildTenantCreatePayload(data = {}) {
  return {
    businessName: normalizeString(data.businessName),
    slug: normalizeString(data.slug),
    whatsapp: normalizeString(data.whatsapp),
    description: normalizeString(data.description),
    logoUrl: normalizeString(data.logoUrl),
    instagram: normalizeString(data.instagram),
    address: normalizeString(data.address),

    planId: normalizeString(data.planId),
    billingMode: normalizeString(data.billingMode, 'free') || 'free',
    fixedMonthlyPrice: normalizeNumber(data.fixedMonthlyPrice, 0),
    annualPrice: normalizeNumber(data.annualPrice, 0),
    annualBillingMonth: normalizeNullableNumber(data.annualBillingMonth),
    pricePerExecutedService: normalizeNumber(data.pricePerExecutedService, 0),
    subscriptionStatus: normalizeString(data.subscriptionStatus, 'trial') || 'trial',

    publicPageEnabled: normalizeBoolean(data.publicPageEnabled, true),
    reportsEnabled: normalizeBoolean(data.reportsEnabled, true),
    trialEndsAt: normalizeNullableString(data.trialEndsAt),
    isBlocked: normalizeBoolean(data.isBlocked, false),

    businessHours: normalizeBusinessHours(data.businessHours),

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildTenantUpdatePayload(data = {}) {
  const payload = {};

  if ('businessName' in data) {
    payload.businessName = normalizeString(data.businessName);
  }

  if ('slug' in data) {
    payload.slug = normalizeString(data.slug);
  }

  if ('whatsapp' in data) {
    payload.whatsapp = normalizeString(data.whatsapp);
  }

  if ('description' in data) {
    payload.description = normalizeString(data.description);
  }

  if ('logoUrl' in data) {
    payload.logoUrl = normalizeString(data.logoUrl);
  }

  if ('instagram' in data) {
    payload.instagram = normalizeString(data.instagram);
  }

  if ('address' in data) {
    payload.address = normalizeString(data.address);
  }

  if ('planId' in data) {
    payload.planId = normalizeString(data.planId);
  }

  if ('billingMode' in data) {
    payload.billingMode = normalizeString(data.billingMode, 'free') || 'free';
  }

  if ('fixedMonthlyPrice' in data) {
    payload.fixedMonthlyPrice = normalizeNumber(data.fixedMonthlyPrice, 0);
  }

  if ('annualPrice' in data) {
    payload.annualPrice = normalizeNumber(data.annualPrice, 0);
  }

  if ('annualBillingMonth' in data) {
    payload.annualBillingMonth = normalizeNullableNumber(data.annualBillingMonth);
  }

  if ('pricePerExecutedService' in data) {
    payload.pricePerExecutedService = normalizeNumber(
      data.pricePerExecutedService,
      0
    );
  }

  if ('subscriptionStatus' in data) {
    payload.subscriptionStatus = normalizeString(data.subscriptionStatus);
  }

  if ('publicPageEnabled' in data) {
    payload.publicPageEnabled = normalizeBoolean(data.publicPageEnabled, true);
  }

  if ('reportsEnabled' in data) {
    payload.reportsEnabled = normalizeBoolean(data.reportsEnabled, true);
  }

  if ('trialEndsAt' in data) {
    payload.trialEndsAt = normalizeNullableString(data.trialEndsAt);
  }

  if ('isBlocked' in data) {
    payload.isBlocked = normalizeBoolean(data.isBlocked, false);
  }

  if ('businessHours' in data) {
    payload.businessHours = normalizeBusinessHours(data.businessHours);
  }

  payload.updatedAt = new Date().toISOString();

  return payload;
}

export async function listTenants() {
  const tenantsQuery = query(
    collection(db, 'tenants'),
    orderBy('businessName')
  );

  const snapshot = await getDocs(tenantsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function getTenantById(tenantId) {
  if (!tenantId) {
    return null;
  }

  const reference = doc(db, 'tenants', tenantId);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function getTenantBySlug(slug) {
  const normalizedSlug = normalizeString(slug);

  if (!normalizedSlug) {
    return null;
  }

  const tenantsQuery = query(
    collection(db, 'tenants'),
    where('slug', '==', normalizedSlug),
    limit(1)
  );

  const snapshot = await getDocs(tenantsQuery);

  if (snapshot.empty) {
    return null;
  }

  const documentItem = snapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function createTenant(data) {
  const payload = buildTenantCreatePayload(data);

  return addDoc(collection(db, 'tenants'), payload);
}

export async function updateTenant(tenantId, data) {
  const reference = doc(db, 'tenants', tenantId);
  const payload = buildTenantUpdatePayload(data);

  await updateDoc(reference, payload);
}
