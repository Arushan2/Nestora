export type ApiResponse<T> = {
  message?: string;
  user?: T;
  authenticated?: boolean;
  application?: unknown;
  applications?: unknown[];
  listings?: unknown[];
  users?: unknown[];
};

async function safeJson<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();
  if (!text) {
    return { message: `Server error (${response.status}): empty response.` } as ApiResponse<T>;
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { message: `Server error (${response.status}): ${text.slice(0, 200)}` } as ApiResponse<T>;
  }
}

export async function requestJson<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await safeJson<T>(response);

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed.');
  }

  return data;
}

export async function requestForm<T>(path: string, form: FormData): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  const data = await safeJson<T>(response);

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed.');
  }

  return data;
}
