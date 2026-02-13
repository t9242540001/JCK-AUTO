export default function JsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "JCK AUTO",
    url: "https://jckauto.ru",
    logo: "https://jckauto.ru/images/logo.png",
    description:
      "Импорт автомобилей из Китая, Кореи и Японии с полным сопровождением",
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+7-914-708-73-91",
        contactType: "sales",
        availableLanguage: "Russian",
      },
    ],
    sameAs: ["https://t.me/jck_auto", "https://youtube.com/@JCK_AUTO"],
  };

  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: "JCK AUTO",
    url: "https://jckauto.ru",
    telephone: "+7-914-708-73-91",
    description: "Импорт автомобилей из Китая, Кореи и Японии",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Владивосток",
      addressCountry: "RU",
    },
    openingHours: "Mo-Su 09:00-21:00",
    priceRange: "₽₽",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
      />
    </>
  );
}
