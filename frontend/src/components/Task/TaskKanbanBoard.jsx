import React, { useEffect, useState, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MoreVertical,
  Calendar,
  Clock,
  Edit,
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  User,
} from "lucide-react";
import toast from "react-hot-toast";

// ============================================================================
// 1. PIXEL-PERFECT CARD COMPONENT FOR TASKS
// ============================================================================
const TaskKanbanCard = ({ task, isDragging, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);

  // Helper to format date
  const formatDate = (dateString) => {
    if (!dateString) return "No Date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  // Helper for priority color (if task has priority)
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-50 text-red-600 border-red-100";
      case "medium":
        return "bg-yellow-50 text-yellow-600 border-yellow-100";
      case "low":
        return "bg-green-50 text-green-600 border-green-100";
      default:
        return "bg-gray-50 text-gray-500 border-gray-100";
    }
  };

  return (
    <div
      className={`relative bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group text-left ${
        isDragging ? "opacity-50" : "opacity-100"
      }`}
    >
      {/* --- Top Row: Title & Actions --- */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-bold text-gray-900 text-[14px] leading-tight flex-1 mr-2">
          {task.title}
        </h4>

        {/* --- 3 Dots Menu --- */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-[99]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 top-6 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-[100] overflow-hidden py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit && onEdit(task);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete && onDelete(task);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* --- Middle Row: Description (Truncated) --- */}
      {task.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* --- Badges/Tags --- */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span
          className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getPriorityColor(task.priority)}`}
        >
          {task.priority || "Normal"}
        </span>
        {task.relatedTo && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded border border-blue-100 max-w-[120px] truncate">
            Related: {task.relatedTo?.name || "Entity"}
          </span>
        )}
      </div>

      {/* --- Bottom Row: Date & Assignee --- */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span
                className={
                  new Date(task.dueDate) < new Date()
                    ? "text-red-500 font-medium"
                    : ""
                }
              >
                {formatDate(task.dueDate)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center -space-x-1.5">
          {/* Assignee Avatars (Mockup logic or real user) */}
          {task.users && task.users.length > 0 ? (
            task.users.map((u, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-blue-100 border border-white text-[10px] flex items-center justify-center text-blue-700 font-bold"
                title={u.name || "User"}
              >
                {u.name ? (
                  u.name.charAt(0).toUpperCase()
                ) : (
                  <User className="w-3 h-3" />
                )}
              </div>
            ))
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-100 border border-white flex items-center justify-center text-gray-400">
              <User className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. HELPER: HEADER PILL STYLES
// ============================================================================
const getHeaderStyle = (columnName) => {
  const normalized = columnName?.toLowerCase() || "";

  if (normalized.includes("pending") || normalized.includes("todo")) {
    return "bg-[#FEF3C7] text-[#D97706]"; // Amber/Yellow
  }
  if (normalized.includes("progress")) {
    return "bg-[#EFF6FF] text-[#2563EB]"; // Blue
  }
  if (normalized.includes("completed") || normalized.includes("done")) {
    return "bg-[#ECFDF5] text-[#059669]"; // Green
  }
  if (normalized.includes("cancel") || normalized.includes("fail")) {
    return "bg-[#FEF2F2] text-[#DC2626]"; // Red
  }

  return "bg-gray-100 text-gray-700";
};

// ============================================================================
// 3. INTERNAL COMPONENTS
// ============================================================================

const SortableItem = ({ item, itemIdKey, renderItemWrapper, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: item[itemIdKey].toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {renderItemWrapper(item, isSortableDragging || isDragging)}
    </div>
  );
};

const DroppableColumn = ({
  column,
  items,
  itemIdKey,
  renderItemWrapper,
  onAddTask, // Renamed from onAddContact
  isDragging,
  isLast,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const columnItems = items.filter((item) => item.column === column);
  const itemIds = columnItems.map((item) => item[itemIdKey].toString());

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-shrink-0 ${isOver ? "bg-gray-50" : "bg-white"}`}
      style={{
        boxSizing: "border-box",
        width: 340,
        border: "1px solid #E7E7E9",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* --- Column Header --- */}
      <div
        className="flex flex-row items-center justify-between flex-shrink-0"
        style={{
          boxSizing: "border-box",
          padding: "0px 18px",
          gap: 6,
          width: 340,
          height: 46,
          background: "#F5F7FA",
        }}
      >
        <div className="flex flex-row items-center gap-2 flex-1 min-w-0">
          <span
            className="truncate"
            style={{
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 12,
              lineHeight: "15px",
              letterSpacing: "-0.02em",
              color: "#44444A",
            }}
          >
            {column}
          </span>
          <div
            className="flex flex-row justify-center items-center flex-shrink-0"
            style={{
              boxSizing: "border-box",
              padding: "5px 8px",
              minWidth: 22,
              height: 22,
              background: "#FFFFFF",
              border: "1px solid #E5E5EC",
              boxShadow: "0px 1px 2px rgba(82, 88, 102, 0.06)",
              borderRadius: 20,
            }}
          >
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: 12,
                lineHeight: "15px",
                textAlign: "center",
                letterSpacing: "-0.02em",
                color: "#161618",
              }}
            >
              {columnItems.length}
            </span>
          </div>
        </div>
        <button
          onClick={() => onAddTask && onAddTask(column)}
          className="flex-shrink-0"
          style={{ width: 16, height: 16 }}
        >
          <MoreVertical className="w-4 h-4" style={{ color: "#BEBEC8" }} />
        </button>
      </div>

      <div style={{ width: "100%", height: 1, background: "#E7E7E9", flexShrink: 0 }} />

      {/* --- Cards List --- */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar"
        style={{
          boxSizing: "border-box",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minHeight: 200,
        }}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {columnItems.map((item) => (
            <SortableItem
              key={item[itemIdKey]}
              item={item}
              itemIdKey={itemIdKey}
              renderItemWrapper={renderItemWrapper}
              isDragging={isDragging}
            />
          ))}
        </SortableContext>

        {columnItems.length === 0 && !isDragging && (
          <div className="h-32 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-sm select-none">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 4. MAIN BOARD EXPORT
// ============================================================================

const TaskKanbanBoard = ({
  columns,
  items,
  getItemColumn,
  onItemMove,
  onCardEdit,
  onCardDelete,
  onAddTask,
  renderItem,
  itemIdKey = "_id",
}) => {
  const [activeItem, setActiveItem] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = ({ active }) => {
    const item = items.find(
      (i) => i[itemIdKey].toString() === active.id.toString(),
    );
    setActiveItem(item);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveItem(null);
    if (!over) return;

    const itemId = active.id.toString();
    const overId = over.id.toString();
    let newColumn = overId;

    // Check if dropped on an item
    const droppedOnItem = items.find((i) => i[itemIdKey].toString() === overId);
    if (droppedOnItem) {
      newColumn = getItemColumn(droppedOnItem);
    }

    const item = items.find((i) => i[itemIdKey].toString() === itemId);
    if (!item) return;

    const oldColumn = getItemColumn(item);
    if (oldColumn !== newColumn) {
      await onItemMove(itemId, newColumn, oldColumn);
    }
  };

  const itemsWithColumn = items.map((item) => ({
    ...item,
    column: getItemColumn(item),
  }));

  const renderWrapper = (item, isDragging) => {
    if (renderItem) return renderItem(item, isDragging);
    return (
      <TaskKanbanCard
        task={item}
        isDragging={isDragging}
        onEdit={onCardEdit}
        onDelete={onCardDelete}
      />
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full w-full overflow-x-auto overflow-y-hidden bg-white">
        <div className="flex h-full min-w-max gap-4 p-4 items-start">
          {columns.map((col, index) => (
            <DroppableColumn
              key={col}
              column={col}
              items={itemsWithColumn}
              itemIdKey={itemIdKey}
              renderItemWrapper={renderWrapper}
              onAddTask={onAddTask}
              isDragging={!!activeItem}
              isLast={index === columns.length - 1} // Logic to hide last border
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeItem ? (
          <div style={{ width: "350px" }}>
            {renderWrapper(activeItem, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default TaskKanbanBoard;
