import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildVcardUrl } from '../../src/lib/publicProfile';
import { GET } from '../../src/routes/api/vcard/+server';

test('phone download keeps the Relish link and adds only public web links', async () => {
	const origin = 'https://app.relish.live';
	const path = buildVcardUrl({
		displayName: 'Example',
		websiteUrl: 'https://example.test',
		publicMeta: {
			linkedin: 'https://linkedin.com/in/example',
			twitter: '@example',
			extras: [{ label: 'Safe', value: 'Calendar', href: 'https://example.test/calendar' }]
		}
	}, origin + '/u/example');
	const url = new URL(path, origin);
	url.searchParams.append('url', 'javascript:alert(1)');
	url.searchParams.append('url', 'https://example.test\r\nTEL:fake');
	const response = await GET({ url, locals: { appOrigin: origin } } as Parameters<typeof GET>[0]);
	const card = await response.text();
	assert.deepEqual(card.split('\r\n').filter(line => line.startsWith('URL:')), [
		'URL:https://app.relish.live/u/example',
		'URL:https://example.test/',
		'URL:https://www.linkedin.com/in/example',
		'URL:https://example.test/calendar',
		'URL:https://x.com/example'
	]);
	assert.doesNotMatch(card, /fake|javascript/);
});
