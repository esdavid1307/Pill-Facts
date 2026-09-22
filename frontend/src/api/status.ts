export type ServiceStatus = {
  status: string
}

/**
 * The backend is same-origin: the Vite dev server proxies /api, and nginx proxies it in
 * the built image. There is no API base URL in the frontend to configure.
 *
 * Deployment (#13) has to keep that true — ADR-0009 puts the frontend on Cloudflare
 * Pages and the backend on EC2, which needs a proxy route in front of /api rather than
 * a second origin here.
 */
export async function fetchStatus(): Promise<ServiceStatus> {
  const response = await fetch('/api/status')
  if (!response.ok) {
    throw new Error(`GET /api/status returned ${response.status}`)
  }
  return (await response.json()) as ServiceStatus
}
