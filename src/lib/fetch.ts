import {z} from 'zod';
import {Url} from '@grogarden/gro/paths.js';
import type {Flavored} from '@grogarden/util/types.js';

import type {Logger} from './log.js';
import {EMPTY_OBJECT} from './object.js';
import type {Result} from './result.js';

const DEFAULT_GITHUB_API_ACCEPT_HEADER = 'application/vnd.github+json';
const DEFAULT_GITHUB_API_VERSION_HEADER = '2022-11-28';

export interface Fetch_Value_Options<
	T_Schema extends z.ZodTypeAny | undefined = undefined,
	T_Params = undefined,
> {
	/**
	 * The `request.headers` take precedence over the headers computed from other options.
	 */
	request?: RequestInit;
	params?: T_Params;
	schema?: T_Schema;
	token?: string;
	cache?: Fetch_Cache_Data;
	return_early_from_cache?: boolean; // TODO name?
	log?: Logger;
	fetch?: typeof globalThis.fetch;
}

/*

caching behaviors

- gro: return early by url, update the cache from the result
- orc: always make request, send etag/last_modified, return cached if 304
- fuz_mastodon: return early by url, and don't update the cache, is a caller concern

*/

/**
 * Specializes `fetch` with some slightly different behavior and additional features:
 *
 * - throws on ratelimit errors to mitigate unintentional abuse
 * - optional Zod schema parsing of the return value
 * - optional cache (different from the browser cache,
 * 	 the caller can serialize it so e.g. dev setups can avoid hitting the network)
 * - optional simplified API for authorization and data types
 *   (you can still provide headers directly)
 *
 * Unlike `fetch`, this throws on ratelimits (status code 429)
 * to halt whatever is happpening in its tracks to avoid accidental abuse,
 * but returns a `Result` in all other cases.
 * Handling ratelimit headers with more sophistication gets tricky because behavior
 * differs across services.
 * (e.g. Mastodon returns an ISO string for `x-ratelimit-reset`,
 * but GitHub returns `Date.now()/1000`,
 * and other services may do whatever, or even use a different header)
 *
 * It's also stateless to avoid the complexity and bugs,
 * so we don't try to track `x-ratelimit-remaining` per domain.
 */
export const fetch_value = async <
	T_Schema extends z.ZodTypeAny | undefined = undefined,
	T_Params = undefined,
>(
	url: string | URL,
	options?: Fetch_Value_Options<T_Schema, T_Params>,
): Promise<Result<T_Schema, {status: number; message: string}>> => {
	const {
		request,
		params,
		schema,
		token,
		cache,
		return_early_from_cache,
		log,
		fetch = globalThis.fetch,
	} = options ?? EMPTY_OBJECT;

	const url_obj = typeof url === 'string' ? new URL(url) : url;

	const method = request?.method ?? (params ? 'POST' : 'GET');

	// local cache?
	let cached;
	let key;
	if (cache) {
		key = to_fetch_cache_key(url_obj.href, params, method);
		cached = cache?.get(key);
		if (return_early_from_cache && cached) {
			log?.info('[fetch_value] cached', cached);
			return Promise.resolve(cached.data);
		}
	}

	const headers = new Headers(request?.headers);
	add_accept_header(headers, url_obj);
	if (token && !headers.has('authorization')) {
		headers.set('authorization', 'Bearer ' + token);
	}
	const etag = cached?.etag;
	if (etag && !headers.has('if-none-match')) {
		headers.set('if-none-match', etag);
	} else {
		// fall back to last-modified, ignoring if there's an etag
		const last_modified = cached?.last_modified;
		if (last_modified && !headers.has('if-modified-since')) {
			headers.set('if-modified-since', last_modified);
		}
	}

	const body =
		request?.body ?? (method === 'GET' || method === 'HEAD' ? null : JSON.stringify(params || {}));

	const req = new Request(url_obj, {...request, headers, method, body});

	log?.info('[fetch_value] fetching url with headers', url, print_headers(headers));
	const res = await fetch(req); // don't catch network errors
	log?.info('[fetch_value] fetched res', url, res);

	const h = Object.fromEntries(res.headers.entries());
	log?.info('[fetch_value] fetched headers', url, h);

	// throw on ratelimit
	if (res.status === 429) {
		throw Error('ratelimited exceeded fetching url ' + url);
	}

	if (!res.ok) {
		return {ok: false, status: res.status, message: res.statusText};
	}

	if (res.status === 304) {
		if (!cached) throw Error('unexpected 304 status without a cached value');
		return cached.data;
	}

	const content_type = res.headers.get('content-type');

	const fetched = await (!content_type || content_type.includes('json') ? res.json() : res.text()); // TODO hacky

	const parsed = schema ? schema.parse(fetched) : fetched;
	log?.info('[fetch_value] fetched json', url, parsed);

	if (cache) {
		const result: Fetch_Cache_Item = {
			key: key!, // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
			url: url_obj.href,
			params,
			data: parsed,
			etag: res.headers.get('etag'),
			last_modified: res.headers.get('etag') ? null : res.headers.get('last-modified'), // fall back to last-modified, ignoring if there's an etag
		};
		cache.set(result.key, result);
	}

	return parsed;
};

