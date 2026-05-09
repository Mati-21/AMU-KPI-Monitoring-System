import { Search } from 'lucide-react';

const SearchInput = ({ value = '', onChange = () => {}, placeholder = 'Search...', className = '' }) => {
  const hasHeightClass = className.includes('h-');

  return (
    <div
      className={`relative flex items-center w-full transition-all duration-200 rounded-full border bg-[var(--search-bg)] shadow-soft
      ${!hasHeightClass ? 'h-10' : ''} 
      border-[var(--search-border)] focus-within:border-[var(--search-border-active)] focus-within:ring-4 focus-within:ring-[var(--search-border-active)]/20
      ${className}`}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <Search className="h-5 w-5 text-[var(--search-border)] transition-colors duration-200 [.focus-within_&]:text-[var(--search-border-active)]" />
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full h-full bg-transparent pl-12 pr-4 text-sm font-medium text-[var(--search-text)] placeholder:text-[var(--search-text)]/60 focus:outline-none"
      />
    </div>
  );
};

export default SearchInput;
