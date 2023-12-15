import {z} from 'zod';
import {Url} from '@grogarden/gro/paths.js';
import type {Flavored} from '@grogarden/util/types.js';

import type {Logger} from './log.js';
import {EMPTY_OBJECT} from './object.js';
import {wait} from './async.js';
import type {Result} from './result.js';
import {Unreachable_Error} from './error.js';

let ratelimit_remaining: number | null = null;
let ratelimit_reset: Date | null = null;

const RETRY_DELAY = 1000 * 60 * 2; // TODO exponential backoff
const CACHE_NETWORK_DELAY = 0; // set this to like 1000 to see how the animations behave

// TODO BLOCK should we cache the data parsed or raw? I think it's a little more convenient to have it be raw, but at what cost/complexity? means you also need the schema to lookup
// TODO BLOCK replace `fetch_json`, `fetch_data`, and `github_fetch_commit_prs`

export interface Fetch_Options<T_Schema extends z.ZodTypeAny | undefined = undefined> {
	schema?: T_Schema;
	type?: Fetch_Type;
	accept?: string;
	cache?: Fetch_Cache_Data; // TODO BLOCK Mastodon_Cache
	log?: Logger;
}

export type Fetch_Type = 'json' | 'text' | 'html'; // TODO arrayBuffer()/ArrayBuffer, blob()/Blob, formData()/FormData

// TODO refactor with `fetch_github_pull_requests`
export const fetch_json = async <T_Schema extends z.ZodTypeAny | undefined = undefined>(
	url: string,
	options?: Fetch_Options<T_Schema>,
): Promise<Fetch_Cache_Item<T_Schema | null>> => {
	const {schema, cache, log} = options || EMPTY_OBJECT;
	const headers: Record<string, string> = {
		'content-type': 'application/json',
		accept: 'application/json',
	};
	const key = to_fetch_cache_key(url, null);
	const cached = cache?.get(key);
	const etag = cached?.etag;
	if (etag) {
		headers['if-none-match'] = etag;
	}
	const last_modified = cached?.last_modified;
	if (last_modified) {
		headers['if-modified-since'] = last_modified;
	}
	try {
		const res = await fetch(url, {headers}); // TODO handle `retry-after` @see https://docs.github.com/en/rest/guides/best-practices-for-using-the-rest-api
		if (res.status === 304) {
			return cached;
		}
		const fetched = await res.json();
		const parsed = schema ? schema.parse(fetched) : fetched;
		const result: Fetch_Cache_Item = {
			url,
			params: null,
			key,
			etag: res.headers.get('etag'),
			last_modified: res.headers.get('last-modified'),
			data: parsed, // TODO BLOCK store raw result, or parsed? currently mismatched
		};
		cache?.set(result.key, result);
		return result;
	} catch (err) {
		const result: Fetch_Cache_Item<T_Schema | null> = {
			url,
			params: null,
			key,
			etag: null,
			last_modified: null,
			data: null,
		}; // TODO better error
		return result;
	}
};

