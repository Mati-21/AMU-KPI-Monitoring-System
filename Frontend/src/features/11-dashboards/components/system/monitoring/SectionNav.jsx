import { useRef } from 'react';

const GAP_PX = 12;

// The nearest ancestor that scrolls: here the page's content area
const scrollParentOf = (element) => {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
};

/**
 * Links that jump to each part of the long dashboard, kept in view while scrolling. A plain #anchor link is not used:
 * the browser scrolls every container it can to reach it, including the fixed-height frame around this page, which
 * pushes the whole layout up and leaves a white gap at the bottom. Only the content area is scrolled here.
 */
const SectionNav = ({ sections }) => {
  const navRef = useRef(null);

  const jumpTo = (event, id) => {
    event.preventDefault();
    const target = document.getElementById(id);
    const container = target && scrollParentOf(target);
    if (!container) return;
    // Land just under the bar, which stays at the top while scrolling
    const barHeight = navRef.current?.offsetHeight ?? 0;
    const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top: container.scrollTop + offset - barHeight - GAP_PX, behavior: 'smooth' });
  };

  return (
    <nav ref={navRef} aria-label="Dashboard sections" className="sticky top-0 z-10 -mx-1 overflow-x-auto rounded-lg border border-border bg-card/95 px-2 py-1.5 shadow-sm backdrop-blur">
      <ul className="flex gap-1">
        {sections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} onClick={(event) => jumpTo(event, section.id)} className="block whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SectionNav;
