import { calculateCustomerStatsFromAppointments } from './appointment-service.js';
import { updateCustomerStats } from './customer-service.js';

export async function syncCustomerStats(customerId) {
  if (!customerId) {
    return;
  }

  const stats = await calculateCustomerStatsFromAppointments(customerId);
  await updateCustomerStats(customerId, stats);
}