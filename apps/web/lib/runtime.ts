/** Runtime (not build-time) settings. Read on every request. */
export function runtimeInfo() {
  return {
    apiUrl: process.env.API_URL ?? "http://localhost:8080",
    environment: process.env.DEPLOY_ENV ?? "local",
    cloud: process.env.CLOUD_PROVIDER ?? "local",
    version: process.env.SERVICE_VERSION ?? "dev",
  };
}
