import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import FeaturedProjects from "@/components/FeaturedProjects";
import About from "@/components/About";
import Skills from "@/components/Skills";
import Experience from "@/components/Experience";
import Contact from "@/components/Contact";


export default function Home() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <FeaturedProjects />
        <About />
        <Skills />
        <Experience />
        <Contact />
      </main>
    </div>
  );
}
