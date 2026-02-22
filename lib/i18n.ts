import type { PriorityQuadrant } from "@/lib/types/priority";
import type { TaskModuleKey, WorkflowStatus } from "@/lib/types/task-payload";

export const SUPPORTED_APP_LOCALES = ["en", "ko"] as const;
export type AppLocale = (typeof SUPPORTED_APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = "en";
export const APP_LOCALE_STORAGE_KEY = "dunnit.locale";

export const APP_LOCALE_OPTIONS: Array<{
  value: AppLocale;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
];

type ModuleCopy = Record<
  TaskModuleKey,
  {
    title: string;
    description: string;
  }
>;

type PriorityQuadrantCopy = Record<
  PriorityQuadrant,
  {
    title: string;
    subtitle: string;
  }
>;

type KanbanColumnCopy = Record<
  "TODO" | "IN_PROGRESS" | "DONE",
  {
    title: string;
    subtitle: string;
  }
>;

type WorkflowStatusCopy = Record<WorkflowStatus, string>;

type LocaleMessages = {
  landing: {
    poweredBy: string;
    headingTop: string;
    headingBottom: string;
    subheadingPrefix: string;
    subheadingOrganize: string;
    subheadingConnector: string;
    subheadingPredict: string;
    subheadingSuffix: string;
    getStarted: string;
    language: string;
    loading: string;
  };
  settings: {
    featureTitle: string;
    featureDescription: string;
    languageTitle: string;
    languageDescription: string;
    languageLabel: string;
    languageSaving: string;
    languageSaveErrorTitle: string;
    languageSaveErrorDescription: string;
    modules: ModuleCopy;
    connectCalendar: string;
    disconnectCalendar: string;
  };
  tasks: {
    taskNamePlaceholder: string;
    descriptionPlaceholder: string;
    storyPlaceholder: string;
    pickDate: string;
    selectPriority: string;
    noPriority: string;
    selectLabel: string;
    noLabel: string;
    selectProject: string;
    noProject: string;
    none: string;
    personaOptional: string;
    epicOptional: string;
    workloadPlaceholder: string;
    workflowStatusPlaceholder: string;
    customFieldsTitle: string;
    checked: string;
    cancel: string;
    addTask: string;
    checkingPriority: string;
    taskCreatedTitle: string;
    couldNotCreateTaskTitle: string;
    failedToCreateTaskDescription: string;
    defaultEntityNotReady: string;
    couldNotResolvePriorityTitle: string;
    invalidPriorityDescription: string;
    fallbackPriorityTitle: string;
    fallbackPriorityDescription: string;
    workflowStatuses: WorkflowStatusCopy;
    priorityQuadrants: PriorityQuadrantCopy;
  };
  eisenhower: {
    title: string;
    description: string;
    loading: string;
    noTasks: string;
    completedTitle: string;
    completedDescription: string;
    quadrants: PriorityQuadrantCopy;
  };
  kanban: {
    title: string;
    description: string;
    loading: string;
    noTasks: string;
    columns: KanbanColumnCopy;
  };
};

const EN_MESSAGES: LocaleMessages = {
  landing: {
    poweredBy: "Powered by",
    headingTop: "An Open Source AI-Powered",
    headingBottom: "Todoist Clone",
    subheadingPrefix: "Dunnit seamlessly",
    subheadingOrganize: "organizes your tasks",
    subheadingConnector: "and",
    subheadingPredict: "predicts what's next",
    subheadingSuffix: "using AI.",
    getStarted: "Get Started",
    language: "Language",
    loading: "Loading...",
  },
  settings: {
    featureTitle: "Feature Settings",
    featureDescription:
      "Turn task properties on only when you want them. Hidden properties stay in payload structure for future UX changes.",
    languageTitle: "Language",
    languageDescription:
      "Choose your display language. We save this preference to your account settings.",
    languageLabel: "Display language",
    languageSaving: "Saving language…",
    languageSaveErrorTitle: "Could not save language",
    languageSaveErrorDescription: "Please try again.",
    modules: {
      persona: {
        title: "Persona",
        description:
          "Enable custom persona property and persona navigation for your own taxonomy.",
      },
      epic: {
        title: "Epic",
        description: "Enable epic grouping field for tasks.",
      },
      story: {
        title: "Story",
        description: "Show context/background story field while creating tasks.",
      },
      workload: {
        title: "Workload",
        description: "Track expected effort/energy score on tasks.",
      },
      workflowStatus: {
        title: "Workflow Status",
        description: "Use Backlog/Week/Today style status on task payload.",
      },
      calendarSync: {
        title: "Calendar Sync",
        description:
          "Prepare for Google Calendar sync behavior (future integration).",
      },
    },
    connectCalendar: "Connect Google Calendar",
    disconnectCalendar: "Disconnect",
  },
  tasks: {
    taskNamePlaceholder: "Enter your task name",
    descriptionPlaceholder: "Description",
    storyPlaceholder: "Story / context (optional)",
    pickDate: "Pick a date (optional)",
    selectPriority: "Select a priority",
    noPriority: "No priority (use AI)",
    selectLabel: "Select a label",
    noLabel: "No label (auto)",
    selectProject: "Select a project",
    noProject: "No project (auto)",
    none: "None",
    personaOptional: "Persona (optional)",
    epicOptional: "Epic (optional)",
    workloadPlaceholder: "Workload (1-100)",
    workflowStatusPlaceholder: "Workflow status",
    customFieldsTitle: "Custom fields",
    checked: "Checked",
    cancel: "Cancel",
    addTask: "Add task",
    checkingPriority: "Checking priority...",
    taskCreatedTitle: "🦄 Created a task!",
    couldNotCreateTaskTitle: "Could not create task",
    failedToCreateTaskDescription: "Failed to create task.",
    defaultEntityNotReady:
      "Project/Label default is not ready yet. Please try again.",
    couldNotResolvePriorityTitle: "Could not resolve priority",
    invalidPriorityDescription: "Please choose a valid priority quadrant.",
    fallbackPriorityTitle: "Using default priority suggestion",
    fallbackPriorityDescription:
      "AI suggestion failed. Using default priority suggestion.",
    workflowStatuses: {
      BACKLOG: "Backlog",
      NEXT_WEEK: "Next week",
      THIS_WEEK: "This week",
      TODAY: "Today",
      DONE: "Done",
      CANCEL: "Canceled",
    },
    priorityQuadrants: {
      doFirst: {
        title: "Do First",
        subtitle: "Urgent + Important",
      },
      schedule: {
        title: "Schedule",
        subtitle: "Not Urgent + Important",
      },
      delegate: {
        title: "Delegate",
        subtitle: "Urgent + Not Important",
      },
      eliminate: {
        title: "Eliminate",
        subtitle: "Not Urgent + Not Important",
      },
    },
  },
  eisenhower: {
    title: "Eisenhower Matrix",
    description: "Tasks are grouped by priority quadrant.",
    loading: "Loading matrix...",
    noTasks: "No tasks",
    completedTitle: "✅ Task completed",
    completedDescription: "You're a rockstar",
    quadrants: {
      doFirst: {
        title: "Do First",
        subtitle: "Urgent + Important",
      },
      schedule: {
        title: "Schedule",
        subtitle: "Not Urgent + Important",
      },
      delegate: {
        title: "Delegate",
        subtitle: "Urgent + Not Important",
      },
      eliminate: {
        title: "Eliminate",
        subtitle: "Not Urgent + Not Important",
      },
    },
  },
  kanban: {
    title: "Kanban Board",
    description: "Organize tasks by workflow stage.",
    loading: "Loading board...",
    noTasks: "No tasks",
    columns: {
      TODO: {
        title: "To Do",
        subtitle: "Planned tasks",
      },
      IN_PROGRESS: {
        title: "In Progress",
        subtitle: "Actively being worked",
      },
      DONE: {
        title: "Done",
        subtitle: "Completed tasks",
      },
    },
  },
};

const KO_MESSAGES: LocaleMessages = {
  landing: {
    poweredBy: "Powered by",
    headingTop: "오픈소스 AI 기반",
    headingBottom: "Todoist 클론",
    subheadingPrefix: "Dunnit은",
    subheadingOrganize: "작업을 정리하고",
    subheadingConnector: "AI로",
    subheadingPredict: "다음 할 일을 예측해",
    subheadingSuffix: "업무 흐름을 도와줘요.",
    getStarted: "시작하기",
    language: "언어",
    loading: "로딩 중...",
  },
  settings: {
    featureTitle: "기능 설정",
    featureDescription:
      "원할 때만 작업 속성을 켜세요. 숨긴 속성도 향후 UX 확장을 위해 payload 구조에는 유지됩니다.",
    languageTitle: "언어",
    languageDescription:
      "표시 언어를 선택하세요. 이 설정은 계정 설정에 저장됩니다.",
    languageLabel: "표시 언어",
    languageSaving: "언어 저장 중…",
    languageSaveErrorTitle: "언어를 저장하지 못했습니다",
    languageSaveErrorDescription: "잠시 후 다시 시도해 주세요.",
    modules: {
      persona: {
        title: "페르소나",
        description:
          "사용자 분류 체계에 맞춘 페르소나 속성과 네비게이션을 활성화합니다.",
      },
      epic: {
        title: "에픽",
        description: "작업을 에픽 단위로 묶는 필드를 활성화합니다.",
      },
      story: {
        title: "스토리",
        description: "작업 생성 시 배경/맥락 스토리 필드를 표시합니다.",
      },
      workload: {
        title: "작업량",
        description: "작업의 예상 에너지/노력 점수를 추적합니다.",
      },
      workflowStatus: {
        title: "워크플로우 상태",
        description: "Backlog/Week/Today 스타일 상태를 payload에 사용합니다.",
      },
      calendarSync: {
        title: "캘린더 동기화",
        description:
          "Google Calendar 동기화 동작(향후 통합)을 위한 설정입니다.",
      },
    },
    connectCalendar: "Google Calendar 연결",
    disconnectCalendar: "연결 해제",
  },
  tasks: {
    taskNamePlaceholder: "태스크명을 입력하세요",
    descriptionPlaceholder: "설명",
    storyPlaceholder: "스토리 / 컨텍스트 (선택)",
    pickDate: "날짜 선택 (선택)",
    selectPriority: "우선순위를 선택하세요",
    noPriority: "우선순위 없음 (AI 추천)",
    selectLabel: "라벨을 선택하세요",
    noLabel: "라벨 없음 (자동)",
    selectProject: "프로젝트를 선택하세요",
    noProject: "프로젝트 없음 (자동)",
    none: "없음",
    personaOptional: "페르소나 (선택)",
    epicOptional: "에픽 (선택)",
    workloadPlaceholder: "작업량 (1-100)",
    workflowStatusPlaceholder: "워크플로우 상태",
    customFieldsTitle: "커스텀 필드",
    checked: "선택됨",
    cancel: "취소",
    addTask: "태스크 추가",
    checkingPriority: "우선순위 확인 중...",
    taskCreatedTitle: "🦄 태스크가 생성되었습니다!",
    couldNotCreateTaskTitle: "태스크를 생성할 수 없습니다",
    failedToCreateTaskDescription: "태스크 생성에 실패했습니다.",
    defaultEntityNotReady:
      "기본 프로젝트/라벨이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.",
    couldNotResolvePriorityTitle: "우선순위를 확인할 수 없습니다",
    invalidPriorityDescription: "유효한 우선순위 사분면을 선택해 주세요.",
    fallbackPriorityTitle: "기본 우선순위 추천을 사용합니다",
    fallbackPriorityDescription:
      "AI 추천에 실패해 기본 우선순위 추천을 사용합니다.",
    workflowStatuses: {
      BACKLOG: "백로그",
      NEXT_WEEK: "다음 주",
      THIS_WEEK: "이번 주",
      TODAY: "오늘",
      DONE: "완료",
      CANCEL: "취소",
    },
    priorityQuadrants: {
      doFirst: {
        title: "먼저 하기",
        subtitle: "긴급 + 중요",
      },
      schedule: {
        title: "계획하기",
        subtitle: "긴급 아님 + 중요",
      },
      delegate: {
        title: "위임하기",
        subtitle: "긴급 + 덜 중요",
      },
      eliminate: {
        title: "제거하기",
        subtitle: "긴급 아님 + 덜 중요",
      },
    },
  },
  eisenhower: {
    title: "아이젠하워 매트릭스",
    description: "태스크를 우선순위 사분면별로 분류합니다.",
    loading: "매트릭스를 불러오는 중...",
    noTasks: "태스크가 없습니다",
    completedTitle: "✅ 태스크 완료",
    completedDescription: "아주 잘하고 있어요",
    quadrants: {
      doFirst: {
        title: "먼저 하기",
        subtitle: "긴급 + 중요",
      },
      schedule: {
        title: "계획하기",
        subtitle: "긴급 아님 + 중요",
      },
      delegate: {
        title: "위임하기",
        subtitle: "긴급 + 덜 중요",
      },
      eliminate: {
        title: "제거하기",
        subtitle: "긴급 아님 + 덜 중요",
      },
    },
  },
  kanban: {
    title: "칸반 보드",
    description: "워크플로우 단계별로 태스크를 정리합니다.",
    loading: "보드를 불러오는 중...",
    noTasks: "태스크가 없습니다",
    columns: {
      TODO: {
        title: "할 일",
        subtitle: "계획된 태스크",
      },
      IN_PROGRESS: {
        title: "진행 중",
        subtitle: "현재 진행 중인 태스크",
      },
      DONE: {
        title: "완료",
        subtitle: "완료된 태스크",
      },
    },
  },
};

const MESSAGES: Record<AppLocale, LocaleMessages> = {
  en: EN_MESSAGES,
  ko: KO_MESSAGES,
};

export function normalizeAppLocale(
  value: unknown,
  fallback: AppLocale = DEFAULT_APP_LOCALE
): AppLocale {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  if (normalized === "ko" || normalized.startsWith("ko-")) {
    return "ko";
  }

  return fallback;
}

export function getLocaleMessages(locale: unknown): LocaleMessages {
  return MESSAGES[normalizeAppLocale(locale)];
}
