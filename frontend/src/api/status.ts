export type ServiceStatus = {
  status: string
}

/**
 * The backend is always same-origin: Vite proxies /api in dev, and the static host
 * proxies it in production. There is no API base URL to configure.
 */
export async function fetchStatus(): Promise<ServiceStatus> {
  const response = await fetch('/api/status')
  if (!response.ok) {
    throw new Error(`GET /api/status returned ${response.status}`)
  }
  return (await response.json()) as ServiceStatus
}
