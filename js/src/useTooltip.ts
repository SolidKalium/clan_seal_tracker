import { nextTick, ref, shallowRef } from 'vue';
import type { BadgeOwnership } from './domain';
import type { CompletionCounts } from './completion';
import type { Cell, Heading, PlayerData, Seal, UserInfo } from './types';

export type TooltipContent =
  | { kind: 'characters'; player?: PlayerData; groupKey: string }
  | {
      kind: 'record';
      player?: string;
      heading: Heading;
      cell?: Cell;
      groupKey?: string;
      objectiveHash?: string;
    }
  | {
      kind: 'guardian';
      guardian: PlayerData;
      earnedTitle?: string;
      earnedBadge?: BadgeOwnership & { name: string };
      memberships?: UserInfo[];
      loading: boolean;
      error?: string;
    }
  | {
      kind: 'summary';
      seal: Seal;
      label: string;
      player?: string;
      counts?: CompletionCounts;
      badge: boolean;
      broader: boolean;
    }
  | { kind: 'sync' }
  | { kind: 'note'; text: string };

const focusable = 'button, a[href], [tabindex]';
const hiddenStyle = () => ({ left: '0px', top: '0px', visibility: 'hidden' });
function enclosingRect(elements: HTMLElement[]) {
  const bounds = elements.map((element) => element.getBoundingClientRect());
  const left = Math.min(...bounds.map((r) => r.left)),
    top = Math.min(...bounds.map((r) => r.top));
  const right = Math.max(...bounds.map((r) => r.right)),
    bottom = Math.max(...bounds.map((r) => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/** The single floating tooltip: its content, anchor, and viewport placement. */
export function useTooltip() {
  const tooltip = shallowRef<
    TooltipContent & {
      id: number;
      anchor: DOMRect;
      style: Record<string, string>;
    }
  >();
  const tooltipElement = ref<HTMLElement>();
  let tooltipSerial = 0;
  let described: HTMLElement | undefined;
  // Set directly so that only the target changes, and the table does not rerender.
  function describe(target: EventTarget | null) {
    described?.removeAttribute('aria-describedby');
    const element = target as HTMLElement;
    described = element.matches(focusable)
      ? element
      : (element.querySelector<HTMLElement>(focusable) ?? element);
    described.setAttribute('aria-describedby', 'record-tooltip');
  }
  // Keyboard moves in the table can scroll it, which must not close the new tooltip.
  let scrollIsKeyboardMove = false;
  function keepThroughScroll() {
    scrollIsKeyboardMove = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        scrollIsKeyboardMove = false;
      }),
    );
  }
  function closeOnScroll() {
    if (!scrollIsKeyboardMove) closeTooltip();
  }
  function closeTooltip() {
    described?.removeAttribute('aria-describedby');
    described = undefined;
    tooltip.value = undefined;
  }
  async function positionTooltip(id: number) {
    await nextTick();
    const tip = tooltip.value;
    if (!tip || tip.id !== id || !tooltipElement.value) return;
    const rect = tip.anchor;
    const bounds = tooltipElement.value.getBoundingClientRect();
    const left = Math.max(
      10,
      Math.min(
        tip.kind === 'note' && rect.width === 0
          ? rect.left + 12
          : rect.left + rect.width / 2 - bounds.width / 2,
        window.innerWidth - bounds.width - 10,
      ),
    );
    const top =
      rect.bottom + bounds.height + 12 < window.innerHeight
        ? rect.bottom + 8
        : Math.max(10, rect.top - bounds.height - 8);
    tooltip.value = {
      ...tip,
      style: { left: `${left}px`, top: `${top}px`, visibility: 'visible' },
    };
  }
  async function openTooltip(event: Event, content: TooltipContent) {
    describe(event.currentTarget);
    const id = ++tooltipSerial;
    const anchor =
      content.kind === 'note' && event instanceof MouseEvent
        ? new DOMRect(event.clientX, event.clientY, 0, 0)
        : (event.currentTarget as HTMLElement).getBoundingClientRect();
    tooltip.value = {
      ...content,
      id,
      anchor,
      style: hiddenStyle(),
    };
    await positionTooltip(id);
    return id;
  }
  function showCharacterTooltip(event: Event, player?: PlayerData) {
    const element = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      '[data-character-group]',
    )!;
    const groupKey = element.dataset.characterGroup!;
    describe(event.currentTarget);
    if (
      tooltip.value?.kind === 'characters' &&
      tooltip.value.groupKey === groupKey
    )
      return;
    const parts = [
      ...element
        .closest('table')!
        .querySelectorAll<HTMLElement>('[data-character-group]'),
    ].filter((part) => part.dataset.characterGroup === groupKey);
    const id = ++tooltipSerial;
    tooltip.value = {
      kind: 'characters',
      player,
      groupKey,
      id,
      anchor: enclosingRect(parts),
      style: hiddenStyle(),
    };
    void positionTooltip(id);
  }
  function showTooltip(
    event: Event,
    heading: Heading,
    cell?: Cell,
    player?: string,
    objectiveHash?: string,
  ) {
    const element = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      '[data-record-tooltip]',
    );
    const groupKey = element?.dataset.recordTooltip;
    describe(event.currentTarget);
    if (
      groupKey &&
      tooltip.value?.kind === 'record' &&
      tooltip.value.groupKey === groupKey
    ) {
      tooltip.value = { ...tooltip.value, objectiveHash };
      return;
    }
    const id = ++tooltipSerial;
    const parts = groupKey
      ? [
          ...document.querySelectorAll<HTMLElement>('[data-record-tooltip]'),
        ].filter((el) => el.dataset.recordTooltip === groupKey)
      : [event.currentTarget as HTMLElement];
    tooltip.value = {
      kind: 'record',
      heading,
      cell,
      player,
      groupKey,
      objectiveHash,
      id,
      anchor: enclosingRect(parts),
      style: hiddenStyle(),
    };
    void positionTooltip(id);
  }
  function leaveRecordTooltip(event: MouseEvent | FocusEvent) {
    const next =
      event.relatedTarget instanceof Element
        ? event.relatedTarget.closest<HTMLElement>('[data-record-tooltip]')
        : undefined;
    // The next target replaces the tooltip itself; closing first would rerender the table.
    if (tooltip.value?.kind === 'record' && next) return;
    closeTooltip();
  }
  return {
    tooltip,
    tooltipElement,
    closeTooltip,
    closeOnScroll,
    keepThroughScroll,
    positionTooltip,
    openTooltip,
    showCharacterTooltip,
    showTooltip,
    leaveRecordTooltip,
  };
}
