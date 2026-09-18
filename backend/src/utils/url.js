import { config } from '../config/env.js';

export function getBackendUrl(req) {
  if (process.env.BACKEND_PUBLIC_URL) return process.env.BACKEND_PUBLIC_URL;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  if (req && req.get && req.get('host')) {
    const host = req.get('host');
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
      return `${proto}://${host}`;
    }
  }
  return config.backendPublicUrl;
}
