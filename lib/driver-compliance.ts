export type ComplianceDocument = { document_type: string; expires_on?: string | null; review_status?: string | null }
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
/** Keep this predicate aligned with the database driver_dispatch_sizes function. */
export function driverDocumentComplete(doc: ComplianceDocument, today = londonDate()) {
  return doc.review_status !== 'rejected' && driverDocumentValid(doc, today) &&
    (doc.document_type !== 'insurance' || !!doc.expires_on)
}

export function driverVerificationProgress(vehicles: { vehicle_type: string }[], documents: ComplianceDocument[], today = londonDate()) {
  const hasVehicle = vehicles.some(v => ['bicycle', 'motorcycle', 'car', 'van'].includes(v.vehicle_type))
  const required = requiredDriverDocuments(vehicles)
  const complete = required.filter(type => documents.some(d => d.document_type === type && driverDocumentComplete(d,today)))
  const completedSteps = complete.length + Number(hasVehicle)
  const totalSteps = required.length + 1
  return { hasVehicle, complete, completedSteps, totalSteps, percent: Math.round(100 * completedSteps / totalSteps), ready: completedSteps === totalSteps }
}
export function driverComplianceReady(vehicles: { vehicle_type: string }[], documents: ComplianceDocument[], today = londonDate()) {
  return driverVerificationProgress(vehicles, documents, today).ready
}

const documentLabels: Record<string, string> = {
  identity: 'photo ID', selfie: 'selfie', insurance: 'motor insurance', vehicle_registration: 'vehicle registration',
}

/** A missing motor document must never clear a motor vehicle or block a verified bicycle. */
export function driverDispatchReadiness<T extends { vehicle_type: string }>(
  vehicles: T[], documents: (ComplianceDocument & { review_status?: string | null })[], today = londonDate(),
) {
  const supported = vehicles.filter(v => ['bicycle', 'motorcycle', 'car', 'van'].includes(v.vehicle_type))
  const problems = (vehicle: T) => requiredDriverDocuments([vehicle]).flatMap(type => {
    const matches = documents.filter(d => d.document_type === type && d.review_status !== 'rejected')
    const label = documentLabels[type]
    if (matches.some(d => driverDocumentComplete(d,today))) return []
    if (!matches.length) return [`Upload a valid ${label} document`]
    if (type === 'insurance' && matches.some(d => !d.expires_on)) return ['Add the expiry date for your motor insurance']
    return [`Replace your expired ${label} document`]
  })
  const checked = supported.map(vehicle => ({ vehicle, problems: problems(vehicle) }))
  const eligible = checked.filter(row => row.problems.length === 0).map(row => row.vehicle)
  const issues = [...new Set(checked.flatMap(row => row.problems))]
  return { eligible, issues, message: !supported.length ? 'Register a bicycle, motorcycle, car or van on the Verification page.' : issues.length ? `${issues.join('. ')} on the Verification page.` : '' }
}
