"use client";
import { api } from "@/lib/supabase/api";
import { useQuery } from "@/lib/supabase/hooks";
import { AddTaskWrapper } from "../add-tasks/add-task-button";
import CalendarSidebar from "../calendar/calendar-sidebar";
import SmartSchedule from "../calendar/smart-schedule";
import Todos from "../todos/todos";
import { Dot } from "lucide-react";
import moment from "moment";

export default function Today() {
  const featureSettings = useQuery(api.userFeatureSettings.getMySettings);
  const todayTodos = useQuery(api.todos.todayTodos) ?? [];
  const overdueTodos = useQuery(api.todos.overdueTodos) ?? [];
  const isCalendarEnabled = Boolean(featureSettings?.enabledModules?.calendarSync);

  return (
    <div className="xl:px-40">
      <div
        className={
          isCalendarEnabled ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" : "grid gap-6"
        }
      >
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold md:text-2xl">Today</h1>
          </div>
          <div className="flex flex-col gap-1 py-4">
            <p className="font-bold flex text-sm">Overdue</p>
            <Todos items={overdueTodos} />
          </div>
          <AddTaskWrapper />
          <SmartSchedule className="mt-4" />
          <div className="flex flex-col gap-1 py-4">
            <p className="font-bold flex text-sm items-center border-b-2 p-2 border-gray-100">
              {moment(new Date()).format("LL")}
              <Dot />
              Today
              <Dot />
              {moment(new Date()).format("dddd")}
            </p>
            <Todos items={todayTodos} />
          </div>
        </div>
        {isCalendarEnabled && <CalendarSidebar />}
      </div>
    </div>
  );
}
