# Relish

Current implementation baseline: Stage 8.9 multi-app ContextSpace boundary.

The canonical forward plan is `docs/stage8/STAGE8_9_MULTI_APP_RELATIONSHIP_INTELLIGENCE_ROADMAP.md`. It defines one domain-neutral Relish Core with isolated Business, Dating, Value Orchestration, Event Intelligence, and future app layers.

Stage 8.9 makes the existing Business ContextSpace explicit, adds controlled Dating ContextSpace creation and selection, binds agents to allowed application domains, and introduces metadata-only audit logging for sensitive agent runs. Stage 8.10 is the next planned product stage.

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
