import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { readCatalogJson } from "@/lib/blobStorage";
import { mockCars } from "@/data/mockCars";
import { getAllNewsDays, getAllTags } from "@/services/news/reader";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
      priority: 0.8,
    },
    {
      url: "https://jckauto.ru/tools",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://jckauto.ru/tools/calculator",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://jckauto.ru/tools/customs",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://jckauto.ru/tools/auction-sheet",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://jckauto.ru/tools/encar",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://jckauto.ru/about",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "https://jckauto.ru/blog",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: "https://jckauto.ru/privacy",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://jckauto.ru/terms",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  let cars = await readCatalogJson();
  if (cars.length === 0) {
    cars = mockCars;
  }

  const catalogPages: MetadataRoute.Sitemap = cars.map((car) => ({
    url: `https://jckauto.ru/catalog/${car.id}`,
    lastModified: new Date(car.createdAt),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const blogPages: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `https://jckauto.ru/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // News pages
  const newsIndex: MetadataRoute.Sitemap = [
    {
      url: "https://jckauto.ru/news",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  const newsTagPages: MetadataRoute.Sitemap = getAllTags().map((tag) => ({
    url: `https://jckauto.ru/news/tag/${tag}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  const newsDayPages: MetadataRoute.Sitemap = getAllNewsDays().map((day) => ({
    url: `https://jckauto.ru/news/${day.slug}`,
    lastModified: new Date(day.date),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...catalogPages, ...blogPages, ...newsIndex, ...newsTagPages, ...newsDayPages];
}
