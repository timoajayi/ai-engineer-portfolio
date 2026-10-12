import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FeaturedProjects from "@/components/FeaturedProjects";
import About from "@/components/About";
import Skills from "@/components/Skills";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <Hero />
      <FeaturedProjects />
      <About />
      <Skills />
    </main>
  );
}