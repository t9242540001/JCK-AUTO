import HowItWorks from "@/components/sections/HowItWorks";

export default function Home() {
  return (
    <main>
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="font-heading text-4xl font-bold text-primary">
          JCK AUTO
        </h1>
      </div>
      {/* Countries section would go here */}
      <HowItWorks />
    </main>
  );
}
