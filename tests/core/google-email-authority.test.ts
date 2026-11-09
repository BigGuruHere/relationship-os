import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { googleControlsMailbox } from '../../src/lib/server/googleEmailAuthority';

test('only Gmail and a matching validated Workspace domain establish Google mailbox authority', () => {
	assert.equal(googleControlsMailbox('user@gmail.com'), true);
	assert.equal(googleControlsMailbox('user@company.example', 'company.example'), true);
	assert.equal(googleControlsMailbox('user@company.example'), false);
	assert.equal(googleControlsMailbox('user@company.example', 'different.example'), false);
	assert.equal(googleControlsMailbox('user@notgmail.com'), false);
});
