"use client"

import { useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { googlePlacesAutocomplete, googlePlaceCoords, type PlaceSuggestion } from "@/lib/google"
import {
  createShoppingRequest,
  getShoppingQuote,
  type ShoppingItem,
  type ShoppingQuote,
} from "@/app/actions/shopping"
import type { CreateShoppingRequestParams } from "@/app/actions/shopping"

type Step = 1 | 2 | 3 | 4

type PlaceResult = { address: string; lat: number; lng: number }

type ItemFormState = ShoppingItem & { id: string }

function newItem(): ItemFormState {
  return {
    id: Math.random().toString(36).slice(2),
    name: "",
    quantity: 1,
    estimated_price: null,
    brand_size_variant: null,
    notes: null,
    photo_url: null,
    substitution_preference: "contact_me",
  }
}

function fmt(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v)
}

export function NewShoppingRequestModal({
  onClose,
}: {
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ id: string; tracking_number: string } | null>(null)

  // Step 1: Shop + delivery
  const [shopName, setShopName] = useState("")
  const [shopAddress, setShopAddress] = useState<PlaceResult | null>(null)
  const [shopInstructions, setShopInstructions] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState<PlaceResult | null>(null)

  // Autocomplete state
  const [shopSuggestions, setShopSuggestions] = useState<PlaceSuggestion[]>([])
  const [deliverySuggestions, setDeliverySuggestions] = useState<PlaceSuggestion[]>([])
  const [shopInput, setShopInput] = useState("")
  const [deliveryInput, setDeliveryInput] = useState("")

  // Step 2: Shopping list
  const [items, setItems] = useState<ItemFormState[]>([newItem()])

  // Step 3: Quote
  const [quote, setQuote] = useState<ShoppingQuote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)

  const shopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deliveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleShopInput = useCallback((v: string) => {
    setShopInput(v)
    setShopAddress(null)
    if (shopTimerRef.current) clearTimeout(shopTimerRef.current)
    if (v.length < 3) { setShopSuggestions([]); return }
    shopTimerRef.current = setTimeout(async () => {
      const res = await googlePlacesAutocomplete(v, {})
      setShopSuggestions(res ?? [])
    }, 350)
  }, [])

  const handleDeliveryInput = useCallback((v: string) => {
    setDeliveryInput(v)
    setDeliveryAddress(null)
    if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current)
    if (v.length < 3) { setDeliverySuggestions([]); return }
    deliveryTimerRef.current = setTimeout(async () => {
      const res = await googlePlacesAutocomplete(v, {})
      setDeliverySuggestions(res ?? [])
    }, 350)
  }, [])

  const selectShopPlace = useCallback(async (sugg: PlaceSuggestion) => {
    setShopInput(sugg.text)
    setShopSuggestions([])
    const coords = await googlePlaceCoords(sugg.placeId)
    if (coords) setShopAddress({ address: sugg.text, lat: coords.lat, lng: coords.lng })
  }, [])

  const selectDeliveryPlace = useCallback(async (sugg: PlaceSuggestion) => {
    setDeliveryInput(sugg.text)
    setDeliverySuggestions([])
    const coords = await googlePlaceCoords(sugg.placeId)
    if (coords) setDeliveryAddress({ address: sugg.text, lat: coords.lat, lng: coords.lng })
  }, [])

  // Step 1 → Step 2
  const handleStep1Next = () => {
    if (!shopName.trim()) { setError("Please enter the shop name."); return }
    if (!shopAddress) { setError("Please select the shop address."); return }
    if (!deliveryAddress) { setError("Please select your delivery address."); return }
    setError(null)
    setStep(2)
  }

  // Step 2 → Step 3
  const handleStep2Next = async () => {
    const validItems = items.filter((i) => i.name.trim())
    if (!validItems.length) { setError("Please add at least one item."); return }
    setError(null)
    setStep(3)
    setLoadingQuote(true)
    const estimatedTotal = items.reduce((s, i) => s + (i.estimated_price ?? 0) * i.quantity, 0)
    const result = await getShoppingQuote({
      shop_lat: shopAddress!.lat,
      shop_lng: shopAddress!.lng,
      delivery_lat: deliveryAddress!.lat,
      delivery_lng: deliveryAddress!.lng,
      estimated_items_total: estimatedTotal,
    })
    setLoadingQuote(false)
    if ("error" in result) { setError(result.error); return }
    setQuote(result.data)
  }

  // Final submit
  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const validItems = items.filter((i) => i.name.trim())

    const params: CreateShoppingRequestParams = {
      shop_name: shopName.trim(),
      shop_address: shopAddress!.address,
      shop_lat: shopAddress!.lat,
      shop_lng: shopAddress!.lng,
      shop_instructions: shopInstructions.trim() || null,
      delivery_address: deliveryAddress!.address,
      delivery_lat: deliveryAddress!.lat,
      delivery_lng: deliveryAddress!.lng,
      shopping_items: validItems.map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity,
        estimated_price: i.estimated_price,
        brand_size_variant: i.brand_size_variant || null,
        notes: i.notes || null,
        photo_url: i.photo_url || null,
        substitution_preference: i.substitution_preference,
      })),
    }

    const result = await createShoppingRequest(params)
    setSubmitting(false)

    if ("error" in result) {
      setError(result.error)
      return
    }
    setSuccessData(result.data)
    setStep(4)
  }

  const addItem = () => setItems((prev) => [...prev, newItem()])
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))
  const updateItem = (id: string, field: keyof ItemFormState, value: unknown) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))

  const estimatedTotal = items.reduce((s, i) => s + (i.estimated_price ?? 0) * i.quantity, 0)

  // Photo upload
  const handleItemPhoto = useCallback(async (id: string, file: File) => {
    const supabase = createClient()
    const path = `bfm-items/${Date.now()}-${file.name.replace(/\s+/g, "_")}`
    const { error: upErr } = await supabase.storage.from("delivery-item-photos").upload(path, file, { upsert: true })
    if (upErr) return
    const { data: { publicUrl } } = supabase.storage.from("delivery-item-photos").getPublicUrl(path)
    updateItem(id, "photo_url", publicUrl)
  }, [])

  const inputCls =
    "w-full bg-[#201f1f] border border-[#494847]/20 rounded-xl px-4 py-3 text-white text-sm placeholder-[#494847] outline-none focus:border-[var(--color-primary)]/40 focus:ring-1 focus:ring-[var(--color-primary)]/10 transition-all"

  const labelCls = "block text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl max-h-[95svh] overflow-y-auto bg-[#131313] sm:rounded-2xl border border-[#494847]/20 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#131313] px-5 pt-5 pb-4 border-b border-[#494847]/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🛍️</span>
              <h2 className="text-base font-bold text-white font-headline">Buy for Me</h2>
            </div>
            <p className="text-[10px] text-[#adaaaa] mt-0.5">Step {step} of 4</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1a1919] text-[#adaaaa] hover:text-white transition-colors">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 py-3 flex gap-1.5">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full flex-1 transition-all ${s <= step ? "bg-[var(--color-primary)]" : "bg-[#494847]/30"}`}
            />
          ))}
        </div>

        <div className="px-5 pb-6 flex-1">
          {/* ── Step 1: Shop Details ── */}
          {step === 1 && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">Shop Details</h3>
                <p className="text-xs text-[#adaaaa]">Tell us where to shop and where to deliver.</p>
              </div>

              <div>
                <label className={labelCls}>Shop Name</label>
                <input
                  type="text"
                  placeholder="e.g. Tesco, Boots, Sainsbury's"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="relative">
                <label className={labelCls}>Shop Address</label>
                <input
                  type="text"
                  placeholder="Start typing the shop address…"
                  value={shopInput}
                  onChange={(e) => handleShopInput(e.target.value)}
                  className={inputCls}
                />
                {shopAddress && (
                  <span className="absolute right-3 top-9 material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                )}
                {shopSuggestions.length > 0 && (
                  <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1a1919] border border-[#494847]/20 rounded-xl overflow-hidden shadow-xl">
                    {shopSuggestions.map((s) => (
                      <li key={s.placeId}>
                        <button
                          type="button"
                          onClick={() => selectShopPlace(s)}
                          className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[#262626] transition-colors"
                        >
                          {s.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className={labelCls}>Shop Instructions (optional)</label>
                <textarea
                  placeholder="e.g. Use the main entrance, ask for the manager if needed"
                  value={shopInstructions}
                  onChange={(e) => setShopInstructions(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="relative">
                <label className={labelCls}>Delivery Address</label>
                <input
                  type="text"
                  placeholder="Start typing your address…"
                  value={deliveryInput}
                  onChange={(e) => handleDeliveryInput(e.target.value)}
                  className={inputCls}
                />
                {deliveryAddress && (
                  <span className="absolute right-3 top-9 material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                )}
                {deliverySuggestions.length > 0 && (
                  <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1a1919] border border-[#494847]/20 rounded-xl overflow-hidden shadow-xl">
                    {deliverySuggestions.map((s) => (
                      <li key={s.placeId}>
                        <button
                          type="button"
                          onClick={() => selectDeliveryPlace(s)}
                          className="w-full text-left px-4 py-3 text-sm text-white hover:bg-[#262626] transition-colors"
                        >
                          {s.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="button"
                onClick={handleStep1Next}
                className="w-full py-3.5 bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold rounded-xl text-sm hover:brightness-110 transition-all"
              >
                Next: Add Items
              </button>
            </div>
          )}

          {/* ── Step 2: Shopping List ── */}
          {step === 2 && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">Shopping List</h3>
                <p className="text-xs text-[#adaaaa]">Add the items you need. Estimates help us set a spending limit.</p>
              </div>

              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.id} className="bg-[#1a1919] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#adaaaa] uppercase tracking-widest">Item {idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-[#adaaaa] hover:text-red-400 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Item name (e.g. Whole milk 2L)"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      className={inputCls}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Quantity</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Est. price (£)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={item.estimated_price ?? ""}
                          onChange={(e) => updateItem(item.id, "estimated_price", parseFloat(e.target.value) || null)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Brand, size or variant (optional)"
                      value={item.brand_size_variant ?? ""}
                      onChange={(e) => updateItem(item.id, "brand_size_variant", e.target.value || null)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder="Instructions or notes (optional)"
                      value={item.notes ?? ""}
                      onChange={(e) => updateItem(item.id, "notes", e.target.value || null)}
                      className={inputCls}
                    />
                    <div>
                      <label className={labelCls}>If unavailable</label>
                      <select
                        value={item.substitution_preference}
                        onChange={(e) => updateItem(item.id, "substitution_preference", e.target.value)}
                        className={inputCls}
                      >
                        <option value="contact_me">Contact me before substituting</option>
                        <option value="best_alternative">Use best alternative</option>
                        <option value="skip_if_unavailable">Skip if unavailable</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Item photo (optional)</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className={`${inputCls} flex items-center gap-2 cursor-pointer`}>
                          <span className="material-symbols-outlined text-[#adaaaa] text-base">add_photo_alternate</span>
                          <span className="text-[#adaaaa]">
                            {item.photo_url ? "Photo added ✓" : "Upload a photo"}
                          </span>
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleItemPhoto(item.id, f)
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addItem}
                className="w-full py-3 bg-[#1a1919] border border-dashed border-[#494847]/30 rounded-xl text-sm text-[#adaaaa] hover:text-white hover:border-[var(--color-primary)]/30 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add Another Item
              </button>

              {estimatedTotal > 0 && (
                <div className="bg-[#1a1919] rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-[#adaaaa]">Estimated shopping total</span>
                  <span className="text-white font-bold">{fmt(estimatedTotal)}</span>
                </div>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setError(null); setStep(1) }}
                  className="py-3 bg-[#1a1919] text-white rounded-xl text-sm font-semibold border border-[#494847]/20 hover:bg-[#262626] transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep2Next}
                  className="py-3 bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold rounded-xl text-sm hover:brightness-110 transition-all"
                >
                  Review &amp; Pay
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review & Pricing ── */}
          {step === 3 && (
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">Review &amp; Pricing</h3>
                <p className="text-xs text-[#adaaaa]">Check your order before confirming payment.</p>
              </div>

              <div className="bg-[#1a1919] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-[var(--color-secondary)] text-base mt-0.5">storefront</span>
                  <div>
                    <p className="font-semibold text-white">{shopName}</p>
                    <p className="text-[#adaaaa] text-xs">{shopAddress?.address}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-[var(--color-primary)] text-base mt-0.5">location_on</span>
                  <p className="text-[#adaaaa] text-xs">{deliveryAddress?.address}</p>
                </div>
              </div>

              <div className="bg-[#1a1919] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#adaaaa] mb-3">Shopping List</p>
                <ul className="space-y-2">
                  {items.filter((i) => i.name.trim()).map((item) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span className="text-white">{item.quantity}× {item.name}</span>
                      <span className="text-[#adaaaa]">
                        {item.estimated_price ? fmt(item.estimated_price * item.quantity) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {loadingQuote ? (
                <div className="bg-[#1a1919] rounded-xl p-4 text-center text-sm text-[#adaaaa]">
                  Calculating fees…
                </div>
              ) : quote ? (
                <div className="bg-[#1a1919] rounded-xl p-4 space-y-2 text-sm">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[#adaaaa] mb-3">Payment Breakdown</p>
                  <div className="flex justify-between">
                    <span className="text-[#adaaaa]">Delivery fee</span>
                    <span className="text-white">{fmt(quote.deliveryFee)}</span>
                  </div>
                  {quote.serviceFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#adaaaa]">Service fee</span>
                      <span className="text-white">{fmt(quote.serviceFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#adaaaa]">Shopping funds (held)</span>
                    <span className="text-white">{fmt(quote.itemsHold)}</span>
                  </div>
                  <div className="border-t border-[#494847]/20 pt-2 flex justify-between font-bold">
                    <span className="text-white">Total charged now</span>
                    <span className="text-[var(--color-primary)] text-base">{fmt(quote.totalCharge)}</span>
                  </div>
                  <p className="text-[10px] text-[#adaaaa] pt-1 leading-relaxed">
                    Shopping funds (up to {fmt(quote.maxSpendLimit)}) are held from your wallet. Any unspent amount is returned after purchase. The final shopping cost may differ from your estimates.
                  </p>
                  {quote.promoCodeError && (
                    <p className="text-xs text-amber-400">{quote.promoCodeError}</p>
                  )}
                </div>
              ) : null}

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setError(null); setStep(2) }}
                  className="py-3 bg-[#1a1919] text-white rounded-xl text-sm font-semibold border border-[#494847]/20 hover:bg-[#262626] transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={loadingQuote || submitting || !quote}
                  onClick={handleSubmit}
                  className="py-3 bg-[var(--color-secondary)] text-[var(--color-on-secondary)] font-bold rounded-xl text-sm hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {submitting ? "Booking…" : "Confirm & Pay"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Confirmation ── */}
          {step === 4 && successData && (
            <div className="space-y-6 pt-4 text-center">
              <div className="w-16 h-16 bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-emerald-400 text-3xl">check_circle</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Shopping Request Confirmed!</h3>
                <p className="text-sm text-[#adaaaa]">A driver will be assigned to your order shortly.</p>
              </div>
              <div className="bg-[#1a1919] rounded-xl p-4 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#adaaaa]">Reference</span>
                  <span className="text-white font-mono font-bold">{successData.tracking_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#adaaaa]">Shop</span>
                  <span className="text-white">{shopName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#adaaaa]">Items</span>
                  <span className="text-white">{items.filter((i) => i.name.trim()).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#adaaaa]">Status</span>
                  <span className="text-[var(--color-primary)] font-bold uppercase">Requested</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold rounded-xl text-sm hover:brightness-110 transition-all"
              >
                Track My Order
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