const add_accept_header = (headers: Headers, url: URL): void => {
	if (!headers.has('accept')) {
		const accept =
			url.hostname === 'api.github.com' ? DEFAULT_GITHUB_API_ACCEPT_HEADER : 'application/json';
		if (accept) headers.set('accept', accept);
	}
	if (
		headers.get('accept') === DEFAULT_GITHUB_API_ACCEPT_HEADER &&
		!headers.has('x-github-api-version')
	) {
		headers.set('x-github-api-version', DEFAULT_GITHUB_API_VERSION_HEADER);
	}
};

const print_headers = (headers: Headers): Record<string, string> => {
	const h = Object.fromEntries(headers.entries());
	if (h.authorization) h.authorization = '[REDACTED]';
	return h;
};

export interface Fetch_Cache {
	name: string;
	data: Fetch_Cache_Data; // TODO probably expose an API for this instead of passing the map directly
	/**
	 * @returns a boolean indicating if anything changed, returns `false` if it was a no-op
	 */
	save: () => Promise<boolean>;
}

export const Fetch_Cache_Key = z.string();
export type Fetch_Cache_Key = Flavored<z.infer<typeof Fetch_Cache_Key>, 'Fetch_Cache_Key'>;

export type Fetch_Cache_Data = Map<Fetch_Cache_Key, Fetch_Cache_Item>;

export const Fetch_Cache_Item = z.object({
	key: Fetch_Cache_Key,
	url: Url,
	params: z.any(),
	data: z.any(),
	etag: z.string().nullable(),
	last_modified: z.string().nullable(),
});
// TODO use `z.infer<typeof Fetch_Cache_Item>`, how with generic?
export interface Fetch_Cache_Item<T_Data = any, T_Params = any> {
	key: Fetch_Cache_Key;
	url: Url;
	params: T_Params;
	data: T_Data;
	etag: string | null;
	last_modified: string | null;
}

export const CACHE_KEY_SEPARATOR = '::';

// TODO canonical form to serialize the params, start by sorting object keys
export const to_fetch_cache_key = (url: Url, params: any, method: string): Fetch_Cache_Key =>
	method + CACHE_KEY_SEPARATOR + url + CACHE_KEY_SEPARATOR + JSON.stringify(params);

export const serialize_cache = (cache: Fetch_Cache_Data): string =>
	JSON.stringify(Array.from(cache.values()));

// TODO generic serialization, these are just maps
export const deserialize_cache = (serialized: string): Fetch_Cache_Data => {
	// TODO maybe take a `data_schema` param and `Fetch_Cache_Item.extend({data: data_schema}).parse(...)`
	const parsed: Fetch_Cache_Item[] = JSON.parse(serialized).map((v: any) =>
		Fetch_Cache_Item.parse(v),
	);
	return new Map(parsed.map((v) => [v.key, v]));
};
