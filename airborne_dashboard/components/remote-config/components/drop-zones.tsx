"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { FolderOpen, Folder } from "lucide-react";

// Root drop zone component
export function RootDropZone({ children, isActive }: { children: React.ReactNode; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "root-drop-zone",
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[250px] p-6 rounded-lg transition-all duration-200 ${
        isActive || isOver
          ? "bg-blue-50 dark:bg-blue-950 border-2 border-dashed border-blue-300 dark:border-blue-600"
          : "bg-gray-50/50 dark:bg-gray-800/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
      }`}
    >
      {children}
      {(isOver || isActive) && (
        <div className="flex items-center justify-center p-10 text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/50 rounded-lg mt-6 border-2 border-dashed border-blue-300 dark:border-blue-600">
          <div className="text-center">
            <FolderOpen className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm font-medium">Drop here to move to root level</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Drop zone for nested fields
export function NestedDropZone({
  parentId,
  isActive,
  children,
  isInvalid = false,
}: {
  parentId: string;
  isActive: boolean;
  children?: React.ReactNode;
  isInvalid?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-zone-${parentId}`,
  });

  const isInvalidDrop = isInvalid && isOver;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] transition-all duration-200 ${
        isInvalidDrop
          ? "bg-red-50 dark:bg-red-950 border-2 border-dashed border-red-300 dark:border-red-600 rounded-lg p-4"
          : isActive || isOver
            ? "bg-green-50 dark:bg-green-950 border-2 border-dashed border-green-300 dark:border-green-600 rounded-lg p-4"
            : "min-h-0"
      }`}
    >
      {children}
      {(isOver || isActive) && !children && (
        <div
          className={`flex items-center justify-center p-6 ${
            isInvalidDrop ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
          }`}
        >
          <div className="text-center">
            {isInvalidDrop ? (
              <>
                <Folder className="h-6 w-6 mx-auto mb-1" />
                <p className="text-xs font-medium">⚠️ Invalid drop target</p>
              </>
            ) : (
              <>
                <Folder className="h-6 w-6 mx-auto mb-1" />
                <p className="text-xs font-medium">Drop here to add as child field</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
