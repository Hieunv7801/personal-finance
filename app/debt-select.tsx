"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Landmark } from "lucide-react";

export type DebtOption = { id: string; name: string; remaining: number; remainingLabel: string };

export default function DebtSelect({
  value,
  options,
  onChange,
  emptyHint = "Chưa có khoản nợ — thêm ở Cấu hình",
}: {
  value: string;
  options: DebtOption[];
  onChange: (id: string) => void;
  emptyHint?: string;
}) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = options.find(o => o.id === value);

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

  const choose = (optionId: string) => {
    onChange(optionId);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div
      className="debt-select"
      ref={root}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label id={`${id}-label`} htmlFor={`${id}-trigger`}>Trả nợ cho</label>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        className={`debt-select-trigger${open ? " is-open" : ""}${!selected ? " is-placeholder" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-labelledby={`${id}-label ${id}-value`}
        disabled={options.length === 0}
        onClick={() => {
          if (!options.length) return;
          setActive(Math.max(0, options.findIndex(o => o.id === value)));
          setOpen(!open);
        }}
        onKeyDown={event => {
          if (options.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setActive(Math.max(0, options.findIndex(o => o.id === value)));
            setOpen(true);
          }
        }}
      >
        <span className="debt-select-main">
          <span className="debt-select-icon" aria-hidden="true"><Landmark size={16} strokeWidth={2.2} /></span>
          <span id={`${id}-value`} className="debt-select-text">
            {selected ? (
              <>
                <strong>{selected.name}</strong>
                <small>Còn {selected.remainingLabel}</small>
              </>
            ) : (
              <strong>{options.length ? "Chọn người / khoản nợ" : emptyHint}</strong>
            )}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}>
          <ChevronDown size={18} aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && options.length > 0 && (
          <motion.div
            id={`${id}-list`}
            className="debt-select-options"
            role="listbox"
            aria-labelledby={`${id}-label`}
            initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={event => {
              let next = active;
              if (event.key === "ArrowDown") next = (active + 1) % options.length;
              else if (event.key === "ArrowUp") next = (active - 1 + options.length) % options.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = options.length - 1;
              else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                trigger.current?.focus();
                return;
              } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                choose(options[active].id);
                return;
              } else return;
              event.preventDefault();
              setActive(next);
            }}
          >
            {options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === value}
                tabIndex={index === active ? 0 : -1}
                data-index={index}
                className={option.id === value ? "is-selected" : ""}
                onFocus={() => setActive(index)}
                onClick={() => choose(option.id)}
              >
                <span className="debt-select-option-copy">
                  <strong>{option.name}</strong>
                  <small>Còn lại {option.remainingLabel}</small>
                </span>
                <span className="debt-select-option-amt">{option.remainingLabel}</span>
                {option.id === value && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
