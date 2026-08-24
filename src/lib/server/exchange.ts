// src/lib/server/exchange.ts
// PURPOSE: Legacy compatibility wrapper. ExchangeItem is now legacy-only for UI writes.
// Stage 7.3 writes and reads first-class Offer records for supply-side items.

import { createOfferFromForm, deleteOffer, loadOffers, type OfferEntityLink } from '$lib/server/offers';

export type ExchangeEntityLink = OfferEntityLink;

export async function createExchangeItemFromForm(params: {
  userId: string;
  form: FormData;
  links: ExchangeEntityLink;
}) {
  const source = params.form;
  const form = new FormData();
  for (const [key, value] of source.entries()) form.set(key, value);
  if (!form.get('offerTitle') && source.get('exchangeTitle')) form.set('offerTitle', source.get('exchangeTitle') as string);
  if (!form.get('offerDescription') && source.get('exchangeDescription')) form.set('offerDescription', source.get('exchangeDescription') as string);
  if (!form.get('offerSummary') && source.get('exchangeSummary')) form.set('offerSummary', source.get('exchangeSummary') as string);
  if (!form.get('offerType')) form.set('offerType', 'GENERAL');
  if (!form.get('direction')) form.set('direction', 'OFFERING');
  return createOfferFromForm({ userId: params.userId, form, links: params.links });
}

export async function loadExchangeItems(params: {
  userId: string;
  links: ExchangeEntityLink;
  take?: number;
}) {
  const offers = await loadOffers({ userId: params.userId, links: params.links, take: params.take });
  return offers.map((offer: any) => ({
    ...offer,
    type: 'OFFER',
    typeLabel: 'Offer',
    exchangeItemId: offer.exchangeItemId
  }));
}

export async function deleteExchangeItem(params: { userId: string; id: string; links: ExchangeEntityLink }) {
  return deleteOffer({ userId: params.userId, id: params.id, links: params.links });
}
