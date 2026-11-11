// The upstream plugin assumes every content route has a docs sidebar.
// Supply a Blog section only to its metadata extractor, without changing navigation.
module.exports = function llmsTxt(context, options) {
  const upstream = require('docusaurus-plugin-llms-txt').default(context, options);
  return {
    ...upstream,
    async postBuild(args) {
      const mapRoutes = routes => routes.map(route => ({
        ...route,
        ...(route.path.startsWith('/blog/') && route.metadata?.sourceFilePath
          ? { sidebar: 'llmsBlog' } : {}),
        ...(route.routes ? { routes: mapRoutes(route.routes) } : {}),
      }));
      const navbar = args.siteConfig.themeConfig.navbar;
      return upstream.postBuild({
        ...args,
        routes: mapRoutes(args.routes),
        siteConfig: {
          ...args.siteConfig,
          themeConfig: {
            ...args.siteConfig.themeConfig,
            navbar: { ...navbar, items: [...navbar.items, { sidebarId: 'llmsBlog', label: 'Blog' }] },
          },
        },
      });
    },
  };
};
