import { Shield } from 'lucide-react';

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary" />
          Permission Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Control access rights across modules</p>
      </div>
    </div>
  );
}

export default Header;
