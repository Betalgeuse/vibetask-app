import Epics from "@/components/containers/epics";
import MobileNav from "@/components/nav/mobile-nav";
import SideBar from "@/components/nav/side-bar";

export default function EpicsPage() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideBar />
      <div className="flex flex-col">
        <MobileNav navTitle="Epics" navLink="/loggedin/epics" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:px-8">
          <Epics />
        </main>
      </div>
    </div>
  );
}
