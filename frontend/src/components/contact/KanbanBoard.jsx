// import React, { useEffect, useState, useRef } from "react";
// import {
//   DndContext,
//   DragOverlay,
//   closestCorners,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   useDroppable,
// } from "@dnd-kit/core";
// import {
//   SortableContext,
//   sortableKeyboardCoordinates,
//   verticalListSortingStrategy,
//   useSortable,
// } from "@dnd-kit/sortable";
// import { CSS } from "@dnd-kit/utilities";
// import { useNavigate } from "react-router-dom";

// // Sortable Item Wrapper Component
// const SortableItem = ({
//   item,
//   itemIdKey,
//   renderItem,
//   permission,
//   navigate,
//   isDragging,
// }) => {
//   const {
//     attributes,
//     listeners,
//     setNodeRef,
//     transform,
//     transition,
//     isDragging: isSortableDragging,
//   } = useSortable({
//     id: item[itemIdKey].toString(),
//     disabled: permission !== "read-write",
//   });

//   const style = {
//     transform: CSS.Transform.toString(transform),
//     transition,
//     opacity: isSortableDragging ? 0.5 : 1,
//   };

//   return (
//     <div
//       ref={setNodeRef}
//       style={style}
//       {...attributes}
//       {...listeners}
//       onClick={() => {
//         if (!isSortableDragging) {
//           navigate(`/${itemIdKey}s/${item[itemIdKey]}`);
//         }
//       }}
//     >
//       {renderItem(item, isSortableDragging || isDragging)}
//     </div>
//   );
// };

// // Droppable Column Component
// const DroppableColumn = ({
//   column,
//   items,
//   getColumnColor,
//   getBadgeColor,
//   getColumnTotal,
//   itemIdKey,
//   renderItem,
//   permission,
//   navigate,
//   isDragging,
// }) => {
//   const { setNodeRef, isOver } = useDroppable({
//     id: column,
//   });

//   const columnItems = items.filter((item) => item.column === column);
//   const itemIds = columnItems.map((item) => item[itemIdKey].toString());

//   const getStatusTotal = () => {
//     if (!getColumnTotal) return null;
//     return getColumnTotal(column, columnItems);
//   };

//   return (
//     <div
//       ref={setNodeRef}
//       className={`rounded-xl shadow-md border-2 transition-all duration-200 flex-shrink-0 flex flex-col ${
//         isOver
//           ? "border-blue-500 bg-blue-50 shadow-lg"
//           : "border-gray-200 bg-white"
//       }`}
//       style={{
//         width: "320px",
//         minWidth: "320px",
//       }}
//     >
//       {/* Sticky Column Header */}
//       <div
//         className={`sticky top-0 px-4 py-3 border-b ${
//           isOver ? "border-blue-500 bg-blue-100" : "border-gray-200 bg-white"
//         } rounded-t-lg z-10 transition-colors`}
//       >
//         <div className="flex items-center justify-between mb-2">
//           <div className="flex items-center gap-2">
//             <h3 className="font-semibold text-gray-900 text-sm">{column}</h3>
//             <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
//               {columnItems.length}
//             </span>
//           </div>
//         </div>
//         <div
//           className={`h-1.5 rounded-full w-full ${getBadgeColor(column)}`}
//         ></div>
//       </div>

//       {/* Cards Container */}
//       <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
//         <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
//           {columnItems.map((item) => (
//             <SortableItem
//               key={item[itemIdKey]}
//               item={item}
//               itemIdKey={itemIdKey}
//               renderItem={renderItem}
//               permission={permission}
//               navigate={navigate}
//               isDragging={isDragging}
//             />
//           ))}
//         </SortableContext>

//         {columnItems.length === 0 && (
//           <div className="text-center text-gray-400 mt-8 p-4 border-2 border-dashed border-gray-300 rounded-lg">
//             <p className="text-sm">Drop contacts here</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// const KanbanBoard = ({
//   columns,
//   items,
//   getItemColumn,
//   renderItem,
//   onItemMove,
//   getColumnColor,
//   getBadgeColor,
//   getColumnTotal, // Optional
//   permission = "read-write",
//   itemIdKey = "_id",
// }) => {
//   const [autoScrollSpeed, setAutoScrollSpeed] = useState(0);
//   const scrollContainerRef = useRef(null);
//   const navigate = useNavigate();
//   const [activeItem, setActiveItem] = useState(null);

//   // dnd-kit sensors configuration
//   const sensors = useSensors(
//     useSensor(PointerSensor, {
//       activationConstraint: {
//         distance: 8, // 8px movement required before drag starts
//       },
//     }),
//     useSensor(KeyboardSensor, {
//       coordinateGetter: sortableKeyboardCoordinates,
//     }),
//   );

