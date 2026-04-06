/**
 * Sanitize SVG content to remove XSS vectors.
 * Defense-in-depth: SVGs should be served with Content-Type: image/svg+xml,
 * but this strips dangerous elements as an additional safety layer.
 */
export function sanitizeSvg(svgText: string): string {
  return svgText
    // Remove <script> tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers (onclick, onload, onerror, etc.)
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Block javascript: URIs in href/xlink:href/src attributes
    .replace(/(href|src)\s*=\s*["']?\s*javascript\s*:/gi, '$1="blocked:')
    // Remove <foreignObject> which can embed arbitrary HTML
    .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '')
}
