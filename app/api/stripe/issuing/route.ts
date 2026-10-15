import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_ISSUING_WEBHOOK_SECRET,
    signature = request.headers.get('stripe-signature')
  if (!secret || !signature)
    return NextResponse.json({ approved: false }, { status: 400 })
  try {
    const event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    )
    const headers = {
      'Stripe-Version': event.api_version ?? '2025-03-31.basil',
    }
    if (event.type !== 'issuing_authorization.request')
      return NextResponse.json({ received: true })
    if (process.env.GODROP_SHOPPING_FUNDING_READY !== 'true')
      return NextResponse.json({ approved: false }, { headers })
    const auth = event.data.object
    const card =
      typeof auth.card === 'string'
        ? await getStripe().issuing.cards.retrieve(auth.card)
        : auth.card
    const delivery = card.metadata?.active_delivery_id
    // Shopping transactions must be initial GBP authorizations. A timeout is configured to decline in Stripe.
    if (
      !delivery ||
      card.status !== 'active' ||
      auth.currency !== 'gbp' ||
      auth.amount !== 0 ||
      !auth.pending_request
    )
      return NextResponse.json({ approved: false }, { headers })
    const amount = auth.pending_request.amount / 100
    const { data: approved, error } = await createAdminClient().rpc(
      'reserve_shopping_card_purchase',
      {
        p_delivery: delivery,
        p_card: card.id,
        p_authorization: auth.id,
        p_amount: amount,
      },
    )
    return NextResponse.json(
      {
        approved: !error && approved === true,
        metadata: { delivery_id: delivery },
      },
      { headers },
    )
  } catch {
    return NextResponse.json({ approved: false }, { status: 400 })
  }
}
