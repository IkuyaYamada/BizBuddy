import { useState } from 'react'
import { Tab } from '@headlessui/react'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

const tabs = [
  { name: 'タスク', id: 'tasks' },
  { name: 'メモ', id: 'notes' },
  { name: '時計', id: 'timer' },
  { name: 'マインドマップ', id: 'mindmap' },
  { name: 'プロトタイプ', id: 'prototype' },
]

export default function Tabs({ children }: { children: React.ReactNode }) {
  const [selectedTab, setSelectedTab] = useState(0)

  return (
    <div className="w-full">
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              className={({ selected }) =>
                classNames(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'bg-white shadow text-blue-700'
                    : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                )
              }
            >
              {tab.name}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className="mt-2">
          {children}
        </Tab.Panels>
      </Tab.Group>
    </div>
  )
} 