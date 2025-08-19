import React, { useState, useEffect, useRef } from 'react';
import { Resizable } from 're-resizable';
import { useDrag } from 'react-dnd';

// Define ItemTypes locally since the module is missing
const ItemTypes = {
  TABLE: 'table'
};

/**
 * Table component for rendering tables in the layout editor
 * @param {Object} props - Component props
 * @param {string} props.id - Table ID
 * @param {string} props.name - Table name
 * @param {number} props.x - X position
 * @param {number} props.y - Y position
 * @param {number} props.width - Width
 * @param {number} props.height - Height
 * @param {number} props.rotation - Rotation in degrees
 * @param {string} props.status - Table status
 * @param {boolean} props.isSelected - Whether the table is selected
 * @param {Function} props.onClick - Click handler
 * @param {Function} props.onUpdate - Update handler
 * @param {Function} props.onDragEnd - Drag end handler
 * @param {string} [props.shape='rectangle'] - Table shape
 * @param {number} [props.capacity=4] - Table capacity
 * @param {string} [props.type='regular'] - Table type (regular, billiard, bar)
 * @param {string} [props.floor='interno'] - Floor location (interno, terraza)
 * @param {number} [props.scale=1] - Canvas scale factor
 * @param {DOMRect|null} [props.containerRect=null] - Container bounding rect
 * @param {number} [props.layoutWidth] - Layout width for clamping
 * @param {number} [props.layoutHeight] - Layout height for clamping
 */
