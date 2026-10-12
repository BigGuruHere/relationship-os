import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const allowedHosts = String(
		env.DEV_ALLOWED_HOSTS ||
			env.DEV_ALLOWED_HOST ||
			'creative-basilisk-painfully.ngrok-free.app'
	)
		.split(',')
		.map((host) => host.trim())
		.filter(Boolean);

	return {
		plugins: [sveltekit()],
		server: {
			// DEV ONLY: allow the configured ngrok host to forward browser and webhook traffic
			// to the local Vite server. This does not alter production host handling.
			allowedHosts
		}
	};
});
