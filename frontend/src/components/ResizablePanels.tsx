'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ReactNode, useEffect, useState, Children } from 'react';

interface ResizablePanelsProps {
  children: ReactNode;
  defaultLayout?: number[];
}

export default function ResizablePanels({ children, defaultLayout = [50, 50] }: ResizablePanelsProps) {
  const [layout, setLayout] = useState<number[]>(defaultLayout);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedLayout = localStorage.getItem('panelLayout');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        setLayout(parsed);
      } catch (e) {
        console.error('Failed to parse saved layout:', e);
      }
    }
  }, []);

  const savePanelLayout = (sizes: number[]) => {
    localStorage.setItem('panelLayout', JSON.stringify(sizes));
    setLayout(sizes);
  };

  if (!isClient) {
    return (
      <div className="w-full h-full flex">
        {Children.map(children, (child, index) => (
          <div key={index} style={{ flex: defaultLayout[index] }}>
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={savePanelLayout}
      autoSaveId="panel-layout"
    >
      {children}
    </PanelGroup>
  );
} 