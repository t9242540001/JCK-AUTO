import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { mockCars } from "@/data/mockCars";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: "https://jckauto.ru",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://jckauto.ru/catalog",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://jckauto.ru/calculator",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://jckauto.ru/about",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://jckauto.ru/blog",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const catalogPages: MetadataRoute.Sitemap = mockCars.map((car) => ({
    url: `https://jckauto.ru/catalog/${car.id}`,
    lastModified: new Date(car.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const blogPages: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `https://jckauto.ru/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...catalogPages, ...blogPages];
}
