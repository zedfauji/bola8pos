import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { LayoutGrid, Settings, List, X } from 'lucide-react';
import NewTableLayouts from '../components/tables/NewTableLayouts';
import TableLayoutEditor from '../components/tables/TableLayoutEditor';
import { TableProvider, useTableContext } from '../contexts/NewTableContext';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import PropTypes from 'prop-types';

// Layout content component to access context
/**
 * @param {Object} props
 * @param {React.Dispatch<React.SetStateAction<boolean>>} props.setShowLayouts - Function to toggle layouts visibility
 */
const LayoutContent = ({ setShowLayouts }) => {
  const { activeLayoutId, activeLayout } = useTableContext();
  
  if (!activeLayoutId || !activeLayout) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LayoutGrid className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-medium text-gray-700 mb-2">Table Layout Editor</h2>
          <p className="text-gray-500 mb-6">
            Select a layout from the sidebar or create a new one to get started
          </p>
          <Button 
            onClick={() => setShowLayouts(true)}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Show Layouts
          </Button>
        </div>
      </div>
    );
  }
  
  // Use the TableLayoutEditor component when a layout is active
  return <TableLayoutEditor />;
};

// Add PropTypes for type checking
LayoutContent.propTypes = {
  setShowLayouts: PropTypes.func.isRequired
};

const NewTablesPage = () => {
  const [activeTab, setActiveTab] = useState('layout');
  const [showLayouts, setShowLayouts] = useState(true);

  return (
    <div className="flex h-screen bg-gray-50 tables-page">
      <TableProvider>
        <DndProvider backend={HTML5Backend}>
          {/* Sidebar */}
          <div className={`${showLayouts ? 'w-80' : 'w-16'} bg-white border-r transition-all duration-300 flex flex-col`}>
            <div className="p-4 border-b flex items-center justify-between">
              {showLayouts ? (
                <h2 className="font-semibold">Table Layouts</h2>
              ) : (
                <div className="w-6"></div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLayouts(!showLayouts)}
                className="h-8 w-8 p-0"
              >
                {showLayouts ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {showLayouts && <NewTableLayouts />}
            </div>
          </div>
          
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b">
              <div className="px-6 py-4 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Table Management</h1>
                
                <Tabs 
                  value={activeTab} 
                  onValueChange={setActiveTab}
                  className="w-auto"
                >
                  <TabsList>
                    <TabsTrigger value="layout">
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Layout
                    </TabsTrigger>
                    <TabsTrigger value="list">
                      <List className="h-4 w-4 mr-2" />
                      List View
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </header>
            
            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden bg-gray-50 p-6">
              <div className="h-full bg-white rounded-lg shadow-sm p-6">
                {activeTab === 'layout' && <LayoutContent setShowLayouts={setShowLayouts} />}
                {activeTab === 'list' && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <List className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <h2 className="text-xl font-medium text-gray-700 mb-2">Tables List View</h2>
                      <p className="text-gray-500 mb-6">
                        Table list view coming soon
                      </p>
                    </div>
                  </div>
                )}
                {activeTab === 'settings' && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Settings className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <h2 className="text-xl font-medium text-gray-700 mb-2">Table Settings</h2>
                      <p className="text-gray-500">
                        Table settings will be available here
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </DndProvider>
      </TableProvider>
    </div>
  );
};

export default NewTablesPage;
