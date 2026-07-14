// components/deal/KanbanColumn.jsx
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DealCard from './DealCard';
import { TrendingUp, Package } from 'lucide-react';

const KanbanColumn = ({
  status,
  deals,
  getColumnColor,
  getStatusBadgeColor,
  getStatusTotal,
  filteredDeals,
  permission,
  navigate,
  handleEditDeal,
  handleDeleteDeal,
  isStale,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      className={`flex-shrink-0 min-w-[270px] ${getColumnColor(status)} rounded-xl border-2 shadow-sm transition-all duration-200 ${
        isOver ? 'ring-2 ring-blue-400 scale-[1.01]' : ''
      } flex flex-col`}
      style={{ height: 'calc(100vh - 200px)' }}
    >
      {/* Column Header */}
      <div className="bg-white/80 backdrop-blur-sm px-3 py-2.5 rounded-t-xl border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 text-sm">{status}</h3>
          <span className={`${getStatusBadgeColor(status)} px-2 py-0.5 rounded-full text-xs font-semibold`}>
            {deals.length} / {filteredDeals.length}
          </span>
        </div>
        
        {/* Total Amount */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded">
          <TrendingUp className="w-3 h-3 text-green-600" />
          <h6>₹{getStatusTotal(status).toLocaleString('en-IN')}</h6>
        </div>
      </div>

      {/* Deals List - Droppable Area */}
      <div 
        ref={setNodeRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-2.5"
        style={{ 
          minHeight: '200px',
        }}
      >
        <SortableContext items={deals.map((d) => d._id)} strategy={verticalListSortingStrategy}>
          {deals.length > 0 ? (
            <div className="space-y-2">
              {deals.map((deal) => (
                <DealCard
                  key={deal._id}
                  deal={deal}
                  permission={permission}
                  navigate={navigate}
                  handleEditDeal={handleEditDeal}
                  handleDeleteDeal={handleDeleteDeal}
                  isStale={isStale}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full w-full text-center pointer-events-none" style={{ minHeight: '300px' }}>
              <Package className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-gray-400 text-xs">
                {isOver ? 'Drop here' : 'No deals'}
              </p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;