//   useEffect(() => {
//     let animationFrame;

//     if (autoScrollSpeed !== 0 && scrollContainerRef.current) {
//       const scroll = () => {
//         scrollContainerRef.current.scrollLeft += autoScrollSpeed;
//         animationFrame = requestAnimationFrame(scroll);
//       };
//       animationFrame = requestAnimationFrame(scroll);
//     }

//     return () => {
//       if (animationFrame) {
//         cancelAnimationFrame(animationFrame);
//       }
//     };
//   }, [autoScrollSpeed]);

//   const handleMouseMove = (e) => {
//     if (!scrollContainerRef.current) return;

//     const containerRect = scrollContainerRef.current.getBoundingClientRect();
//     const scrollZone = 100;
//     const maxScrollSpeed = 35;

//     const distanceFromLeft = e.clientX - containerRect.left;
//     const distanceFromRight = containerRect.right - e.clientX;

//     if (
//       distanceFromLeft < scrollZone &&
//       scrollContainerRef.current.scrollLeft > 0
//     ) {
//       const speed = Math.max(
//         3,
//         ((scrollZone - distanceFromLeft) / scrollZone) * maxScrollSpeed,
//       );
//       setAutoScrollSpeed(-speed);
//     } else if (
//       distanceFromRight < scrollZone &&
//       scrollContainerRef.current.scrollLeft <
//         scrollContainerRef.current.scrollWidth -
//           scrollContainerRef.current.clientWidth
//     ) {
//       const speed = Math.max(
//         3,
//         ((scrollZone - distanceFromRight) / scrollZone) * maxScrollSpeed,
//       );
//       setAutoScrollSpeed(speed);
//     } else {
//       setAutoScrollSpeed(0);
//     }
//   };

//   const handleMouseLeave = () => {
//     setAutoScrollSpeed(0);
//   };

//   const handleDragStart = (event) => {
//     const { active } = event;
//     const item = items.find(
//       (i) => i[itemIdKey].toString() === active.id.toString(),
//     );
//     setActiveItem(item);
//   };

//   const handleDragEnd = async (event) => {
//     const { active, over } = event;

//     setActiveItem(null);
//     setAutoScrollSpeed(0);

//     if (!over) {
//       console.log("Dropped outside droppable area");
//       return;
//     }

//     if (permission !== "read-write") {
//       alert("You do not have permission to update.");
//       return;
//     }

//     const itemId = active.id.toString();
//     let newColumn = over.id.toString();

//     // Check if dropped on another item or a column
//     const droppedOnItem = items.find(
//       (i) => i[itemIdKey].toString() === newColumn,
//     );
//     if (droppedOnItem) {
//       // Dropped on an item, use that item's column
//       newColumn = getItemColumn(droppedOnItem);
//       console.log(`Dropped on item, using its column: ${newColumn}`);
//     }

//     // Find the item being moved
//     const item = items.find((i) => i[itemIdKey].toString() === itemId);
//     if (!item) return;

//     const oldColumn = getItemColumn(item);

//     // If dropped in the same column, do nothing
//     if (oldColumn === newColumn) {
//       console.log("Dropped in same column");
//       return;
//     }

//     console.log(`Moving item from ${oldColumn} to ${newColumn}`);

//     try {
//       await onItemMove(itemId, newColumn, oldColumn);
//     } catch (error) {
//       console.error("Error moving item:", error);
//       // Revert would be handled by caller if needed
//     }
//   };

//   // Transform items to include column for easy filtering
//   const itemsWithColumn = items.map((item) => ({
//     ...item,
//     column: getItemColumn(item),
//   }));

//   return (
//     <DndContext
//       sensors={sensors}
//       collisionDetection={closestCorners}
//       onDragStart={handleDragStart}
//       onDragEnd={handleDragEnd}
//     >
//       <div
//         ref={scrollContainerRef}
//         className="overflow-x-auto overflow-y-hidden p-4 sm:p-6 bg-white rounded-lg"
//         onMouseMove={handleMouseMove}
//         onMouseLeave={handleMouseLeave}
//         style={{
//           scrollbarWidth: "thin",
//           scrollbarColor: "#CBD5E0 #EDF2F7",
//         }}
//       >
//         <div
//           className="flex gap-6 min-w-max"
//           style={{
//             minWidth: `${columns.length * 340}px`,
//           }}
//         >
//           {columns.map((column) => (
//             <DroppableColumn
//               key={column}
//               column={column}
//               items={itemsWithColumn}
//               getColumnColor={getColumnColor}
//               getBadgeColor={getBadgeColor}
//               getColumnTotal={getColumnTotal}
//               itemIdKey={itemIdKey}
//               renderItem={renderItem}
//               permission={permission}
//               navigate={navigate}
//               isDragging={!!activeItem}
//             />
//           ))}
//         </div>
//       </div>

