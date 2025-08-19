// Mock implementation of react-dnd for testing
export const useDrop = () => [
  { isOver: false, canDrop: false },
  jest.fn() // drop ref
];

export const useDrag = () => [
  { isDragging: false },
  jest.fn(), // drag ref
  jest.fn()  // drag preview
];

export const DndProvider = ({ children }) => children;
