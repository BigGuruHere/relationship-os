// tailwind.config.cjs
// PURPOSE:
// - Tell Tailwind where to find your templates so it can tree-shake CSS
// - Keep the default theme - we can extend later if needed

module.exports = {
    content: [
      "./src/**/*.{html,js,svelte,ts}"  // scan SvelteKit source files
    ],
    theme: {
      extend: {}                         // add custom tokens here if needed
    },
    plugins: []                          // add forms/typography later if we want
  };
  