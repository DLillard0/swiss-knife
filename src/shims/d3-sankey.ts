/**
 * Shim for `d3-sankey`.
 *
 * Why: `mermaid` v11 can import `d3-sankey`, but this repo doesn't depend on it.
 * In a pnpm workspace, missing optional/peer deps will cause Vite/Rollup build to fail.
 *
 * This shim is enough to satisfy the bundler. If Sankey diagrams are actually used at runtime,
 * we throw a clear error so it's easy to fix by adding the real dependency.
 */
type AnyFn = (...args: any[]) => any;

function missing(name: string): never {
  throw new Error(
    `[swiss-knife] Missing dependency: "${name}". ` +
      `Sankey diagrams require "d3-sankey". ` +
      `Please add it to dependencies and reinstall (pnpm add d3-sankey).`
  );
}

// Mermaid uses: d3Sankey().nodeId(...).nodeWidth(...).nodePadding(...).nodeAlign(...).extent(...); sankey(graph)
export const sankey: AnyFn = () => {
  missing("d3-sankey");
};

export const sankeyLinkHorizontal: AnyFn = () => {
  missing("d3-sankey");
};

export const sankeyLeft: AnyFn = () => {
  missing("d3-sankey");
};

export const sankeyRight: AnyFn = () => {
  missing("d3-sankey");
};

export const sankeyCenter: AnyFn = () => {
  missing("d3-sankey");
};

export const sankeyJustify: AnyFn = () => {
  missing("d3-sankey");
};

