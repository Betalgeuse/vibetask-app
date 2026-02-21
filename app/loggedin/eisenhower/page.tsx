import Eisenhower from "@/components/containers/eisenhower";
import MobileNav from "@/components/nav/mobile-nav";
import SideBar from "@/components/nav/side-bar";

export default function EisenhowerPage() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideBar />
      <div className="flex flex-col">
        <MobileNav navTitle="Eisenhower Matrix" navLink="/loggedin/eisenhower" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:px-8">
          <Eisenhower />
        </main>
      </div>
    </div>
  );
}
