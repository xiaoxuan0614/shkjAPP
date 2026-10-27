/** Only the deployment root is a default entry; never replace business deep links. */
export function isRootEntry(location: { pathname: string; hash: string }, base = '/'): boolean {
  const root = `/${base.split('/').filter(Boolean).join('/')}`.replace(/\/$/, '')
  const path = location.pathname.replace(/\/$/, '')
  const hashPath = location.hash.replace(/^#/, '').split('?')[0]
  return (path === root || path === `${root}/index.html`) && (!hashPath || hashPath === '/')
}
