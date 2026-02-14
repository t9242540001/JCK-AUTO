export default function JsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "JCK AUTO",
    description: "Импорт автомобилей из Китая, Кореи и Японии под ключ",
    url: "https://jckauto.ru",
    telephone: "+7-914-732-19-50",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+7-914-732-19-50",
      contactType: "sales",
      availableLanguage: "Russian",
    },
    sameAs: [
      "https://t.me/jck_auto_manager",
      "https://youtube.com/@JCK_AUTO",
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "JCK AUTO",
    url: "https://jckauto.ru",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
