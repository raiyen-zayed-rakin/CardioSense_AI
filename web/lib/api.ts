const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
};

export type Patient = {
  id: number;
  full_name: string;
  mrn: string;
  age: number | null;
  notes: string | null;
  consent: boolean;
  risk_band: string;
  created_at?: string | null;
};

export type PatientCreate = {
  full_name: string;
  mrn: string;
  age?: number | null;
  notes?: string | null;
  consent?: boolean;
};

export type ReplayStart = {
  session_id: number;
  record: string;
  fs: number;
  n_samples: number;
  duration_s: number;
  ws_path: string;
};

export type Health = {
  status: string;
  model_ready: boolean;
  model_version: string | null;
};

export type AlertItem = {
  id: number;
  session_id: number;
  patient_id: number;
  rule_id: string;
  tier: string;
  title: string;
  message: string;
  status: string;
  t: number;
  created_at?: string | null;
};

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((d: { msg?: string; loc?: unknown[] }) => d.msg ?? JSON.stringify(d))
        .join("; ");
    }
  } catch {
    /* plain text */
  }
  return text || res.statusText;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const tokens = (await res.json()) as TokenPair;
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    refreshPromise ??= tryRefresh().finally(() => {
      refreshPromise = null;
    });
    const ok = await refreshPromise;
    if (ok) return request<T>(path, init, false);
  }

  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type GuestSession = TokenPair & {
  patient_id: number;
  record: string;
  mode: string;
};

export function saveTokens(tokens: TokenPair) {
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
  localStorage.setItem("cs_mode", "clinician");
  localStorage.removeItem("guest_patient_id");
}

export function saveGuestSession(session: GuestSession) {
  localStorage.setItem("access_token", session.access_token);
  localStorage.setItem("refresh_token", session.refresh_token);
  localStorage.setItem("cs_mode", "guest");
  localStorage.setItem("guest_patient_id", String(session.patient_id));
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("cs_mode");
  localStorage.removeItem("guest_patient_id");
}

export const api = {
  base: API_BASE,
  health: () => request<Health>("/health"),
  register: (body: { email: string; password: string; full_name: string; role?: string }) =>
    request<User>("/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (email: string, password: string) =>
    request<TokenPair>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  guest: () => request<GuestSession>("/v1/auth/guest", { method: "POST", body: "{}" }),
  refresh: (refresh_token: string) =>
    request<TokenPair>("/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),
  me: () => request<User>("/v1/auth/me"),
  patients: () => request<Patient[]>("/v1/patients"),
  getPatient: (id: number) => request<Patient>(`/v1/patients/${id}`),
  patientAlerts: (id: number) => request<AlertItem[]>(`/v1/patients/${id}/alerts`),
  createPatient: (body: PatientCreate) =>
    request<Patient>("/v1/patients", { method: "POST", body: JSON.stringify(body) }),
  startReplay: (patient_id: number, record: string, speed = 1) =>
    request<ReplayStart>("/v1/demo/replay", {
      method: "POST",
      body: JSON.stringify({ patient_id, record, speed }),
    }),
  wsUrl: (wsPath: string, token: string) => {
    const base = API_BASE.replace(/^http/, "ws");
    return `${base}${wsPath}?token=${encodeURIComponent(token)}`;
  },
  assistantSuggestions: (page?: string) =>
    request<AssistantSuggestion[]>(
      `/v1/assistant/suggestions${page ? `?page=${encodeURIComponent(page)}` : ""}`,
    ),
  assistantChatStream: async (
    body: {
      message: string;
      page?: string;
      history?: { role: string; content: string }[];
    },
    handlers: {
      onToken: (text: string) => void;
      onReplace?: (text: string) => void;
      onDone?: (source?: string) => void;
    },
  ) => {
    const run = async (retry: boolean): Promise<void> => {
      const res = await fetch(`${API_BASE}/v1/assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401 && retry) {
        refreshPromise ??= tryRefresh().finally(() => {
          refreshPromise = null;
        });
        const ok = await refreshPromise;
        if (ok) return run(false);
      }
      if (!res.ok) throw new Error(await parseError(res));
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim()) as {
              type: string;
              text?: string;
              source?: string;
            };
            if (payload.type === "token" && payload.text) handlers.onToken(payload.text);
            if (payload.type === "replace" && payload.text) handlers.onReplace?.(payload.text);
            if (payload.type === "done") handlers.onDone?.(payload.source);
          } catch {
            /* ignore partial JSON */
          }
        }
      }
    };
    await run(true);
  },
};

export type AssistantSuggestion = { id: string; label: string };
