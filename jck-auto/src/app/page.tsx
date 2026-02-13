import Hero from "@/components/sections/Hero";
import Countries from "@/components/sections/Countries";
import HowItWorks from "@/components/sections/HowItWorks";
import Calculator from "@/components/sections/Calculator";
import Values from "@/components/sections/Values";
import Warranty from "@/components/sections/Warranty";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import ContactCTA from "@/components/sections/ContactCTA";

export default function Home() {
  return (
    <>
      <Hero />
      <Countries />
      <HowItWorks />
      <Calculator />
      <Values />
      <Warranty />
      <Testimonials />
      <FAQ />
      <ContactCTA />
    </>
  );
}
