import { onMounted, onUpdated, type Ref } from 'vue';

// Arrow-key targets. Retry buttons stay in the normal Tab order.
const targets =
  '.cell-button, .guardian-button, .heading-button, .stage-button, .summary-cell';

const targetIn = (cell: HTMLTableCellElement) =>
  cell.matches(targets) ? cell : cell.querySelector<HTMLElement>(targets);

/** Every cell at each row and column it covers, so spans line up. */
function cellGrid(table: HTMLTableElement) {
  const rows = [...table.rows];
  const grid: HTMLTableCellElement[][] = rows.map(() => []);
  rows.forEach((row, r) => {
    let column = 0;
    for (const cell of row.cells) {
      while (grid[r]![column]) column++;
      for (let y = r; y < Math.min(r + cell.rowSpan, rows.length); y++)
        for (let x = column; x < column + cell.colSpan; x++) grid[y]![x] = cell;
      column += cell.colSpan;
    }
  });
  return grid;
}

function neighbor(
  grid: HTMLTableCellElement[][],
  from: HTMLTableCellElement,
  rowStep: number,
  columnStep: number,
) {
  const row = grid.findIndex((cells) => cells.includes(from));
  const column = grid[row]?.indexOf(from) ?? -1;
  for (
    let y = row + rowStep, x = column + columnStep;
    grid[y]?.[x];
    y += rowStep, x += columnStep
  ) {
    const cell = grid[y]![x]!;
    const target = cell === from ? null : targetIn(cell);
    if (target) return target;
  }
  return undefined;
}

/** Scrolls a target clear of the sticky header and player column. */
function reveal(target: HTMLElement, table: HTMLTableElement) {
  const scroller = table.parentElement!;
  const view = scroller.getBoundingClientRect(),
    box = target.getBoundingClientRect();
  if (!target.closest('thead')) {
    const top = table.tHead?.getBoundingClientRect().bottom ?? view.top;
    if (box.top < top) scroller.scrollTop -= top - box.top;
    else if (box.bottom > view.bottom)
      scroller.scrollTop += box.bottom - view.bottom;
  }
  if (!target.closest('.player-column')) {
    const left =
      table.querySelector('.player-column')?.getBoundingClientRect().right ??
      view.left;
    if (box.left < left) scroller.scrollLeft -= left - box.left;
    else if (box.right > view.right)
      scroller.scrollLeft += box.right - view.right;
  }
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/**
 * Makes a table a single Tab stop whose cells are reached with the arrow keys,
 * Home, and End. Tab stops are set directly, so moving does not rerender it.
 */
export function useGridNavigation(
  table: Ref<HTMLTableElement | undefined>,
  beforeMove: () => void,
) {
  let stop: HTMLElement | undefined;
  function setStop(element: HTMLElement) {
    if (stop === element) return;
    if (stop) stop.tabIndex = -1;
    stop = element;
    element.tabIndex = 0;
  }
  function ensureStop() {
    if (stop?.isConnected) return;
    const first =
      table.value?.querySelector<HTMLElement>(`tbody :is(${targets})`) ??
      table.value?.querySelector<HTMLElement>(targets);
    if (first) setStop(first);
  }
  onMounted(ensureStop);
  onUpdated(ensureStop);

  function nextTarget(event: KeyboardEvent, from: HTMLTableCellElement) {
    const element = table.value!;
    const grid = cellGrid(element);
    const inRow = () =>
      [...new Set(grid.find((cells) => cells.includes(from)))]
        .map(targetIn)
        .filter((target) => !!target);
    switch (event.key) {
      case 'ArrowLeft':
        return neighbor(grid, from, 0, -1);
      case 'ArrowRight':
        return neighbor(grid, from, 0, 1);
      case 'ArrowUp':
        return neighbor(grid, from, -1, 0);
      case 'ArrowDown':
        return neighbor(grid, from, 1, 0);
      case 'Home':
        return event.ctrlKey
          ? element.querySelector<HTMLElement>(targets)
          : inRow()[0];
      case 'End':
        return event.ctrlKey
          ? [...element.querySelectorAll<HTMLElement>(targets)].at(-1)
          : inRow().at(-1);
      default:
        return undefined;
    }
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.altKey || event.metaKey || event.shiftKey) return;
    if (event.ctrlKey && event.key !== 'Home' && event.key !== 'End') return;
    if (!/^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(event.key)) return;
    const current = (event.target as HTMLElement).closest<HTMLElement>(targets);
    const cell = current?.closest('th, td');
    if (!cell) return;
    event.preventDefault();
    const next = nextTarget(event, cell as HTMLTableCellElement);
    if (!next || next === current) return;
    beforeMove();
    reveal(next, table.value!);
    next.focus({ preventScroll: true });
  }
  function onFocusin(event: FocusEvent) {
    const target = (event.target as HTMLElement).closest<HTMLElement>(targets);
    if (target) setStop(target);
  }
  return { onKeydown, onFocusin };
}
