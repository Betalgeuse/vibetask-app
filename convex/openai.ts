import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

import OpenAI from "openai";

const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY;
const usingGemini = Boolean(geminiApiKey);
const resolvedApiKey = geminiApiKey ?? openAiApiKey ?? null;

const openai = new OpenAI({
  apiKey: resolvedApiKey ?? undefined,
  ...(usingGemini
    ? {
        // Gemini OpenAI-compatible endpoint
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      }
    : {}),
});

const CHAT_MODEL = usingGemini ? "gemini-2.0-flash" : "gpt-3.5-turbo";
const EMBEDDING_MODEL = usingGemini
  ? "text-embedding-004"
  : "text-embedding-ada-002";

function requireOpenAiKey() {
  if (!resolvedApiKey) {
    throw new Error("No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.");
  }

  return resolvedApiKey;
}

async function resolveAiLabelId(ctx: any) {
  const labels = await ctx.runQuery(api.labels.getLabels, {});
  const aiLabel = labels.find((label: { name: string }) =>
    label.name.toLowerCase().includes("ai")
  );
  return aiLabel?._id ?? labels[0]?._id ?? null;
}

export const suggestMissingItemsWithAi = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    requireOpenAiKey();

    //retrieve todos for the user
    const todos = await ctx.runQuery(api.todos.getTodosByProjectId, {
      projectId,
    });

    const project = await ctx.runQuery(api.projects.getProjectByProjectId, {
      projectId,
    });
    const projectName = project?.name || "";

    const response = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "I'm a project manager and I need help identifying missing to-do items. I have a list of existing tasks in JSON format, containing objects with 'taskName' and 'description' properties. I also have a good understanding of the project scope. Can you help me identify 5 additional to-do items for the project with projectName that are not yet included in this list? Please provide these missing items in a separate JSON array with the key 'todos' containing objects with 'taskName' and 'description' properties. Ensure there are no duplicates between the existing list and the new suggestions.",
        },
        {
          role: "user",
          content: JSON.stringify({
            todos,
            projectName,
          }),
        },
      ],
      response_format: {
        type: "json_object",
      },
      model: CHAT_MODEL,
    });

    console.log(response.choices[0]);

    const messageContent = response.choices[0].message?.content;

    console.log({ messageContent });

    //create the todos
    if (messageContent) {
      const items = JSON.parse(messageContent)?.todos ?? [];
      const aiLabelId = await resolveAiLabelId(ctx);

      if (!aiLabelId) {
        throw new Error(
          "No labels found. Create at least one label before using AI suggestions."
        );
      }

      for (let i = 0; i < items.length; i++) {
        const { taskName, description } = items[i];
        const embedding = await getEmbeddingsWithAI(taskName);
        await ctx.runMutation(api.todos.createATodo, {
          taskName,
          description,
          priority: 1,
          dueDate: new Date().getTime(),
          projectId,
          labelId: aiLabelId,
          embedding,
        });
      }
    }
  },
});

export const suggestMissingSubItemsWithAi = action({
  args: {
    projectId: v.id("projects"),
    parentId: v.id("todos"),
    taskName: v.string(),
    description: v.string(),
  },
  handler: async (ctx, { projectId, parentId, taskName, description }) => {
    requireOpenAiKey();

    //retrieve todos for the user
    const todos = await ctx.runQuery(api.subTodos.getSubTodosByParentId, {
      parentId,
    });

    const project = await ctx.runQuery(api.projects.getProjectByProjectId, {
      projectId,
    });
    const projectName = project?.name || "";

    const response = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "I'm a project manager and I need help identifying missing sub tasks for a parent todo. I have a list of existing sub tasks in JSON format, containing objects with 'taskName' and 'description' properties. I also have a good understanding of the project scope. Can you help me identify 2 additional sub tasks that are not yet included in this list? Please provide these missing items in a separate JSON array with the key 'todos' containing objects with 'taskName' and 'description' properties. Ensure there are no duplicates between the existing list and the new suggestions.",
        },
        {
          role: "user",
          content: JSON.stringify({
            todos,
            projectName,
            ...{ parentTodo: { taskName, description } },
          }),
        },
      ],
      response_format: {
        type: "json_object",
      },
      model: CHAT_MODEL,
    });

    console.log(response.choices[0]);

    const messageContent = response.choices[0].message?.content;

    console.log({ messageContent });

    //create the todos
    if (messageContent) {
      const items = JSON.parse(messageContent)?.todos ?? [];
      const aiLabelId = await resolveAiLabelId(ctx);

      if (!aiLabelId) {
        throw new Error(
          "No labels found. Create at least one label before using AI suggestions."
        );
      }

      for (let i = 0; i < items.length; i++) {
        const { taskName, description } = items[i];
        const embedding = await getEmbeddingsWithAI(taskName);
        await ctx.runMutation(api.subTodos.createASubTodo, {
          taskName,
          description,
          priority: 1,
          dueDate: new Date().getTime(),
          projectId,
          parentId,
          labelId: aiLabelId,
          embedding,
        });
      }
    }
  },
});

export const getEmbeddingsWithAI = async (searchText: string) => {
  requireOpenAiKey();
  const response = await openai.embeddings.create({
    input: searchText,
    model: EMBEDDING_MODEL,
    encoding_format: "float",
  });

  const vector = response.data?.[0]?.embedding;

  if (!vector) {
    throw new Error("Failed to generate embedding.");
  }

  console.log(`Embedding of ${searchText}: , ${vector.length} dimensions`);

  return vector;
};
