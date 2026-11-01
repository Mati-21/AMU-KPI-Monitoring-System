import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

import Button from '../../../shared/components/ui/Button';
import { useOfficeTypes } from '../hooks/useOffices';
import { collapsedFromDepth, flattenTree } from '../lib/officeTree';

const LEVEL_COLORS = ['bg-emerald-700', 'bg-amber-700', 'bg-teal-700', 'bg-sky-700', 'bg-indigo-600', 'bg-rose-700'];
const NO_LEVEL_COLOR = 'bg-slate-600';
const LINE = 'bg-muted-foreground/50';

// Three levels show on load, so a large university does not start as a very wide drawing
const FIRST_COLLAPSED_DEPTH = 2;

const levelColor = (levelOrder) => (levelOrder == null ? NO_LEVEL_COLOR : LEVEL_COLORS[(levelOrder - 1) % LEVEL_COLORS.length]);

const OfficeBox = ({ node, width, isOpen, onToggle, onOpen }) => {
  const hasChildren = node.children.length > 0;
  const look = node.isActive ? `${levelColor(node.officeType.levelOrder)} text-white shadow-sm hover:brightness-110` : 'border border-dashed border-muted-foreground bg-card text-muted-foreground';

  return (
    <div className={`relative ${width}`}>
      <button type="button" onClick={() => onOpen(node.id)} className={`w-full rounded-lg px-3 py-3 text-center text-xs font-medium wrap-break-word ${look}`}>
        <span className={node.isActive ? '' : 'line-through'}>{node.name}</span>
      </button>
      {hasChildren && (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
          className="absolute -bottom-2.5 left-1/2 z-10 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card px-1 text-[10px] font-semibold text-foreground hover:bg-muted"
        >
          {isOpen ? <Minus className="h-3 w-3" /> : <>{flattenTree(node.children).length}<Plus className="h-2.5 w-2.5" /></>}
        </button>
      )}
    </div>
  );
};

// Offices with nothing below them stack under their parent, which keeps the drawing narrow
const StackedChildren = ({ nodes, onOpen }) => (
  <ul className="w-44 pt-1">
    {nodes.map((node, index) => (
      <li key={node.id} className="relative pl-8 pt-2">
        <span className={`absolute left-3 top-0 w-px ${LINE} ${index === nodes.length - 1 ? 'h-[calc(50%+4px)]' : 'h-full'}`} />
        <span className={`absolute left-3 top-[calc(50%+4px)] h-px w-5 ${LINE}`} />
        <OfficeBox node={node} width="w-36" onOpen={onOpen} />
      </li>
    ))}
  </ul>
);

const branchLine = (index, count) => {
  if (count === 1) return null;
  if (index === 0) return 'left-1/2 right-0';
  if (index === count - 1) return 'left-0 right-1/2';
  return 'left-0 right-0';
};

const SpreadChildren = ({ nodes, ...shared }) => (
  <>
    <span className={`h-5 w-px ${LINE}`} />
    <div className="flex items-start">
      {nodes.map((child, index) => {
        const across = branchLine(index, nodes.length);
        return (
          <div key={child.id} className="relative flex flex-col items-center px-2 pt-5">
            {across && <span className={`absolute top-0 h-px ${across} ${LINE}`} />}
            <span className={`absolute left-1/2 top-0 h-5 w-px ${LINE}`} />
            <Branch node={child} {...shared} />
          </div>
        );
      })}
    </div>
  </>
);

const Branch = ({ node, collapsed, onToggle, onOpen }) => {
  const isOpen = node.children.length > 0 && !collapsed.has(node.id);
  const stack = node.children.length > 1 && node.children.every((child) => child.children.length === 0);

  return (
    <div className="flex flex-col items-center">
      <OfficeBox node={node} width="w-44" isOpen={isOpen} onToggle={onToggle} onOpen={onOpen} />
      {isOpen && (stack ? <StackedChildren nodes={node.children} onOpen={onOpen} /> : <SpreadChildren nodes={node.children} collapsed={collapsed} onToggle={onToggle} onOpen={onOpen} />)}
    </div>
  );
};

const Legend = () => {
  const { data: types = [] } = useOfficeTypes();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {types
        .filter((type) => type.officeCount > 0)
        .map((type) => (
          <span key={type.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-3 w-3 rounded-sm ${levelColor(type.levelOrder)}`} />
            {type.name}
          </span>
        ))}
    </div>
  );
};

const OfficeHierarchy = ({ tree, onOpen }) => {
  const [collapsed, setCollapsed] = useState(() => collapsedFromDepth(tree, FIRST_COLLAPSED_DEPTH));

  const toggle = (id) => {
    const next = new Set(collapsed);
    if (!next.delete(id)) next.add(id);
    setCollapsed(next);
  };

  return (
    <div className="flex-1 rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <Legend />
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setCollapsed(new Set())}>
            Expand All
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setCollapsed(collapsedFromDepth(tree, 0))}>
            Collapse All
          </Button>
        </div>
      </div>
      <div className="overflow-auto">
        <div className="inline-flex min-w-full justify-center gap-6 p-6">
          {tree.map((node) => (
            <Branch key={node.id} node={node} collapsed={collapsed} onToggle={toggle} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OfficeHierarchy;
