export type ApiResponse<T> = {
  message?: string;
  user?: T;
  authenticated?: boolean;
  application?: unknown;
  applications?: unknown[];
  listings?: unknown[];
};

export async function requestJson<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as ApiResponse<T>;

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

  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed.');
  }

  return data;
}
