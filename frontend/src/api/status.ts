export type ServiceStatus = {
  status: string
}

/**
 * The backend is same-origin everywhere: the Vite dev server proxies /api, nginx proxies
 * it in the built image, and a Pages Function proxies it in production. There is no API
 * base URL in the frontend to configure and no CORS anywhere. See ADR-0011.
 */
export async function fetchStatus(): Promise<ServiceStatus> {
  const response = await fetch('/api/status')
  if (!response.ok) {
    throw new Error(`GET /api/status returned ${response.status}`)
  }
  return (await response.json()) as ServiceStatus
}
