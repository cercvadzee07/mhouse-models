"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

/** Drag-to-reorder list/grid (mouse, touch and keyboard: Space to lift, arrows to move). */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  layout = "grid",
  className,
  children,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  layout?: "grid" | "list";
  className?: string;
  children: (item: T, handle: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined; dragging: boolean }) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {(handle) => children(item, handle)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (h: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined; dragging: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, position: "relative" }}
      className={isDragging ? "opacity-80" : ""}
    >
      {children({ attributes: attributes as unknown as Record<string, unknown>, listeners: listeners as Record<string, unknown> | undefined, dragging: isDragging })}
    </div>
  );
}

export function DragHandle({ handle, label = "Drag to reorder" }: { handle: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...handle.attributes}
      {...handle.listeners}
      className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md text-black/45 hover:bg-black/5 hover:text-black active:cursor-grabbing"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
        <circle cx="5.5" cy="3.5" r="1.2" />
        <circle cx="10.5" cy="3.5" r="1.2" />
        <circle cx="5.5" cy="8" r="1.2" />
        <circle cx="10.5" cy="8" r="1.2" />
        <circle cx="5.5" cy="12.5" r="1.2" />
        <circle cx="10.5" cy="12.5" r="1.2" />
      </svg>
    </button>
  );
}
