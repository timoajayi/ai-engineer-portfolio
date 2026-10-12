export default function Navbar() {
  return (
    <header className="absolute left-0 top-0 z-50 w-full">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 lg:px-8">
        <a
          href="#"
          className="text-lg font-semibold tracking-tight text-white"
        >
          Timothy Ajayi
        </a>

        <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#projects" className="transition-colors hover:text-white">
            Projects
          </a>

          <a href="#about" className="transition-colors hover:text-white">
            About
          </a>

          <a href="#skills" className="transition-colors hover:text-white">
            Skills
          </a>

          <a href="#contact" className="transition-colors hover:text-white">
            Contact
          </a>
        </div>
      </nav>
    </header>
  );
}