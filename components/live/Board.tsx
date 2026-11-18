'use client';

import { useState } from 'react';

/**
 * A board: one column per stage, a card per record. Drag a card to another
 * column to move it to that stage. Each card also works without dragging,
 * through whatever the card itself offers when opened.
 */
export function Board<T>({ columns, items, columnOf, idOf, onMove, card, tone }: {
  columns: readonly string[];
  items: T[];
  columnOf: (item: T) => string;
  idOf: (item: T) => string;
  onMove: (item: T, to: string) => void;
  card: (item: T) => React.ReactNode;
  tone?: (column: string) => string;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const PAGE = 40;

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {columns.map((col) => {
        const mine = items.filter((i) => columnOf(i) === col);
        const limit = limits[col] ?? PAGE;
        return (
          <section
            key={col}
            aria-label={`${col}, ${mine.length}`}
            onDragOver={(e) => { if (dragging) { e.preventDefault(); setOver(col); } }}
            onDragLeave={() => setOver((o) => (o === col ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const item = items.find((i) => idOf(i) === dragging);
              if (item && columnOf(item) !== col) onMove(item, col);
              setDragging(null);
              setOver(null);
            }}
            className={`flex w-64 shrink-0 flex-col rounded-lg border bg-paper ${over === col ? 'border-brand ring-2 ring-brand/30' : 'border-line'}`}
          >
            <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <span aria-hidden className={`h-2 w-2 rounded-full ${tone ? tone(col) : 'bg-ink-faint'}`} />
                {col}
              </h3>
              <span className="num text-xs font-semibold text-ink-soft">{mine.length}</span>
            </header>
            <ul className="flex max-h-[70vh] min-h-[4rem] flex-col gap-2 overflow-y-auto p-2">
              {mine.slice(0, limit).map((item) => (
                <li
                  key={idOf(item)}
                  draggable
                  onDragStart={(e) => { setDragging(idOf(item)); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', idOf(item)); }}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  className={`cursor-grab rounded-md border border-line bg-white p-2.5 text-sm shadow-sm active:cursor-grabbing ${dragging === idOf(item) ? 'opacity-40' : ''}`}
                >
                  {card(item)}
                </li>
              ))}
              {mine.length === 0 && <li className="px-1 py-3 text-center text-xs text-ink-faint">Nothing here</li>}
              {mine.length > limit && <li><button className="w-full rounded-md py-1.5 text-xs font-semibold text-brand-dark underline" onClick={() => setLimits({ ...limits, [col]: limit + PAGE })}>Show {Math.min(PAGE, mine.length - limit)} more</button></li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
