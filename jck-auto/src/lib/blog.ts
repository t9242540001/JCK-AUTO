import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  country: string;
  image: string;
  tags: string[];
  readingTime: string;
  content: string;
};

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));

  const posts = files.map((filename) => {
    const slug = filename.replace(/\.mdx$/, "");
    const filePath = path.join(BLOG_DIR, filename);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);
    const rt = readingTime(content);

    return {
      slug,
      title: data.title ?? "",
      description: data.description ?? "",
      date: data.date ?? "",
      author: data.author ?? "",
      country: data.country ?? "",
      image: data.image ?? "",
      tags: (data.tags as string[]) ?? [],
      readingTime: rt.text,
      content,
    };
  });

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);
  const rt = readingTime(content);

  return {
    slug,
    title: data.title ?? "",
    description: data.description ?? "",
    date: data.date ?? "",
    author: data.author ?? "",
    country: data.country ?? "",
    image: data.image ?? "",
    tags: (data.tags as string[]) ?? [],
    readingTime: rt.text,
    content,
  };
}