export const fetch_data = async <T_Schema extends z.ZodTypeAny | undefined = undefined>(
	url: string,
	options?: Fetch_Options<T_Schema>,
): Promise<Result<T_Schema, {status: number; message: string}>> => {
	const {schema, type = 'json', accept, cache, log} = options ?? EMPTY_OBJECT;

	// local cache?
	const cached = cache?.get(url);
	if (cached) {
		log?.info('[fetch_data] cached', cached);
		if (CACHE_NETWORK_DELAY) await wait(CACHE_NETWORK_DELAY);
		return Promise.resolve(cached.data);
	}

	// rate limiting
	log?.info('[fetch_data] ratelimit status', {ratelimit_remaining, ratelimit_reset});
	if (ratelimit_reset && (!ratelimit_remaining || ratelimit_remaining < 1)) {
		if (new Date() > ratelimit_reset) {
			ratelimit_reset = null; // reset the ratelimit
		} else {
			return {ok: false, status: 429, message: 'rate limited'};
		}
	}

	const headers: Record<string, string> = {
		accept: accept ?? to_accept_header(url, type),
		// TODO BLOCK include this? if not get? or just let it be assumed?
		// 'content-type': 'application/json',
	};
	if (token) {
		headers.authorization = 'Bearer ' + token;
	}
	const key = to_fetch_cache_key(url, null);
	const cached = cache?.get(key);
	const etag = cached?.etag;
	if (etag) {
		headers['if-none-match'] = etag;
	}
	const last_modified = cached?.last_modified;
	if (last_modified) {
		headers['if-modified-since'] = last_modified;
	}

	let res: Response;
	try {
		log?.info('[fetch_data] fetching url with headers', url, headers);
		res = await fetch(url, {headers});
		log?.info('[fetch_data] fetched res', url, res);
	} catch (err) {
		return {ok: false, status: 500, message: 'network error'};
	}

	const h = Object.fromEntries(res.headers.entries());
	log?.info('[fetch_data] fetched headers', url, h);

	// rate limiting
	if ('x-ratelimit-remaining' in h || 'x-ratelimit-reset' in h) {
		// might be out of order, so use `Math.min`
		ratelimit_remaining = Math.min(
			Number(h['x-ratelimit-remaining']) || -1,
			ratelimit_remaining ?? Infinity,
		);
		const updated_ratelimit_reset = new Date(h['x-ratelimit-reset'] || Date.now() + RETRY_DELAY);
		// might be out of order, this is like `Math.max` without coercing
		if (!ratelimit_reset || ratelimit_reset < updated_ratelimit_reset) {
			ratelimit_reset = updated_ratelimit_reset;
		}
		log?.info('[fetch_data] ratelimit status updated', url, {
			ratelimit_remaining,
			ratelimit_reset,
		});
	} else if (res.status === 429) {
		// manual ratelimiting for a 429
		ratelimit_remaining = 0;
		const updated_ratelimit_reset = new Date(Date.now() + RETRY_DELAY);
		if (!ratelimit_reset || ratelimit_reset < updated_ratelimit_reset) {
			ratelimit_reset = updated_ratelimit_reset;
		}
	}

	if (!res.ok) {
		return {ok: false, status: res.status, message: res.statusText};
	}

	const fetched = await res.json(); // TODO BLOCK support text too
	const parsed = schema ? schema.parse(fetched) : fetched;
	log?.info('[fetch_data] fetched json', url, parsed);
	// responses.push({url, data: parsed}); // TODO history

	const result: Fetch_Cache_Item = {
		url,
		params: null, // TODO BLOCK method, body (rename params->body probably)
		key,
		etag: res.headers.get('etag'),
		last_modified: res.headers.get('last-modified'),
		data: parsed, // TODO BLOCK store raw result, or parsed? currently mismatched
	};
	cache?.set(result.key, result);

	return parsed;
};

const to_accept_header = (url: string, type: Fetch_Type): string => {
	if (type === 'html') {
		return 'text/html';
	} else if (type === 'text') {
		return 'text/plain';
	} else if (type === 'json') {
		if (is_github_url(url)) {
			return 'application/vnd.github+json';
		} else {
			return 'application/json';
		}
	}
	throw new Unreachable_Error(type);
};

const is_github_url = (url: string): boolean => {
	const {hostname} = new URL(url);
	return hostname === 'github.com' || hostname.endsWith('.github.com');
};

/**
 *@see https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#list-pull-requests-associated-with-a-commit
 */
export const github_fetch_commit_prs = async (
	owner: string,
	repo: string,
	commit_sha: string,
	token?: string,
	log?: Logger,
	cache?: Record<string, any>,
): Promise<Github_Pull_Request[] | undefined> => {
	const url = `https://api.github.com/repos/${owner}/${repo}/commits/${commit_sha}/pulls`;

	// TODO BLOCK use fetch_data/json from this url

	if (cache) {
		const cached: Github_Pull_Request[] | undefined = cache[url];
		if (cached) {
			return schema ? schema.parse(cached) : cached;
		}
	}

	const headers: Record<string, string> = {accept: 'application/vnd.github+json'};
	if (token) {
		headers.authorization = 'Bearer ' + token;
	}

	const res = await fetch(url, {headers});

	const fetched = await res.json();

	if (cache) cache[url] = fetched;

	const parsed = schema ? schema.parse(fetched) : fetched;

	return parsed;
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
	url: Url,
	params: z.any(), // TODO object | null?
	key: Fetch_Cache_Key,
	etag: z.string().nullable(),
	data: z.any(), // TODO type?
});
// TODO use `z.infer<typeof Fetch_Cache_Item>`, how with generic?
export interface Fetch_Cache_Item<T_Data = any, T_Params = any> {
	url: Url;
	params: T_Params;
	key: Fetch_Cache_Key;
	etag: string | null;
	last_modified: string | null;
	data: T_Data;
}

export const CACHE_KEY_SEPARATOR = '::';

// TODO canonical form to serialize params, start by sorting object keys
export const to_fetch_cache_key = (url: Url, params: any, method = 'get'): Fetch_Cache_Key =>
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
