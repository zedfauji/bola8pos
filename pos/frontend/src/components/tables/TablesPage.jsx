// This file exports the new TablesPage implementation that uses TableContext
import { TableProvider } from '../../contexts/TableContext';
import NewTablesPage from './NewTablesPage';

const TablesPage = () => (
  <TableProvider>
    <NewTablesPage />
  </TableProvider>
);

export default TablesPage;
