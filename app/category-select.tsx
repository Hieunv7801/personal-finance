"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Category } from "@/lib/types";

export default function CategorySelect({ value, options, onChange }: {
  value: Category;
  options: Category[];
  onChange: (value: Category) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.focus();
  }, [open, active]);

  const choose = (option: Category) => {
    onChange(option);
    setOpen(false);
    trigger.current?.focus();
  };

  return <div className="category-field" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label id={`${id}-label`} htmlFor={`${id}-trigger`}>Danh mục</label>
    <button ref={trigger} id={`${id}-trigger`} type="button" className="category-trigger"
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
      aria-labelledby={`${id}-label ${id}-value`}
      onClick={() => { setActive(Math.max(0, options.indexOf(value))); setOpen(!open); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setActive(Math.max(0, options.indexOf(value))); setOpen(true);
        }
      }}>
      <span id={`${id}-value`}>{value}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <div id={`${id}-list`} className="category-options" role="listbox" aria-labelledby={`${id}-label`}
      onKeyDown={event => {
        let next = active;
        if (event.key === "ArrowDown") next = (active + 1) % options.length;
        else if (event.key === "ArrowUp") next = (active - 1 + options.length) % options.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = options.length - 1;
        else if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return; }
        else if (event.key.length === 1 && event.key !== " ") {
          const match = options.findIndex((option, index) => index > active && option.toLocaleLowerCase("vi").startsWith(event.key.toLocaleLowerCase("vi")));
          next = match >= 0 ? match : options.findIndex(option => option.toLocaleLowerCase("vi").startsWith(event.key.toLocaleLowerCase("vi")));
          if (next < 0) return;
        } else return;
        event.preventDefault(); setActive(next);
      }}>
      {options.map((option, index) => <button key={option} type="button" role="option"
        aria-selected={option === value} tabIndex={index === active ? 0 : -1} data-index={index}
        onFocus={() => setActive(index)} onClick={() => choose(option)}>
        <span>{option}</span>{option === value && <Check size={18} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
