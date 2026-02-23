"use client";
import { AddTaskWrapper } from "@/components/add-tasks/add-task-button";
import SuggestMissingTasks from "@/components/add-tasks/suggest-tasks";
import MobileNav from "@/components/nav/mobile-nav";
import SideBar from "@/components/nav/side-bar";
import DeleteProject from "@/components/projects/delete-project";
import CompletedTodos from "@/components/todos/completed-todos";
import Todos from "@/components/todos/todos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/supabase/api";
import { useMutation, useQuery } from "@/lib/supabase/hooks";
import { Id } from "@/lib/supabase/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProjectIdPage() {
  const { projectId } = useParams<{ projectId: Id<"projects"> }>();
  const { toast } = useToast();
  const updateProjectMutation = useMutation(api.projects.updateAProject);

  const inCompletedTodosByProject =
    useQuery(api.todos.getInCompleteTodosByProjectId, {
      projectId,
    }) ?? [];
  const completedTodosByProject =
    useQuery(api.todos.getCompletedTodosByProjectId, {
      projectId,
    }) ?? [];

  const project = useQuery(api.projects.getProjectByProjectId, {
    projectId,
  });
  const projectTodosTotal =
    useQuery(api.todos.getTodosTotalByProjectId, {
      projectId,
    }) || 0;

  const projectName = project?.name || "";
  const [projectNameDraft, setProjectNameDraft] = useState(projectName);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [isSavingProjectName, setIsSavingProjectName] = useState(false);

  useEffect(() => {
    if (!isEditingProjectName) {
      setProjectNameDraft(projectName);
    }
  }, [isEditingProjectName, projectName]);

  const handleSaveProjectName = async () => {
    if (!project || project.type !== "user" || isSavingProjectName) {
      return;
    }

    const trimmedName = projectNameDraft.trim();
    if (!trimmedName) {
      toast({
        title: "Project name is required",
        duration: 2500,
      });
      return;
    }

    if (trimmedName === project.name) {
      setIsEditingProjectName(false);
      return;
    }

    setIsSavingProjectName(true);
    try {
      const updatedId = await updateProjectMutation({
        projectId,
        name: trimmedName,
      });

      if (updatedId) {
        toast({
          title: "✅ Project updated",
          duration: 2200,
        });
      }
      setIsEditingProjectName(false);
    } catch (error) {
      console.error("Failed to update project name.", error);
      toast({
        title: "Could not update project name",
        duration: 2500,
      });
    } finally {
      setIsSavingProjectName(false);
    }
  };

  const handleCancelProjectNameEdit = () => {
    setProjectNameDraft(projectName);
    setIsEditingProjectName(false);
  };

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <SideBar />
      <div className="flex flex-col">
        <MobileNav navTitle={"My Projects"} navLink="/loggedin/projects" />

        <main className="flex flex-1 flex-col gap-4 p-4 lg:px-8">
          <div className="xl:px-40">
            <div className="flex items-center justify-between flex-wrap gap-2 lg:gap-0">
              {project?.type === "user" ? (
                isEditingProjectName ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={projectNameDraft}
                      onChange={(event) => setProjectNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSaveProjectName();
                        }

                        if (event.key === "Escape") {
                          event.preventDefault();
                          handleCancelProjectNameEdit();
                        }
                      }}
                      className="h-9 w-56 md:w-72"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        void handleSaveProjectName();
                      }}
                      disabled={isSavingProjectName}
                    >
                      {isSavingProjectName ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={handleCancelProjectNameEdit}
                      disabled={isSavingProjectName}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-left text-lg font-semibold hover:underline md:text-2xl"
                    onClick={() => setIsEditingProjectName(true)}
                  >
                    {projectName || "Project"}
                  </button>
                )
              ) : (
                <h1 className="text-lg font-semibold md:text-2xl">
                  {projectName || "Project"}
                </h1>
              )}
              <div className="flex gap-6 lg:gap-12 items-center">
                <SuggestMissingTasks projectId={projectId} />
                <DeleteProject projectId={projectId} />
              </div>
            </div>
            <div className="flex flex-col gap-1 mt-4">
              <Todos items={inCompletedTodosByProject} />

              <div className="pb-6">
                <AddTaskWrapper projectId={projectId} />
              </div>

              <Todos items={completedTodosByProject} />
              <div className="flex items-center space-x-4 gap-2 border-b-2 p-2 border-gray-100 text-sm text-foreground/80">
                <CompletedTodos totalTodos={projectTodosTotal} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
