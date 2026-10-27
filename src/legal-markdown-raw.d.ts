// Vite bundles checked-in .md policy files into the corresponding public routes.
declare module '*.md?raw' {
  const content: string;
  export default content;
}
