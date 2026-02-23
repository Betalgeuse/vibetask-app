import type { PriorityQuadrant } from "@/lib/types/priority";
import type { TaskModuleKey, WorkflowStatus } from "@/lib/types/task-payload";

export const SUPPORTED_APP_LOCALES = ["en", "ko"] as const;
export type AppLocale = (typeof SUPPORTED_APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = "ko";
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
    calendarSidebarHint: string;
    openTodayCalendar: string;
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
    manualLabelOption: string;
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
    addSubTask: string;
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
  navigation: {
    sectionTitleProjects: string;
    sectionTitleProductivity: string;
    itemInbox: string;
    itemToday: string;
    itemUpcoming: string;
    itemKanban: string;
    itemEisenhower: string;
    itemFilters: string;
    itemSettings: string;
    itemPersonas: string;
    itemEpics: string;
    itemMyProjects: string;
    toggleNavigationMenu: string;
    searchTasksPlaceholder: string;
    addProjectAriaLabel: string;
    addLabelAriaLabel: string;
    upgradeTitle: string;
    upgradeDescription: string;
    upgradeCta: string;
    signOut: string;
    userFallbackName: string;
    userFallbackAccount: string;
    profileImageAltSuffix: string;
  };
  dialogs: {
    addProject: {
      title: string;
      namePlaceholder: string;
      submit: string;
      createdSuccessTitle: string;
    };
    addLabel: {
      title: string;
      namePlaceholder: string;
      colorLabel: string;
      submit: string;
      createdSuccessTitle: string;
    };
    deleteProject: {
      actionLabel: string;
      reminderTitle: string;
      reminderDescription: string;
      successTitle: string;
    };
    taskDetails: {
      subTasks: string;
      metadataProject: string;
      metadataDueDate: string;
      metadataPriority: string;
      metadataLabel: string;
      deletedSuccessTitle: string;
      deleteCompletedAction: string;
      deleteCompletedLoading: string;
      deleteCompletedSuccessTitle: string;
      deleteCompletedFailureDescription: string;
    };
    prioritySuggestion: {
      title: string;
      suggestedQuadrantPrefix: string;
      fallbackDescription: string;
      pickQuadrant: string;
      suggestedPropertiesTitle: string;
      cancel: string;
      confirm: string;
      confirming: string;
    };
    aiRecommend: {
      title: string;
      description: string;
      empty: string;
      recommendationPrefix: string;
      taskNameLabel: string;
      descriptionLabel: string;
      labelLabel: string;
      labelPlaceholder: string;
      newLabelOption: string;
      newLabelPlaceholder: string;
      personaLabel: string;
      personaPlaceholder: string;
      noSelection: string;
      newPersonaOption: string;
      newPersonaPlaceholder: string;
      epicLabel: string;
      epicPlaceholder: string;
      newEpicOption: string;
      newEpicPlaceholder: string;
      storyLabel: string;
      workloadLabel: string;
      close: string;
      quickAdd: string;
      quickAdding: string;
      createSelected: string;
      creating: string;
    };
  };
  suggestions: {
    loadingButtonLabel: string;
    buttonLabel: string;
    noRecommendationsTitle: string;
    noRecommendationsDescription: string;
    requestFailureTitle: string;
    requestFailureDescription: string;
    quickAddSuccessTitle: string;
    quickAddEmptyTitle: string;
    quickAddEmptyDescription: string;
    quickAddFailureTitle: string;
    quickAddFailureDescription: string;
    noItemsToCreateTitle: string;
    labelNameRequiredTemplate: string;
    labelCreateFailureTemplate: string;
    personaNameRequiredTemplate: string;
    personaCreateFailureTemplate: string;
    epicNameRequiredTemplate: string;
    epicCreateFailureTemplate: string;
    workloadInvalidTemplate: string;
    taskNameRequiredTemplate: string;
    missingParentForSubTask: string;
    missingParentForSubTaskCreation: string;
    createSelectedSuccessTitle: string;
    createSelectedFailureTitle: string;
    createSelectedFailureDescription: string;
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
      aiPriorityConfirmation: {
        title: "AI Priority Confirmation",
        description:
          "Require a confirmation popup before applying AI-suggested Eisenhower priority.",
      },
    },
    connectCalendar: "Connect Google Calendar",
    disconnectCalendar: "Disconnect",
    calendarSidebarHint: "When enabled, a calendar sidebar is shown on the Today page.",
    openTodayCalendar: "Open Today page",
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
    manualLabelOption: "Manual input",
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
    addSubTask: "Add sub-task",
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
  navigation: {
    sectionTitleProjects: "My Projects",
    sectionTitleProductivity: "Productivity",
    itemInbox: "Inbox",
    itemToday: "Today",
    itemUpcoming: "Upcoming",
    itemKanban: "Kanban",
    itemEisenhower: "Eisenhower Matrix",
    itemFilters: "Filters & Labels",
    itemSettings: "Settings",
    itemPersonas: "Personas",
    itemEpics: "Epics",
    itemMyProjects: "My Projects",
    toggleNavigationMenu: "Toggle navigation menu",
    searchTasksPlaceholder: "Search tasks...",
    addProjectAriaLabel: "Add a Project",
    addLabelAriaLabel: "Add a Label",
    upgradeTitle: "Upgrade to Pro",
    upgradeDescription:
      "Unlock all features and get unlimited access to our support team.",
    upgradeCta: "Upgrade",
    signOut: "Sign out",
    userFallbackName: "User",
    userFallbackAccount: "Account",
    profileImageAltSuffix: "profile picture",
  },
  dialogs: {
    addProject: {
      title: "Add a Project",
      namePlaceholder: "Project name",
      submit: "Add",
      createdSuccessTitle: "🚀 Successfully created a project!",
    },
    addLabel: {
      title: "Add a Label",
      namePlaceholder: "Label name",
      colorLabel: "Label color",
      submit: "Add",
      createdSuccessTitle: "😎 Successfully created a label!",
    },
    deleteProject: {
      actionLabel: "Delete Project",
      reminderTitle: "🤗 Just a reminder",
      reminderDescription: "Unable to delete project.",
      successTitle: "🗑️ Successfully deleted the project",
    },
    taskDetails: {
      subTasks: "Sub-tasks",
      metadataProject: "Project",
      metadataDueDate: "Due date",
      metadataPriority: "Priority",
      metadataLabel: "Label",
      deletedSuccessTitle: "🗑️ Successfully deleted",
      deleteCompletedAction: "Delete completed",
      deleteCompletedLoading: "Deleting...",
      deleteCompletedSuccessTitle: "🧹 Completed tasks removed",
      deleteCompletedFailureDescription:
        "Could not delete completed tasks. Please try again.",
    },
    prioritySuggestion: {
      title: "Confirm suggested priority",
      suggestedQuadrantPrefix: "Suggested quadrant:",
      fallbackDescription:
        "AI is unavailable right now. A default quadrant was suggested.",
      pickQuadrant: "Pick a quadrant",
      suggestedPropertiesTitle: "AI suggestions for enabled properties",
      cancel: "Cancel",
      confirm: "Use selected priority",
      confirming: "Applying...",
    },
    aiRecommend: {
      title: "Review AI recommendations",
      description:
        "Edit recommended items, then create them or use quick add for instant creation.",
      empty: "No recommendations available.",
      recommendationPrefix: "Recommendation",
      taskNameLabel: "Task name",
      descriptionLabel: "Description",
      labelLabel: "Label",
      labelPlaceholder: "Select a label",
      newLabelOption: "+ New label",
      newLabelPlaceholder: "New label name",
      personaLabel: "Persona",
      personaPlaceholder: "Select a persona",
      noSelection: "None",
      newPersonaOption: "+ New persona",
      newPersonaPlaceholder: "New persona name",
      epicLabel: "Epic",
      epicPlaceholder: "Select an epic",
      newEpicOption: "+ New epic",
      newEpicPlaceholder: "New epic name",
      storyLabel: "Story",
      workloadLabel: "Workload (1-100)",
      close: "Close",
      quickAdd: "Quick add",
      quickAdding: "Quick adding...",
      createSelected: "Create from selection",
      creating: "Creating...",
    },
  },
  suggestions: {
    loadingButtonLabel: "Loading Tasks (AI)",
    buttonLabel: "Suggest Missing Tasks (AI) 💖",
    noRecommendationsTitle: "No recommended tasks",
    noRecommendationsDescription:
      "There are no additional recommendations based on current context.",
    requestFailureTitle: "AI recommendation failed",
    requestFailureDescription: "Unable to load AI recommendations.",
    quickAddSuccessTitle: "⚡ Added {count} tasks quickly",
    quickAddEmptyTitle: "No quick add results",
    quickAddEmptyDescription: "There are no recommended tasks to create.",
    quickAddFailureTitle: "Quick add failed",
    quickAddFailureDescription: "An error occurred while quick adding.",
    noItemsToCreateTitle: "No items to create",
    labelNameRequiredTemplate:
      "Enter a label name for recommendation {index}.",
    labelCreateFailureTemplate: "Failed to create new label: {name}",
    personaNameRequiredTemplate:
      "Enter a persona name for recommendation {index}.",
    personaCreateFailureTemplate: "Failed to create new persona: {name}",
    epicNameRequiredTemplate: "Enter an epic name for recommendation {index}.",
    epicCreateFailureTemplate: "Failed to create new epic: {name}",
    workloadInvalidTemplate:
      "Workload for recommendation {index} must be a number greater than 0.",
    taskNameRequiredTemplate: "Enter taskName for recommendation {index}.",
    missingParentForSubTask: "Missing parent task id for sub-task suggestions.",
    missingParentForSubTaskCreation:
      "Missing parent task id for sub-task creation.",
    createSelectedSuccessTitle: "✅ Created {count} recommended tasks",
    createSelectedFailureTitle: "Failed to create selected items",
    createSelectedFailureDescription:
      "An error occurred while creating tasks from your selection.",
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
      aiPriorityConfirmation: {
        title: "AI 우선순위 확인 팝업",
        description:
          "AI가 추천한 아이젠하워 우선순위를 바로 적용하기 전에 확인 팝업을 표시합니다.",
      },
    },
    connectCalendar: "Google Calendar 연결",
    disconnectCalendar: "연결 해제",
    calendarSidebarHint: "활성화하면 Today 페이지에 캘린더 사이드바가 표시됩니다.",
    openTodayCalendar: "Today 페이지 열기",
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
    manualLabelOption: "직접 입력",
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
    addSubTask: "하위 작업 추가",
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
  navigation: {
    sectionTitleProjects: "내 프로젝트",
    sectionTitleProductivity: "생산성",
    itemInbox: "인박스",
    itemToday: "오늘",
    itemUpcoming: "다가오는 일정",
    itemKanban: "칸반",
    itemEisenhower: "아이젠하워 매트릭스",
    itemFilters: "필터 & 라벨",
    itemSettings: "설정",
    itemPersonas: "페르소나",
    itemEpics: "에픽",
    itemMyProjects: "내 프로젝트",
    toggleNavigationMenu: "내비게이션 메뉴 토글",
    searchTasksPlaceholder: "작업 검색...",
    addProjectAriaLabel: "프로젝트 추가",
    addLabelAriaLabel: "라벨 추가",
    upgradeTitle: "프로로 업그레이드",
    upgradeDescription: "모든 기능과 무제한 지원을 이용해 보세요.",
    upgradeCta: "업그레이드",
    signOut: "로그아웃",
    userFallbackName: "사용자",
    userFallbackAccount: "계정",
    profileImageAltSuffix: "프로필 이미지",
  },
  dialogs: {
    addProject: {
      title: "프로젝트 추가",
      namePlaceholder: "프로젝트 이름",
      submit: "추가",
      createdSuccessTitle: "🚀 프로젝트를 생성했어요!",
    },
    addLabel: {
      title: "라벨 추가",
      namePlaceholder: "라벨 이름",
      colorLabel: "라벨 색상",
      submit: "추가",
      createdSuccessTitle: "😎 라벨을 생성했어요!",
    },
    deleteProject: {
      actionLabel: "프로젝트 삭제",
      reminderTitle: "🤗 안내",
      reminderDescription: "프로젝트를 삭제할 수 없습니다.",
      successTitle: "🗑️ 프로젝트를 삭제했어요",
    },
    taskDetails: {
      subTasks: "하위 작업",
      metadataProject: "프로젝트",
      metadataDueDate: "마감일",
      metadataPriority: "우선순위",
      metadataLabel: "라벨",
      deletedSuccessTitle: "🗑️ 삭제했습니다",
      deleteCompletedAction: "완료 항목 삭제",
      deleteCompletedLoading: "삭제 중...",
      deleteCompletedSuccessTitle: "🧹 완료된 작업을 삭제했어요",
      deleteCompletedFailureDescription:
        "완료된 작업을 삭제하지 못했습니다. 다시 시도해 주세요.",
    },
    prioritySuggestion: {
      title: "추천 우선순위를 확인하세요",
      suggestedQuadrantPrefix: "추천 사분면:",
      fallbackDescription: "지금은 AI를 사용할 수 없어 기본 사분면을 추천했어요.",
      pickQuadrant: "사분면 선택",
      suggestedPropertiesTitle: "활성화된 속성 AI 추천",
      cancel: "취소",
      confirm: "선택한 우선순위 사용",
      confirming: "적용 중...",
    },
    aiRecommend: {
      title: "AI 추천 작업 확인",
      description:
        "추천 내용을 수정한 뒤 생성하거나, 빠른 추가로 바로 생성할 수 있어요.",
      empty: "추천 결과가 없습니다.",
      recommendationPrefix: "추천",
      taskNameLabel: "작업 이름",
      descriptionLabel: "설명",
      labelLabel: "라벨",
      labelPlaceholder: "라벨 선택",
      newLabelOption: "+ 새 라벨",
      newLabelPlaceholder: "새 라벨 이름",
      personaLabel: "페르소나",
      personaPlaceholder: "페르소나 선택",
      noSelection: "선택 안 함",
      newPersonaOption: "+ 새 페르소나",
      newPersonaPlaceholder: "새 페르소나 이름",
      epicLabel: "에픽",
      epicPlaceholder: "에픽 선택",
      newEpicOption: "+ 새 에픽",
      newEpicPlaceholder: "새 에픽 이름",
      storyLabel: "스토리",
      workloadLabel: "작업량 (1-100)",
      close: "닫기",
      quickAdd: "빠른 추가",
      quickAdding: "빠른 추가 중...",
      createSelected: "선택 내용으로 생성",
      creating: "생성 중...",
    },
  },
  suggestions: {
    loadingButtonLabel: "작업 불러오는 중 (AI)",
    buttonLabel: "누락 작업 추천 (AI) 💖",
    noRecommendationsTitle: "추천할 작업이 없습니다",
    noRecommendationsDescription: "현재 정보 기준으로 추가 추천이 없어요.",
    requestFailureTitle: "AI 추천 실패",
    requestFailureDescription: "AI 추천 작업을 불러오지 못했습니다.",
    quickAddSuccessTitle: "⚡ {count}개 작업을 빠르게 추가했어요",
    quickAddEmptyTitle: "빠른 추가 결과가 없습니다",
    quickAddEmptyDescription: "생성할 추천 작업이 없어요.",
    quickAddFailureTitle: "빠른 추가 실패",
    quickAddFailureDescription: "빠른 추가 중 오류가 발생했습니다.",
    noItemsToCreateTitle: "생성할 항목이 없습니다",
    labelNameRequiredTemplate: "{index}번째 추천의 라벨 이름을 입력해 주세요.",
    labelCreateFailureTemplate: "새 라벨 생성에 실패했습니다: {name}",
    personaNameRequiredTemplate:
      "{index}번째 추천의 페르소나 이름을 입력해 주세요.",
    personaCreateFailureTemplate: "새 페르소나 생성에 실패했습니다: {name}",
    epicNameRequiredTemplate: "{index}번째 추천의 에픽 이름을 입력해 주세요.",
    epicCreateFailureTemplate: "새 에픽 생성에 실패했습니다: {name}",
    workloadInvalidTemplate:
      "{index}번째 추천의 workload는 1 이상의 숫자여야 합니다.",
    taskNameRequiredTemplate: "{index}번째 추천의 taskName을 입력해 주세요.",
    missingParentForSubTask: "하위 작업 추천을 위한 부모 작업 ID가 없습니다.",
    missingParentForSubTaskCreation:
      "하위 작업 생성을 위한 부모 작업 ID가 없습니다.",
    createSelectedSuccessTitle: "✅ {count}개 추천 작업을 생성했어요",
    createSelectedFailureTitle: "선택 내용 생성 실패",
    createSelectedFailureDescription:
      "선택 내용으로 작업 생성 중 오류가 발생했습니다.",
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
