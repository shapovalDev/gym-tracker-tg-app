import type { Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { AppEnv } from './types';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Schema = z.ZodType | undefined;
type Out<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface RouteDef<B extends Schema, Q extends Schema> {
  method: Method;
  /** Hono-style path, e.g. /programs/:programId */
  path: string;
  summary: string;
  tag: string;
  description?: string;
  body?: B;
  query?: Q;
  /** Success status (default 200). 204 sends no body. */
  status?: ContentfulStatusCode | 204;
  /** Name of the response DTO in @gym/shared types (documentation only). */
  response?: string;
  /** Extra documented error statuses. */
  errors?: Record<number, string>;
  /** Defaults to true. */
  auth?: boolean;
}

export interface HandlerInput<B extends Schema, Q extends Schema> {
  body: Out<B>;
  query: Out<Q>;
  params: Record<string, string>;
  c: Context<AppEnv>;
}

interface Operation {
  method: Method;
  path: string;
  def: RouteDef<Schema, Schema>;
}

const uuidParam = z.uuid();

/**
 * Thin layer over Hono that validates input with Zod, runs the handler and
 * records each route so the OpenAPI document is generated from the same
 * definitions that enforce validation — the docs cannot drift from the code.
 */
export class ApiRouter {
  readonly operations: Operation[] = [];

  constructor(
    readonly app: Hono<AppEnv>,
    private readonly prefix: string,
  ) {}

  route<B extends Schema = undefined, Q extends Schema = undefined>(
    def: RouteDef<B, Q>,
    handler: (input: HandlerInput<B, Q>) => Promise<unknown> | unknown,
  ): void {
    this.operations.push({
      method: def.method,
      path: def.path,
      def: def as RouteDef<Schema, Schema>,
    });
    this.app.on(def.method.toUpperCase(), this.prefix + def.path, async (c) => {
      const params = c.req.param() as Record<string, string>;
      // Every path parameter in this API is a UUID.
      for (const value of Object.values(params)) uuidParam.parse(value);
      const query = def.query ? def.query.parse(c.req.query()) : undefined;
      let body: unknown = undefined;
      if (def.body) {
        let raw: unknown;
        try {
          raw = await c.req.json();
        } catch {
          raw = undefined;
        }
        body = def.body.parse(raw ?? {});
      }
      const result = await handler({ body, query, params, c } as HandlerInput<B, Q>);
      if (def.status === 204) return c.body(null, 204);
      // Without an explicit status the handler may choose one via c.status().
      return def.status ? c.json(result as object, def.status) : c.json(result as object);
    });
  }

  openApiDocument(info: { title: string; version: string; serverUrl: string }) {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const { method, path, def } of this.operations) {
      const oaPath = path.replace(/:(\w+)/g, '{$1}');
      const parameters: unknown[] = [...path.matchAll(/:(\w+)/g)].map((m) => ({
        name: m[1],
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      }));
      if (def.query) {
        const qs = z.toJSONSchema(def.query, { io: 'input', unrepresentable: 'any' }) as {
          properties?: Record<string, unknown>;
          required?: string[];
        };
        for (const [name, schema] of Object.entries(qs.properties ?? {})) {
          parameters.push({
            name,
            in: 'query',
            required: qs.required?.includes(name) ?? false,
            schema,
          });
        }
      }
      const status = String(def.status ?? 200);
      const responses: Record<string, unknown> = {
        [status]:
          status === '204'
            ? { description: 'No content' }
            : {
                description: def.response
                  ? `\`${def.response}\` (see packages/shared/src/types.ts)`
                  : 'OK',
                content: { 'application/json': { schema: { type: 'object' } } },
              },
        ...(def.body || parameters.length
          ? { '400': { $ref: '#/components/responses/ValidationError' } }
          : {}),
        ...(def.auth === false ? {} : { '401': { $ref: '#/components/responses/Unauthorized' } }),
      };
      for (const [code, description] of Object.entries(def.errors ?? {})) {
        responses[code] = {
          description,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        };
      }
      paths[oaPath] ??= {};
      paths[oaPath][method] = {
        tags: [def.tag],
        summary: def.summary,
        ...(def.description ? { description: def.description } : {}),
        ...(def.auth === false ? { security: [] } : {}),
        parameters,
        ...(def.body
          ? {
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: z.toJSONSchema(def.body, { io: 'input', unrepresentable: 'any' }),
                  },
                },
              },
            }
          : {}),
        responses,
      };
    }
    const errorSchema = {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
        },
      },
    };
    const errorResponse = (description: string) => ({
      description,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    });
    return {
      openapi: '3.1.0',
      info: {
        title: info.title,
        version: info.version,
        description:
          'Authenticate every protected request with the header `Authorization: tma <Telegram.WebApp.initData>`. ' +
          'The server verifies the HMAC signature with the bot token. Errors use `{ error: { code, message, details? } }`.',
      },
      servers: [{ url: info.serverUrl }],
      security: [{ TelegramInitData: [] }],
      components: {
        securitySchemes: {
          TelegramInitData: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: 'tma <initData>',
          },
        },
        schemas: { Error: errorSchema },
        responses: {
          ValidationError: errorResponse('Invalid input (code VALIDATION_ERROR)'),
          Unauthorized: errorResponse('Missing or invalid Telegram initData (code UNAUTHORIZED)'),
        },
      },
      paths,
    };
  }
}
