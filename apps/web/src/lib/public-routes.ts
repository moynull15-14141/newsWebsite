export const publicArticleRoutes = {
  tag: (slug: string) => `/public/tags/${encodeURIComponent(slug)}/articles`,
  author: (id: string) => `/public/authors/${encodeURIComponent(id)}/articles`,
  location: (slug: string) => `/public/locations/${encodeURIComponent(slug)}/articles`,
};
