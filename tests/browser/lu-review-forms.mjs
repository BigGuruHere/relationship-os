// Exercise the real review component and native forms with the disposable LUR fixture.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

export async function reviewBrowser(vite, route, owner) {
	const require = createRequire(import.meta.url);
	const { chromium } = require(process.env.RELISH_TEST_PLAYWRIGHT_PATH || 'playwright');
	const file = 'src/routes/people/[id]/notes/[noteId]/review/ConversationLuReview.svelte';
	const source = (await readFile(file, 'utf8'))
		.replace("import { enhance } from '$app/forms';", 'const enhance = () => {};');
	const compiled = compile(source, { filename: file, generate: 'server' });
	await mkdir('.svelte-kit/browser-check', { recursive: true });
	await writeFile('.svelte-kit/browser-check/lu-review.js', compiled.js.code);
	const component = (await vite.ssrLoadModule('/.svelte-kit/browser-check/lu-review.js')).default;
	const server = createServer(async (incoming, response) => {
		try {
			const url = new URL(incoming.url, origin);
			const [, , id, , noteId] = url.pathname.split('/');
			const event = {
				locals: owner, url, params: { id, noteId },
				setHeaders: (headers) => {
					for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
				}
			};
			let form;
			if (incoming.method === 'POST') {
				const action = [...url.searchParams.keys()].find((key) => key.startsWith('/'));
				let body = '';
				for await (const part of incoming) body += part;
				const request = new Request(url, {
					method: 'POST', headers: { origin: incoming.headers.origin }, body: new URLSearchParams(body)
				});
				const result = await route.actions[action.slice(1)]({ ...event, request });
				response.statusCode = result.status ?? 200;
				form = result.data ?? result;
			}
			const data = await route.load(event);
			response.setHeader('content-type', 'text/html; charset=utf-8');
			response.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">' +
				'<style>' + (compiled.css?.code ?? '') + '</style>' + render(component, { props: { data, form } }).body);
		} catch (cause) {
			response.statusCode = cause.status ?? 500;
			if (cause.location) response.setHeader('location', cause.location);
			response.end(cause.body?.message ?? (cause.status ? '' : String(cause)));
		}
	});
	await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
	const origin = 'http://127.0.0.1:' + server.address().port;
	process.env.APP_ORIGIN_DEV = origin;
	try {
		const browser = await chromium.launch({ executablePath: process.env.RELISH_TEST_CHROMIUM });
		const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
		return {
			page, origin,
			async close() {
				try { await browser.close(); } finally { await new Promise((done) => server.close(done)); }
			}
		};
	} catch (cause) {
		await new Promise((done) => server.close(done));
		throw cause;
	}
}