const Table = ({
  id,
  name,
  x,
  y,
  width,
  height,
  rotation,
  status,
  isSelected,
  onClick,
  onUpdate,
  onDragEnd,
  shape = 'rectangle',
  capacity = 4,
  type = 'regular',
  floor = 'interno',
  scale = 1,
  containerRect = null,
  layoutWidth,
  layoutHeight,
}) => {

  // Resize state tracking
  const [_isResizing, setIsResizing] = useState(false); // Prefixed with underscore to indicate it's intentionally unused
  const [dimensions, setDimensions] = useState(floor === 'interno' || type === 'billiard' || type === 'bar' ? { width: type === 'billiard' ? 180 : type === 'bar' ? 80 : width, height: type === 'billiard' ? 90 : type === 'bar' ? 80 : height } : { width, height });
  const [position, setPosition] = useState({ x, y });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 }); // offset within the table at mousedown, in layout coords

  // Update local state when props change
  useEffect(() => {

    setDimensions(floor === 'interno' || type === 'billiard' || type === 'bar' ? { width: type === 'billiard' ? 180 : type === 'bar' ? 80 : width, height: type === 'billiard' ? 90 : type === 'bar' ? 80 : height } : { width, height });
  }, [width, height, type, floor]);

  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  // Set up drag and drop
  const [{ isDraggingItem }, drag] = useDrag(() => ({
    type: ItemTypes.TABLE,
    item: { id, type: ItemTypes.TABLE },
    collect: (monitor) => ({
      isDraggingItem: !!monitor.isDragging(),
    }),
  }));

  /**
   * Handle mouse down event
   * @param {React.MouseEvent} e - Mouse event
   */
  const handleMouseDown = (e) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    e.stopPropagation();
    setIsDragging(true);
    
    // Store initial offset within the table in layout coordinates
    if (containerRect) {
      const cx = (e.clientX - containerRect.left) / scale;
      const cy = (e.clientY - containerRect.top) / scale;
      dragStartPos.current = {
        x: cx - position.x,
        y: cy - position.y,
      };
    } else {
      dragStartPos.current = { x: 0, y: 0 };
    }
  };

  /**
   * Handle click event
   * @param {React.MouseEvent} e - Click event
   */
  const handleClick = (e) => {
    e.stopPropagation();
    
    const clickTimer = setTimeout(() => {
      if (!isDragging) {
        onClick(e);
      }
    }, 100);
    
    return () => clearTimeout(clickTimer);
  };

  /**
   * Handle mouse move DOM event
   * @param {MouseEvent} e - DOM mouse event
   */
  const handleMouseMoveDOM = (e) => {
    if (!isDragging) return;
    if (!containerRect) return;
    const cx = (e.clientX - containerRect.left) / scale;
    const cy = (e.clientY - containerRect.top) / scale;
    let newX = cx - dragStartPos.current.x;
    let newY = cy - dragStartPos.current.y;
    // Clamp to layout bounds if provided
    if (typeof layoutWidth === 'number' && typeof layoutHeight === 'number') {
      newX = Math.max(0, Math.min(layoutWidth - dimensions.width, newX));
      newY = Math.max(0, Math.min(layoutHeight - dimensions.height, newY));
    }
    setPosition({ x: newX, y: newY });
  };
  
  /**
   * Handle mouse up DOM event
   */
  const handleMouseUpDOM = () => {
    if (isDragging) {
      setIsDragging(false);
      // If react-dnd is handling the drag, let the parent drop handler save.
      if (!isDraggingItem) {
        let newX = position.x;
        let newY = position.y;
        if (typeof layoutWidth === 'number' && typeof layoutHeight === 'number') {
          newX = Math.max(0, Math.min(layoutWidth - dimensions.width, newX));
          newY = Math.max(0, Math.min(layoutHeight - dimensions.height, newY));
        }
        onDragEnd({ x: newX, y: newY });
      }
    }
  };
  
  // Add and remove event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMoveDOM);
      window.addEventListener('mouseup', handleMouseUpDOM);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveDOM);
      window.removeEventListener('mouseup', handleMouseUpDOM);
    };
  }, [isDragging, id, position.x, position.y, onDragEnd]);

  /**
   * Handle resize event
   * @param {Object} _e - Resize event (unused)
   * @param {string} _direction - Resize direction (unused)
   * @param {HTMLElement} ref - Element reference
   * @param {Object} _d - Delta values (unused)
   */
  const handleResize = (_e, _direction, ref, _d) => {
    setIsResizing(true);
    // Update dimensions based on resize
    const newWidth = ref.offsetWidth;
    const newHeight = ref.offsetHeight;
    
    setDimensions({
      width: newWidth,
      height: newHeight
    });
  };

  /**
   * Handle resize stop event
   * @param {Object} _e - Resize event (unused)
   * @param {string} _direction - Resize direction (unused)
   * @param {HTMLElement} ref - Element reference
   * @param {Object} _d - Delta values (unused)
   */
  const handleResizeStop = (_e, _direction, ref, _d) => {
    setIsResizing(false);
    // Don't allow resize if table has fixed size
    if (floor === 'interno' || type === 'billiard' || type === 'bar') return;
    
    const newWidth = ref.offsetWidth;
    const newHeight = ref.offsetHeight;
    
    // Update dimensions in state
    setDimensions({
      width: newWidth,
      height: newHeight
    });
    
    // Call onUpdate with new dimensions
    onUpdate({ width: newWidth, height: newHeight });
  };

  /**
   * Handle rotation
   * @param {string} direction - Rotation direction ('left' or 'right')
   */
  const handleRotate = (direction) => {
    const newRotation = (rotation + (direction === 'left' ? -15 : 15)) % 360;
    onUpdate({ rotation: newRotation });
  };

  /**
   * Get status color CSS class
   * @returns {string} CSS class for status color
   */
  const getStatusColor = () => {
    // Special case for billiard tables - always green felt
    if (type === 'billiard') {
      return 'bg-emerald-700 border-emerald-900 text-white';
    }
    
    switch (status) {
      case 'occupied':
        return 'bg-red-200 border-red-500 text-red-900';
      case 'reserved':
        return 'bg-yellow-200 border-yellow-500 text-yellow-900';
      default:
        return 'bg-green-200 border-green-500 text-green-900';
    }
  };

  /**
   * Get table shape CSS class
   * @returns {string} CSS class for table shape
   */
  const getTableShape = () => {
    let tableShape = 'rounded-md';
  
    if (type === 'billiard') {
      tableShape = 'rounded-lg';
    } else if (type === 'bar') {
      tableShape = 'rounded-full';
    } else if (shape === 'circle') {
      tableShape = 'rounded-full';
    } else if (shape === 'oval') {
      tableShape = 'rounded-full';
    }

    return tableShape;
  };

  // Use capacity for display if needed
  const capacityText = capacity ? `Capacity: ${capacity}` : '';

  const statusColor = getStatusColor();

  return (
    <div
      ref={drag}
      className={`table absolute cursor-move ${isSelected ? 'ring-2 ring-blue-500' : ''} ${getTableShape()} ${statusColor} shadow-md border-2`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        transform: `rotate(${rotation}deg)`,
        transition: isDragging ? 'none' : 'all 0.2s',
        zIndex: isSelected ? 10 : 1,
        opacity: isDraggingItem && !isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: type === 'billiard' ? '0 4px 8px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      data-testid={`table-${id}`}
      title={capacityText}
    >
      <Resizable
        size={dimensions}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        minWidth={40}
        minHeight={40}
        maxWidth={300}
        maxHeight={200}
        enable={{
          top: isSelected && !(floor === 'interno' || type === 'billiard' || type === 'bar'),
          right: isSelected && !(floor === 'interno' || type === 'billiard' || type === 'bar'),
          bottom: isSelected && !(floor === 'interno' || type === 'billiard' || type === 'bar'),
          left: isSelected && !(floor === 'interno' || type === 'billiard' || type === 'bar'),
          topRight: isSelected && !(floor === 'interno' || type === 'billiard' || type === 'bar'),
          bottomRight: isSelected && !(floor === 'interno' || type === 'billiard' || type === 'bar'),
          bottomLeft: isSelected && !(floor === 'interno' || type === 'billiard' || type === 'bar'),
          topLeft: isSelected && !(floor === 'interno' || type === 'billiard' || type === 'bar')
        }}
        handleStyles={{
          right: { width: '10px', right: '-5px' },
          bottom: { height: '10px', bottom: '-5px' },
          bottomRight: { width: '14px', height: '14px', right: '-7px', bottom: '-7px' },
          bottomLeft: { width: '14px', height: '14px', left: '-7px', bottom: '-7px' },
          topRight: { width: '14px', height: '14px', right: '-7px', top: '-7px' },
        }}
        handleClasses={{
          right: 'border-r-2 border-blue-500',
          bottom: 'border-b-2 border-blue-500',
          bottomRight: 'border-2 border-blue-500 rounded-full bg-white',
          bottomLeft: 'border-2 border-blue-500 rounded-full bg-white',
          topRight: 'border-2 border-blue-500 rounded-full bg-white',
        }}
      >
        <div className="flex flex-col items-center justify-center h-full p-1 text-center relative">
          <span className="font-bold text-gray-900 dark:text-white">{name}</span>
          {capacity > 0 && <span className="text-xs text-gray-700 dark:text-gray-300">{capacity}</span>}
          
          {/* Render chairs around bar tables */}
          {type === 'bar' && (
            <div className="absolute w-full h-full pointer-events-none">
              {/* Top chair */}
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-gray-400 dark:bg-gray-600 rounded-full border border-gray-500 shadow-sm"></div>
              {/* Right chair */}
              <div className="absolute top-1/2 -right-5 transform -translate-y-1/2 w-6 h-6 bg-gray-400 dark:bg-gray-600 rounded-full border border-gray-500 shadow-sm"></div>
              {/* Bottom chair */}
              <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-gray-400 dark:bg-gray-600 rounded-full border border-gray-500 shadow-sm"></div>
              {/* Left chair */}
              <div className="absolute top-1/2 -left-5 transform -translate-y-1/2 w-6 h-6 bg-gray-400 dark:bg-gray-600 rounded-full border border-gray-500 shadow-sm"></div>
            </div>
          )}
          
          {/* Visual indicator for billiard tables */}
          {type === 'billiard' && (
            <div className="absolute w-full h-full pointer-events-none flex items-center justify-center">
              <div className="w-5/6 h-5/6 border-4 border-emerald-800 rounded-md bg-emerald-800 bg-opacity-30 flex items-center justify-center">
                {/* Billiard pockets */}
                <div className="absolute top-0 left-0 w-3 h-3 bg-gray-900 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute top-0 right-0 w-3 h-3 bg-gray-900 rounded-full transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 bg-gray-900 rounded-full transform -translate-x-1/2 translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-900 rounded-full transform translate-x-1/2 translate-y-1/2"></div>
                <div className="absolute top-0 left-1/2 w-3 h-3 bg-gray-900 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-gray-900 rounded-full transform -translate-x-1/2 translate-y-1/2"></div>
                
                {/* Billiard ball */}
                <div className="w-5 h-5 bg-white rounded-full shadow-inner"></div>
              </div>
            </div>
          )}
        </div>
      </Resizable>
      
      {isSelected && (
        <div className="absolute -top-8 left-0 flex space-x-1">
          <button
            className="p-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              handleRotate('left');
            }}
            title="Rotate left"
          >
            ↺
          </button>
          <button
            className="p-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              handleRotate('right');
            }}
            title="Rotate right"
          >
            ↻
          </button>
        </div>
      )}
    </div>
  );
};

export default Table;
