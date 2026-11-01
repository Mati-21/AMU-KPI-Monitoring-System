import { useState } from 'react';
import { Building2, ChevronDown, ChevronRight } from 'lucide-react';

const Branch = ({ node, depth, selectedId, onSelect, forceOpen }) => {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const showChildren = hasChildren && (open || forceOpen);
  const ArrowIcon = showChildren ? ChevronDown : ChevronRight;

  return (
    <li>
      <div className={`flex items-center gap-1 rounded-md pr-2 ${selectedId === node.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`} style={{ paddingLeft: `${depth * 16 + 4}px` }}>
        {hasChildren ? (
          <button type="button" onClick={() => setOpen(!showChildren)} aria-label={`${showChildren ? 'Collapse' : 'Expand'} ${node.name}`} className="rounded p-1 hover:bg-muted">
            <ArrowIcon className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <button type="button" onClick={() => onSelect(node.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={`min-w-0 break-words ${node.isActive ? '' : 'text-muted-foreground line-through'}`}>{node.name}</span>
        </button>
      </div>
      {showChildren && (
        <ul>
          {node.children.map((child) => (
            <Branch key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} forceOpen={forceOpen} />
          ))}
        </ul>
      )}
    </li>
  );
};

const OfficeTree = ({ nodes, selectedId, onSelect, forceOpen }) => (
  <ul>
    {nodes.map((node) => (
      <Branch key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} forceOpen={forceOpen} />
    ))}
  </ul>
);

export default OfficeTree;
