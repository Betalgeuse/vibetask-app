import SettingsModules from "@/components/containers/settings-modules";
import MobileNav from "@/components/nav/mobile-nav";
import SideBar from "@/components/nav/side-bar";

type SettingsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function resolveSearchParam(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === "string" && entry.trim());
  }

  return undefined;
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  const statusError = resolveSearchParam(searchParams?.error);
  const statusMessage = resolveSearchParam(searchParams?.message);

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideBar />
      <div className="flex flex-col">
        <MobileNav navTitle="Settings" navLink="/loggedin/settings" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:px-8">
          <SettingsModules statusError={statusError} statusMessage={statusMessage} />
        </main>
      </div>
    </div>
  );
}
