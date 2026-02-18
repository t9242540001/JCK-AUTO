export default function JsonLd() {
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "JCK AUTO",
    description: "Импорт автомобилей из Китая, Кореи и Японии под ключ",
    url: "https://jckauto.ru",
    telephone: "+7-914-732-19-50",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Уссурийск",
      addressRegion: "Приморский край",
      addressCountry: "RU",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "09:00",
      closes: "19:00",
    },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
