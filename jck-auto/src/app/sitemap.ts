import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { readCatalogJson } from "@/lib/blobStorage";
import { mockCars } from "@/data/mockCars";

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
      priority: 0.9,
    },
    {
      url: "https://jckauto.ru/calculator",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
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
      priority: 0.7,
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
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const blogPages: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `https://jckauto.ru/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticPages, ...catalogPages, ...blogPages];
}