//       <DragOverlay>
//         {activeItem ? (
//           <div style={{ width: "320px" }}>{renderItem(activeItem, true)}</div>
//         ) : null}
//       </DragOverlay>

//       <div className="flex justify-center mt-3 text-xs text-gray-500 pb-2">
//         <span className="text-gray-400">
//           ← Scroll horizontally to see more columns →
//         </span>
//       </div>
//     </DndContext>
//   );
// };

// export default KanbanBoard;

import React, { useEffect, useState } from "react";
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
import { MoreVertical, Phone, Mail, Edit, Trash2, Plus } from "lucide-react";

// ============================================================================
// 1. PIXEL-PERFECT CARD COMPONENT
// ============================================================================
const KanbanCard = ({ contact, isDragging, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`relative bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group text-left ${isDragging ? "opacity-50" : "opacity-100"
        }`}
    >
      {/* --- Top Row: Avatar & Name --- */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 w-full overflow-hidden">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-100 overflow-hidden flex-shrink-0">
            <img
              src={
                contact.avatar ||
                `https://ui-avatars.com/api/?name=${contact.name}&background=random`
              }
              alt="avatar"
              className="w-full h-full object-cover"
            />
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 text-[14px] leading-tight truncate">
              {contact.name}
            </h4>
            <p className="text-[11px] text-gray-500 truncate mt-1">
              {contact.company || "No Company"}
            </p>
          </div>
        </div>

        {/* --- 3 Dots Menu --- */}
        <div className="relative flex-shrink-0 ml-1">
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
                    onEdit && onEdit(contact);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete && onDelete(contact);
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

      {/* --- Middle Row: Tags (Exact Backgrounds) --- */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Blue Tint Tag */}
        <span className="px-2.5 py-1 bg-[#EFF6FF] text-[#3B82F6] text-[10px] font-semibold rounded-md">
          Recent Interaction
        </span>
        {/* Gray Tint Tag */}
        <span className="px-2.5 py-1 bg-[#F3F4F6] text-[#4B5563] text-[10px] font-semibold rounded-md">
          Title 01
        </span>
      </div>

      {/* --- Bottom Row: Contact Details --- */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5 text-gray-500">
          <Mail className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          <span className="text-[11px] font-medium truncate">
            {contact.email}
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-gray-500">
          <Phone className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          <span className="text-[11px] font-medium">{contact.phone}</span>
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

  if (normalized.includes("new") || normalized.includes("lead")) {
    return "bg-[#EFF6FF] text-[#2563EB]"; // Blue
  }
  if (normalized.includes("contact")) {
    return "bg-[#FEF3C7] text-[#D97706]"; // Amber/Yellow
  }
  if (normalized.includes("interest")) {
    return "bg-[#ECFEFF] text-[#0891B2]"; // Cyan
  }
  if (normalized.includes("won") || normalized.includes("qualified")) {
    return "bg-[#F3E8FF] text-[#9333EA]"; // Purple
  }
  if (normalized.includes("un-qualified") || normalized.includes("lost")) {
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
  onAddContact,
  isDragging,
  isLast, // Helper to remove border on last column
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const columnItems = items.filter((item) => item.column === column);
  const itemIds = columnItems.map((item) => item[itemIdKey].toString());

  return (
    <div
      ref={setNodeRef}
      className={`h-full flex flex-col flex-shrink-0 px-4 ${isOver ? "bg-gray-50" : "bg-white"
        } ${!isLast ? "border-r border-gray-100" : ""}`} // Add divider line
      style={{ width: "350px" }} // Slightly wider columns
    >
      {/* --- Column Header (Pill Style) --- */}
      <div className="py-4 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1.5 rounded-md text-xs font-bold ${getHeaderStyle(column)}`}
          >
            {column}
          </span>
          <span className="text-sm font-medium text-gray-500">
            {columnItems.length}
          </span>
        </div>
        <button
          onClick={() => onAddContact && onAddContact(column)}
          className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* --- Cards List --- */}
      <div className="flex-1 overflow-y-auto pb-4 space-y-4 pr-2 custom-scrollbar">
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

const KanbanBoard = ({
  columns,
  items,
  getItemColumn,
  onItemMove,
  onCardEdit,
  onCardDelete,
  onAddContact,
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
      <KanbanCard
        contact={item}
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
      <div className="h-full w-full overflow-x-auto overflow-y-visible bg-white">
        <div className="flex h-full min-w-max">
          {columns.map((col, index) => (
            <DroppableColumn
              key={col}
              column={col}
              items={itemsWithColumn}
              itemIdKey={itemIdKey}
              renderItemWrapper={renderWrapper}
              onAddContact={onAddContact}
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

export default KanbanBoard;