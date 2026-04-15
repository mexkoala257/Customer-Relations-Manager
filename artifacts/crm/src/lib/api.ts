import { setAuthTokenGetter } from "@workspace/api-client-react";

export function getToken(): string | null {
  return localStorage.getItem("crm_token");
}

export function setToken(token: string): void {
  localStorage.setItem("crm_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("crm_token");
}

export function setupApiAuth(): void {
  setAuthTokenGetter(() => getToken());
}
