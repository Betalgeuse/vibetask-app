import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { handleUserId } from "./auth";
import { api } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

const apiRef = api as any;

export const getProjects = query({
  args: {},
  handler: async (ctx) => {
    const userId = await handleUserId(ctx);
    if (userId) {
      const userProjects = await ctx.db
        .query("projects")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect();

      const systemProjects = await ctx.db
        .query("projects")
        .filter((q) => q.eq(q.field("type"), "system"))
        .collect();

      return [...systemProjects, ...userProjects];
    }
    return [];
  },
});

export const getProjectByProjectId = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await handleUserId(ctx);
    if (userId) {
      const project = await ctx.db.get(projectId);
      if (!project) {
        return null;
      }

      if (project.type === "system" || project.userId === userId) {
        return project;
      }
    }
    return null;
  },
});

export const createAProject = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    try {
      const userId = await handleUserId(ctx);
      if (userId) {
        const newTaskId = await ctx.db.insert("projects", {
          userId,
          name,
          type: "user",
        });
        return newTaskId;
      }

      return null;
    } catch (err) {
      console.log("Error occurred during createAProject mutation", err);

      return null;
    }
  },
});

export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    try {
      const userId = await handleUserId(ctx);
      if (userId) {
        const project = await ctx.db.get(projectId);
        if (!project) {
          return null;
        }

        if (project.type === "system" || project.userId !== userId) {
          return null;
        }

        await ctx.db.delete(projectId);
        return projectId;
      }

      return null;
    } catch (err) {
      console.log("Error occurred during deleteProject mutation", err);

      return null;
    }
  },
});

export const deleteProjectAndItsTasks = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    try {
      const project = await ctx.runQuery(apiRef.projects.getProjectByProjectId, {
        projectId,
      });

      if (!project) {
        return { ok: false as const, reason: "Project not found" };
      }

      if (project.type === "system") {
        return {
          ok: false as const,
          reason: "System projects are protected from deletion.",
        };
      }

      const allTasks: Array<Doc<"todos">> =
        (await ctx.runQuery(apiRef.todos.getTodosByProjectId, {
          projectId,
        })) ?? [];

      const statuses: Array<PromiseSettledResult<unknown>> =
        await Promise.allSettled(
        allTasks.map(async (task: Doc<"todos">) =>
          ctx.runMutation(apiRef.todos.deleteATodo, {
            taskId: task._id,
          })
        )
      );

      const deletedProjectId = await ctx.runMutation(
        apiRef.projects.deleteProject,
        {
          projectId,
        }
      );

      if (!deletedProjectId) {
        return { ok: false as const, reason: "Unable to delete project" };
      }

      return {
        ok: true as const,
        deletedTodos: statuses.filter((status) => status.status === "fulfilled")
          .length,
      };
    } catch (err) {
      console.error("Error deleting tasks and projects", err);
      return { ok: false as const, reason: "Unexpected error" };
    }
  },
});
