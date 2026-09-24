import axios from 'axios';

// Always points to the master backend — the single source of truth for tenant config lookups.
// Never use this for business API calls — use apiClient from client.ts for those.
const CENTRAL_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const centralClient = axios.create({
  baseURL: CENTRAL_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export interface TenantConfig {
  apiUrl: string;
  status: 'active' | 'inactive' | 'suspended';
  companyName: string;
  appName: string;
  primaryColor: string;
  logoUrl: string | null;
}

export async function fetchTenantConfig(slug: string): Promise<TenantConfig> {
  const { data } = await centralClient.get(`/config/tenant/${encodeURIComponent(slug)}`);
  return data.data as TenantConfig;
}
