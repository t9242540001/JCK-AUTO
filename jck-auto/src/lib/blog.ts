export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
}

export function getAllPosts(): BlogPost[] {
  // TODO: Replace with actual blog data source (MDX, CMS, etc.)
  return [];
}
