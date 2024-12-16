import React from 'react';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Task } from '@/types/task';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface TaskCalendarViewProps {
  tasks: Task[];
  viewMode: 'week' | 'month';
  onViewModeChange: (mode: 'week' | 'month') => void;
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
  tasks,
  viewMode,
  onViewModeChange,
}) => {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // 表示期間の計算
  const getDateRange = () => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { locale: ja }),
        end: endOfWeek(currentDate, { locale: ja }),
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }
  };

  const { start, end } = getDateRange();
  const days = eachDayOfInterval({ start, end });

  // 期間の移動
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    }
  };

  // タスクの開始日と終了日を取得（仮実装）
  const getTaskDates = (task: Task) => {
    // この部分は実際のデータ構造に合わせて実装する必要があります
    return {
      start: new Date(task.created_at),
      end: new Date(task.last_updated),
    };
  };

  return (
    <div className="h-full bg-white">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium text-gray-900">
            {viewMode === 'week' ? '週間' : '月間'}ガントチャート
          </h2>
          <div className="flex rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => onViewModeChange('week')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              週
            </button>
            <button
              onClick={() => onViewModeChange('month')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              月
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNavigate('prev')}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-900">
            {format(currentDate, viewMode === 'week' ? 'yyyy年M月 第w週' : 'yyyy年M月', { locale: ja })}
          </span>
          <button
            onClick={() => handleNavigate('next')}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="relative h-[calc(100%-4rem)] overflow-auto">
        {/* 日付ヘッダー */}
        <div className="sticky top-0 z-10 flex border-b bg-gray-50">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex-1 min-w-[100px] p-2 text-center text-sm font-medium text-gray-600 border-r"
            >
              {format(day, 'M/d (E)', { locale: ja })}
            </div>
          ))}
        </div>

        {/* タスクバー */}
        <div className="relative">
          {tasks.map((task) => {
            const taskDates = getTaskDates(task);
            const startIndex = days.findIndex(
              (day) => format(day, 'yyyy-MM-dd') === format(taskDates.start, 'yyyy-MM-dd')
            );
            const endIndex = days.findIndex(
              (day) => format(day, 'yyyy-MM-dd') === format(taskDates.end, 'yyyy-MM-dd')
            );
            const width = `${((endIndex - startIndex + 1) * 100) / days.length}%`;
            const left = `${(startIndex * 100) / days.length}%`;

            return (
              <div
                key={task.id}
                className="relative h-10 border-b flex items-center px-4"
              >
                <div className="w-full relative">
                  <div
                    className="absolute h-6 rounded-full bg-indigo-100 border border-indigo-200"
                    style={{ left, width }}
                  >
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-sm text-indigo-700 truncate">
                        {task.title}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}; 