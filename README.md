# Relish

Current implementation baseline: Stage 8.10.1 Dating single-sided voice Outcome pilot with the participant audit-link correction.

The canonical forward plan is `docs/stage8/STAGE8_9_MULTI_APP_RELATIONSHIP_INTELLIGENCE_ROADMAP.md`. It defines one domain-neutral Relish Core with isolated Business, Dating, Value Orchestration, Event Intelligence, and future app layers.

Stage 8.9 makes the existing Business ContextSpace explicit and isolated. Stage 8.10 adds a controlled Dating app shell, private voice reflection capture, a Dating-only Outcome Extractor, encrypted versioned proposals, and mandatory human review before an Outcome is created. Stage 8.11 remains gated on evidence from the Stage 8.10 pilot.

## Svelte project

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
