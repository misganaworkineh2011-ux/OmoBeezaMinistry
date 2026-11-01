"use client";

import { createContext, use, useId, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";

interface AccordionContextValue {
  openId: string | null;
  toggle: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion(): AccordionContextValue {
  const ctx = use(AccordionContext);
  if (!ctx) throw new Error("AccordionItem must be used within <Accordion>");
  return ctx;
}

export function Accordion({ children, defaultOpenId = null }: { children: ReactNode; defaultOpenId?: string | null }) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);
  // Single-open: clicking the open item closes it.
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  return (
    <AccordionContext.Provider value={{ openId, toggle }}>
      <div className="accordion">{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  const { openId, toggle } = useAccordion();
  const isOpen = openId === id;
  const bodyId = useId();
  const headId = useId();

  return (
    <div className={`accordion__item${isOpen ? " is-open" : ""}`}>
      <button
        id={headId}
        type="button"
        className="accordion__trigger"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => toggle(id)}
      >
        <span>{title}</span>
        <span className="accordion__icon">
          <Icon name="chevronDown" />
        </span>
      </button>
      <div id={bodyId} role="region" aria-labelledby={headId} className="accordion__panel" inert={!isOpen}>
        <div>
          <div className="accordion__body">{children}</div>
        </div>
      </div>
    </div>
  );
}
