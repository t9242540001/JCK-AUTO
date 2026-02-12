import Values from "@/components/sections/Values";
import Warranty from "@/components/sections/Warranty";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex items-center justify-center py-20">
        <h1 className="font-heading text-4xl font-bold text-primary">
          JCK AUTO
        </h1>
      </div>
      <Values />
      <Warranty />
    </main>
  );
}
