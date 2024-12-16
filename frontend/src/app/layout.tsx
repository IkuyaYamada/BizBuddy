"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import NavigationBar from "@/components/NavigationBar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');

      // ホームへの移動
      if (e.ctrlKey && (isMac ? !e.altKey : e.altKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        e.stopPropagation();
        router.push('/');
      }

      // メモへの移動
      if (e.ctrlKey && (isMac ? !e.altKey : e.altKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        e.stopPropagation();
        router.push('/memo');
      }

      // 階層型タスクへの移動
      if (e.ctrlKey && (isMac ? !e.altKey : e.altKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        router.push('/hierarchical');
      }

      // 本日のタスクへの移動
      if (e.ctrlKey && (isMac ? !e.altKey : e.altKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        e.stopPropagation();
        router.push('/daily');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [router]);

  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <NavigationBar />
          {/* メインコンテンツ */}
          <main className="max-w-7xl mx-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
