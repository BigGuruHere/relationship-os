// Call only with a validated Google ID token. An external mailbox can change hands
// independently of the Google account, even when Google reports email_verified.
export function googleControlsMailbox(email: string, hostedDomain?: unknown): boolean {
	return email.endsWith('@gmail.com') ||
		(typeof hostedDomain === 'string' && hostedDomain.length > 0 &&
			email.slice(email.lastIndexOf('@') + 1) === hostedDomain.toLowerCase());
}
