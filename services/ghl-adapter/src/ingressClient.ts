import type { GhlAppointmentEvent } from "./mapAppointment.js";

export interface ResolvedAdapterBinding {
  bindingId: string;
  secretResource: string;
  reconcileMode?: "pull" | "webhook_only";
  providerConfig?: { calendarId?: string };
}

export interface IngressSubmitResult {
  status: number;
  replayed: boolean;
  code?: string;
}

export interface IngressClient {
  resolveBinding(provider: string, externalAccountId: string): Promise<ResolvedAdapterBinding | null>;
  submitEvent(event: GhlAppointmentEvent & { receipt: { contentType: string; inlineBase64: string } }): Promise<IngressSubmitResult>;
}

export function createHttpIngressClient(options: {
  fetchImpl: typeof fetch;
  origin: string;
  authorization: string;
}): IngressClient {
  return {
    async resolveBinding(provider, externalAccountId) {
      const url = new URL("/v1/ingress/bindings:resolve", options.origin);
      url.searchParams.set("provider", provider);
      url.searchParams.set("externalAccountId", externalAccountId);
      const response = await options.fetchImpl(url, {
        headers: { authorization: options.authorization },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`ingress resolve failed (${response.status})`);
      const body = (await response.json()) as ResolvedAdapterBinding;
      return {
        bindingId: body.bindingId,
        secretResource: body.secretResource,
        reconcileMode: body.reconcileMode,
        providerConfig: body.providerConfig,
      };
    },
    async submitEvent(event) {
      const response = await options.fetchImpl(new URL("/v1/ingress/events", options.origin), {
        method: "POST",
        headers: {
          authorization: options.authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify(event),
      });
      const text = await response.text();
      const body = text ? (JSON.parse(text) as { replayed?: boolean; error?: { code?: string } }) : {};
      return {
        status: response.status,
        replayed: body.replayed === true,
        code: body.error?.code,
      };
    },
  };
}

export function honoFetch(app: { request: (input: string, init?: RequestInit) => Response | Promise<Response> }): typeof fetch {
  return (async (input, init) => {
    const url = new URL(String(input));
    return app.request(`${url.pathname}${url.search}`, init);
  }) as typeof fetch;
}
