import { AlertTriangle } from "lucide-react"

const categories = [
  {
    name: "Hazardous Materials",
    items: ["Flammable liquids", "Explosives", "Radioactive materials", "Toxic chemicals", "Compressed gases"],
  },
  {
    name: "Illegal Items",
    items: ["Controlled substances", "Counterfeit goods", "Stolen property", "Illegal weapons", "Smuggled items"],
  },
  {
    name: "Fragile/High-Value",
    items: ["Glassware (requires special handling)", "Fine art (requires special handling)", "Jewelry over $500", "Irreplaceable documents"],
  },
  {
    name: "Perishables",
    items: ["Unpackaged food", "Live animals", "Plants requiring permits", "Biological samples"],
  },
]

export default function ProhibitedItemsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-6">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <AlertTriangle className="h-5 w-5 text-foreground" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground text-balance">Prohibited Items</h1>
        </div>
        <p className="text-base text-muted-foreground text-pretty leading-relaxed max-w-2xl">
          The following items cannot be sent through GoDrop. Attempting to send prohibited items may result in account suspension and legal action.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {categories.map((cat) => (
          <div key={cat.name} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">{cat.name}</h2>
            <ul className="flex flex-col gap-2">
              {cat.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-2">Not Sure?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you are unsure whether your item is permitted, please contact our support team before booking a delivery.
        </p>
      </div>
    </div>
  )
}
