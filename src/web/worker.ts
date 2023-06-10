// @ts-nocheck

self.addEventListener('install', async (ev: any) => {
	const cache = await caches.open('cache');
	await cache.addAll('/', '/dist/app.js', '/dist/app.css', '/data/entries.json');
	await self.skipWaiting();
	console.log('sw install');
});

self.addEventListener('activate', async (ev: any) => {
	await self.clients.claim();
	console.log('sw active');
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

self.addEventListener('fetch', async (ev: any) => {
	const req = ev.request;
	if (req.url.startsWith(self.location.origin)) await ev.respondWith((async () => {
		const url = new URL(req.url);
		const ex = await caches.match(req);
		const cache = await caches.open('cache');
		if (!ex) {
			const res = await fetch(req).catch(e => {
				// console.error(e);
				return null;
			});
			if (res?.ok) await cache.put(req, res.clone());
			return res;
		}
		if (ex && (url.pathname.startsWith('/data/') || url.pathname.startsWith('/dist/') || url.pathname == '/') || url.pathname.endsWith('.html')) {
			const fr = fetch(req).then(async res => {
				if (res.ok) await cache.put(req, res.clone());
				return res;
			}).catch(e => {
				// console.error(e);
				return null;
			});
			const res = await Promise.race([fr, sleep(2000)]);
			if (res?.ok) return res;
		}
		return ex ?? fetch(req);
	})().catch(e => {
		console.error(e);
		return fetch(req);
	}));
});

