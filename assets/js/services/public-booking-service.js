export async function listPublicServicesByTenant(tenantId) {
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