import Personas from "@/components/containers/personas";
import MobileNav from "@/components/nav/mobile-nav";
import SideBar from "@/components/nav/side-bar";

export default function PersonasPage() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideBar />
      <div className="flex flex-col">
        <MobileNav navTitle="Personas" navLink="/loggedin/personas" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:px-8">
          <Personas />
        </main>
      </div>
    </div>
  );
}
