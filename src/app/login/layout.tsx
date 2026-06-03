// Force the login route to render dynamically so Next does NOT statically
// prerender it. A prerendered /login is stamped with `Cache-Control:
// s-maxage=31536000` and relies on `Vary: rsc` to keep the HTML document and
// the RSC/Flight payload apart. Cloudflare (in front of the DO app) ignores
// `Vary: rsc`, so a router prefetch can poison the shared cache with the RSC
// variant and serve it as the document — the browser then renders the raw RSC
// stream as text. Dynamic rendering emits `no-store`, keeping /login off every
// cache layer. The page itself is a client component, so this directive lives
// in a server-component layout wrapper.
export const dynamic = "force-dynamic";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
