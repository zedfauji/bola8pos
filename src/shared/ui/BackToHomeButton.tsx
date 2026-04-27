import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from './button';

export function BackToHomeButton() {
  return (
    <div className="px-4 pt-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/home">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Home
        </Link>
      </Button>
    </div>
  );
}
