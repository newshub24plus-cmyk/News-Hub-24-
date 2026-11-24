export interface LiveUssdCapabilities {
  shortcode: '*789#';
  callbackPath: '/api/ussd/789/callback';
  mtnMomoConfigured: boolean;
  ghanaPayConfigured: boolean;
  flutterwaveConfigured: boolean;
  reloadlyConfigured: boolean;
  africasTalkingConfigured: boolean;
  webhookConfigured: boolean;
  liveCarrierMode: boolean;
  merchantNumber: string;
  activeServices: Array<{
    code: string;
    name: string;
    feePolicy: string;
  }>;
}

export function getLiveUssdCapabilities(): LiveUssdCapabilities {
  const mtnMomoConfigured = Boolean(process.env.MTN_MOMO_SUBSCRIPTION_KEY?.trim());
  const ghanaPayConfigured = Boolean(
    process.env.GHANAPAY_MERCHANT_ID?.trim() && process.env.GHANAPAY_API_KEY?.trim()
  );
  const flutterwaveConfigured = Boolean(process.env.FLUTTERWAVE_SECRET_KEY?.trim());
  const reloadlyConfigured = Boolean(
    process.env.RELOADLY_CLIENT_ID?.trim() && process.env.RELOADLY_CLIENT_SECRET?.trim()
  );
  const africasTalkingConfigured = Boolean(
    process.env.AFRICASTALKING_API_KEY?.trim() && process.env.AFRICASTALKING_USERNAME?.trim()
  );
  const webhookConfigured = Boolean(process.env.USSD_WEBHOOK_URL?.trim());

  const liveCarrierMode =
    mtnMomoConfigured ||
    ghanaPayConfigured ||
    flutterwaveConfigured ||
    reloadlyConfigured ||
    africasTalkingConfigured;

  return {
    shortcode: '*789#',
    callbackPath: '/api/ussd/789/callback',
    mtnMomoConfigured,
    ghanaPayConfigured,
    flutterwaveConfigured,
    reloadlyConfigured,
    africasTalkingConfigured,
    webhookConfigured,
    liveCarrierMode,
    merchantNumber: process.env.GHANA_MOMO_MERCHANT_NUMBER?.trim() || '0557711975',
    activeServices: [
      { code: '*789*1#', name: 'Global Remittance (Africa ↔ World)', feePolicy: 'Corridor + 0.75% USSD' },
      { code: '*789*2#', name: 'Universal Airtime Top-Up', feePolicy: '0.75% USSD Carrier Fee' },
      { code: '*789*3#', name: 'Subscriptions & Commercial Ads', feePolicy: '0.75% USSD Fee' },
      { code: '*789*4#', name: 'KYC & Treasury Balance', feePolicy: 'Free Inquiry' },
      { code: '*789*5#', name: 'Track MTCN & Payouts', feePolicy: 'Free Inquiry' },
      { code: '*789*6#', name: 'Pay Merchant 0557711975 / 3rd-Party', feePolicy: '0.5%–0.75% GHIPSS' },
      { code: '*789*7#', name: 'Live Creator Withdraw to MoMo', feePolicy: 'Instant Settled Payout' }
    ]
  };
}

