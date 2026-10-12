import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FeaturedProjects from "@/components/FeaturedProjects";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <Hero />
      <FeaturedProjects />
    </main>
  );
}