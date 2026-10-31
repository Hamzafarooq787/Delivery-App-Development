export type ComplianceDocument = { document_type: string; expires_on?: string | null }
export function requiredDriverDocuments(vehicles: { vehicle_type: string }[]) {
  return vehicles.some(v => v.vehicle_type !== 'bicycle')
    ? ['identity', 'selfie', 'insurance', 'vehicle_registration']
    : ['identity', 'selfie']
}
export function londonDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function driverDocumentValid(doc: ComplianceDocument, today = londonDate()) {
  return !doc.expires_on || doc.expires_on >= today
}
export function driverComplianceReady(vehicles: { vehicle_type: string }[], documents: ComplianceDocument[], today = londonDate()) {
  return vehicles.length > 0 && requiredDriverDocuments(vehicles).every(type => documents.some(d =>
    d.document_type === type && driverDocumentValid(d, today) && (type !== 'insurance' || !!d.expires_on)))
}
