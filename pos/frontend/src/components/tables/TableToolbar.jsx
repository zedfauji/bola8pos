import { Plus, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

/** @type {(props: { 
  onAddTable: () => void, 
  onSave: () => void, 
  onSetTwoEach: () => void, 
  isSetTwoEachLoading?: boolean, 
  className?: string 
}) => JSX.Element} */
const TableToolbar = ({
  onAddTable,
  onSave,
  onSetTwoEach,
  isSetTwoEachLoading = false,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between p-2 border-b bg-white ${className}`}>
      <div className="flex items-center space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddTable}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Table
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add a new table to the layout</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                className="h-8 ml-2"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Layout
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Save the current table layout</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onSetTwoEach}
                disabled={isSetTwoEachLoading}
                aria-busy={isSetTwoEachLoading}
                className="h-8 ml-2"
              >
                {isSetTwoEachLoading ? 'Setting Up...' : 'Set 2+2'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ensure 2 billiard and 2 bar tables (current floor)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default TableToolbar;
