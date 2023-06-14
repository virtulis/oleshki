// @ts-nocheck

import * as Sentry from '@sentry/browser';

Sentry.init({
	dsn: 'https://c8db0755be1f40308040c159a57facf4@o306148.ingest.sentry.io/4505333290631168',
});

self.addEventListener('install', async (ev: any) => {
	self.skipWaiting();
	console.log('sw install');
});

self.addEventListener('activate', async (ev: any) => {
	await self.clients.claim();
	console.log('sw active');
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

self.addEventListener('fetch', async (ev: any) => {
	const req = ev.request;
	if (req.url.startsWith(self.location.origin) && req.method == 'GET') await ev.respondWith((async () => {
	
		const url = new URL(req.url);
		const ex = await caches.match(req);
		const cache = await caches.open('cache');
		
		if (!ex) {
			const res = await fetch(req).catch(e => {
				console.error(e);
				return null;
			});
			if (res?.ok) await cache.put(req, res.clone());
			return res;
		}
		
		if (
			url.pathname.startsWith('/data/')
			|| url.pathname.startsWith('/dist/')
			|| url.pathname == '/'
			|| url.pathname.endsWith('.html')
		) {
			url.searchParams.set('t', Date.now());
			const fr = fetch(url).then(async res => {
				if (res.ok) await cache.put(req, res.clone());
				return res;
			}).catch(e => {
				console.error(e);
				return null;
			});
			const res = await Promise.race([fr, sleep(5000)]);
			if (res?.ok || res?.status == 401 || res?.status == 403) return res;
		}
		
		return ex ?? fetch(req);
		
	})().catch(e => {
		console.error(e);
		return fetch(req);
	}));
});

