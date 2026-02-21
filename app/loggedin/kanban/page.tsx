import Kanban from "@/components/containers/kanban";
import MobileNav from "@/components/nav/mobile-nav";
import SideBar from "@/components/nav/side-bar";

export default function KanbanPage() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideBar />
      <div className="flex flex-col">
        <MobileNav navTitle="Kanban" navLink="/loggedin/kanban" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:px-8">
          <Kanban />
        </main>
      </div>
    </div>
  );
}
