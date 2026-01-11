import { z } from 'zod';
import { scripts } from './schema';

export const errorSchemas = {
  notFound: z.object({
    message: z.string(),
  }),
};

export const api = {
  scripts: {
    list: {
      method: 'GET' as const,
      path: '/api/scripts',
      responses: {
        200: z.array(z.custom<typeof scripts.$inferSelect>()),
      },
    },
    all: {
      method: 'GET' as const,
      path: '/api/scripts/all',
      responses: {
        200: z.array(z.custom<typeof scripts.$inferSelect>()),
      },
    },
    download: {
      method: 'GET' as const,
      path: '/api/scripts/:id/download',
      responses: {
        200: z.string(), // Returns file content directly
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
