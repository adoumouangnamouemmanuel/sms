import type { FastifyRequest } from 'fastify';
import { REFRESH_COOKIE_NAME } from './auth.constants.js';

export function readRefreshCookie(request: FastifyRequest) {
  const cookieHeader = readHeader(request.headers.cookie);

  if (!cookieHeader) {
    return undefined;
  }

  for (const cookiePart of cookieHeader.split(';')) {
    const [name, ...rawValueParts] = cookiePart.trim().split('=');

    if (name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(rawValueParts.join('='));
    }
  }

  return undefined;
}

/** Refresh cookies are httpOnly and scoped to auth routes; access tokens stay in memory. */
export function serializeRefreshCookie(value: string, options: { maxAgeSeconds: number }) {
  const encodedValue = encodeURIComponent(value);

  return [
    `${REFRESH_COOKIE_NAME}=${encodedValue}`,
    `Max-Age=${String(Math.max(0, Math.floor(options.maxAgeSeconds)))}`,
    'Path=/auth',
    'HttpOnly',
    'SameSite=Strict',
  ].join('; ');
}

export function readHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