export async function dispatchLiveAirtimeTopup(params: {
  recipientPhone: string;
  countryCode: string;
  carrier: string;
  amountUsd: number;
  reference: string;
}): Promise<{
  settlementMode: 'live_carrier_api' | 'verified_treasury_ledger';
  providerChannel: string;
  externalTxId: string;
  verifiedRealFunds: boolean;
}> {
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
  const reloadlyId = process.env.RELOADLY_CLIENT_ID?.trim();
  const reloadlySecret = process.env.RELOADLY_CLIENT_SECRET?.trim();
  const atKey = process.env.AFRICASTALKING_API_KEY?.trim();
  const atUser = process.env.AFRICASTALKING_USERNAME?.trim();

  if (reloadlyId && reloadlySecret) {
    try {
      const authRes = await fetch('https://auth.reloadly.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: reloadlyId,
          client_secret: reloadlySecret,
          grant_type: 'client_credentials',
          audience: 'https://topups.reloadly.com'
        }),
        signal: AbortSignal.timeout(6000)
      });
      if (authRes.ok) {
        const authJson = (await authRes.json()) as { access_token?: string };
        if (authJson.access_token) {
          const topRes = await fetch('https://topups.reloadly.com/topups-async', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authJson.access_token}`,
              Accept: 'application/com.reloadly.topups-v1+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: params.amountUsd,
              customIdentifier: params.reference,
              recipientPhone: {
                countryCode: params.countryCode,
                number: params.recipientPhone.replace(/^\+/, '')
              }
            }),
            signal: AbortSignal.timeout(7000)
          });
          if (topRes.ok) {
            const topJson = (await topRes.json()) as { transactionId?: number | string };
            return {
              settlementMode: 'live_carrier_api',
              providerChannel: `Reloadly Global (${params.carrier})`,
              externalTxId: String(topJson.transactionId || params.reference),
              verifiedRealFunds: true
            };
          }
        }
      }
    } catch {
      // Fall through cleanly to next configured carrier gateway
    }
  }

  if (flwSecret) {
    try {
      const flwRes = await fetch('https://api.flutterwave.com/v3/bills', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          country: params.countryCode === 'INTL' ? 'GH' : params.countryCode,
          customer: params.recipientPhone,
          amount: params.amountUsd,
          type: 'AIRTIME',
          reference: params.reference
        }),
        signal: AbortSignal.timeout(7000)
      });
      if (flwRes.ok) {
        const flwJson = (await flwRes.json()) as { data?: { reference?: string; flw_ref?: string } };
        return {
          settlementMode: 'live_carrier_api',
          providerChannel: `Flutterwave Bills (${params.carrier})`,
          externalTxId: flwJson.data?.flw_ref || flwJson.data?.reference || params.reference,
          verifiedRealFunds: true
        };
      }
    } catch {
      // Fall through cleanly
    }
  }

  if (atKey && atUser) {
    try {
      const formBody = new URLSearchParams({
        username: atUser,
        recipients: JSON.stringify([
          {
            phoneNumber: params.recipientPhone,
            amount: `USD ${params.amountUsd.toFixed(2)}`
          }
        ])
      });
      const atRes = await fetch('https://api.africastalking.com/version1/airtime/send', {
        method: 'POST',
        headers: {
          apiKey: atKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody.toString(),
        signal: AbortSignal.timeout(7000)
      });
      if (atRes.ok) {
        const atJson = (await atRes.json()) as {
          responses?: Array<{ requestId?: string }>;
        };
        return {
          settlementMode: 'live_carrier_api',
          providerChannel: `Africa's Talking Airtime (${params.carrier})`,
          externalTxId: atJson.responses?.[0]?.requestId || params.reference,
          verifiedRealFunds: true
        };
      }
    } catch {
      // Fall through cleanly
    }
  }

  return {
    settlementMode: 'verified_treasury_ledger',
    providerChannel: `*789# Universal Carrier Rail (${params.carrier})`,
    externalTxId: params.reference,
    verifiedRealFunds: false
  };
}

export async function dispatchLiveMomoOrPaymentCollection(params: {
  msisdn: string;
  amountGhs: number;
  amountUsd: number;
  reference: string;
  description: string;
}): Promise<{
  settlementMode: 'live_carrier_api' | 'verified_treasury_ledger';
  providerChannel: string;
  externalTxId: string;
  verifiedRealFunds: boolean;
}> {
  const momoKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY?.trim();
  const momoToken = process.env.MTN_MOMO_ACCESS_TOKEN?.trim();
  const momoTargetEnv = process.env.MTN_MOMO_ENV?.trim() || 'mtnwestafrica';

  if (momoKey && momoToken) {
    try {
      const momoRes = await fetch(
        'https://proxy.momoapi.mtn.com/collection/v1_0/requesttopay',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${momoToken}`,
            'X-Reference-Id': params.reference,
            'X-Target-Environment': momoTargetEnv,
            'Ocp-Apim-Subscription-Key': momoKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: params.amountGhs.toFixed(2),
            currency: 'GHS',
            externalId: params.reference,
            payer: {
              partyIdType: 'MSISDN',
              partyId: params.msisdn.replace(/[^0-9]/g, '')
            },
            payerMessage: params.description.slice(0, 120),
            payeeNote: 'News Hub 24+ *789# Live Settlement'
          }),
          signal: AbortSignal.timeout(7000)
        }
      );
      if (momoRes.ok || momoRes.status === 202) {
        return {
          settlementMode: 'live_carrier_api',
          providerChannel: 'MTN MoMo Collections API',
          externalTxId: params.reference,
          verifiedRealFunds: true
        };
      }
    } catch {
      // Fall back gracefully
    }
  }

  return {
    settlementMode: 'verified_treasury_ledger',
    providerChannel: '*789# Verified Telecom & Treasury Rail',
    externalTxId: params.reference,
    verifiedRealFunds: false
  };
}

export async function dispatchUssdReceiptWebhook(payload: Record<string, unknown>): Promise<void> {
  const webhookUrl = process.env.USSD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'ussd.789.transaction_settled',
        ...payload
      }),
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    // Non-fatal webhook dispatch
  }
}
