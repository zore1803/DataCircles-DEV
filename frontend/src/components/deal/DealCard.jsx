import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DealCard = ({
  deal,
  permission,
  navigate,
  handleEditDeal,
  handleDeleteDeal,
  isStale,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal._id.toString(),
    disabled: permission !== "read-write",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
          navigate(`/deals/${deal._id}`);
        }
      }}
      className={`group relative bg-white p-3 rounded-lg shadow-sm border hover:shadow-md cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "shadow-lg scale-105 z-50 ring-2 ring-blue-400" : ""
      } ${
        isStale(deal.createdAt)
          ? "border-l-4 border-red-400 bg-red-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* Action Buttons - Top Right */}
      {permission === "read-write" && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditDeal(deal);
            }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit deal"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteDeal(deal._id);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete deal"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      )}

      {/* Deal Title */}
      <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2 pr-16">
        {deal.title}
      </p>

<div className="flex justify-between items-center gap-2">
      {/* Company Info (if exists) */}
      {deal.company && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
          </svg>
          <span className="truncate">{deal.company.name}</span>
        </div>
      )}
  
      {/* Amount */}
      <div className="flex items-center gap-1">
        <span className="text-sm font-bold text-green-600">
         <h6>₹{parseInt(deal.amount || 0).toLocaleString('en-IN')}</h6>
        </span>
      </div>


      
</div>
    </div>
  );
};

export default DealCard;
