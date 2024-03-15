//
// TODO: wouter basepath option not playing nicely with gh pages
//
export function getPath (path: string): string {
  const base = import.meta.env.PROD ? '/dust-ts' : ''
  return base + path
}
