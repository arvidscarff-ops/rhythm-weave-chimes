"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
 * Material-style Dropdown Menu with drill-down pages, ripples,
 * and clip-path sweep transitions. Public API mirrors the
 * spec used by the integration brief.
 * ============================================================ */

// ---------- Drill-down context ----------
type DrilldownContextType = {
  activePage: string;
  history: string[];
  navigate: (page: string) => void;
  goBack: () => void;
  menuHeight: number | null;
  setMenuHeight: (h: number) => void;
};

const DrilldownContext = React.createContext<DrilldownContextType | null>(null);

function useDrilldown() {
  const ctx = React.useContext(DrilldownContext);
  if (!ctx) throw new Error("Material DropdownMenu sub-components must be used inside <DropdownMenu>.");
  return ctx;
}

// ---------- Ripple ----------
const MINIMUM_PRESS_MS = 280;

function useRipple(disabled = false) {
  const [pressed, setPressed] = React.useState(false);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const rippleRef = React.useRef<HTMLSpanElement | null>(null);
  const animRef = React.useRef<Animation | null>(null);
  const mounted = React.useRef(true);

  React.useEffect(() => () => { mounted.current = false; }, []);

  const start = (e?: React.PointerEvent | React.KeyboardEvent) => {
    if (disabled || !surfaceRef.current || !rippleRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setPressed(true);
    animRef.current?.cancel();

    let cx = rect.width / 2;
    let cy = rect.height / 2;
    if (e && "clientX" in e) {
      cx = (e as React.PointerEvent).clientX - rect.left;
      cy = (e as React.PointerEvent).clientY - rect.top;
    }
    const maxR = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(rect.width - cx, cy),
      Math.hypot(cx, rect.height - cy),
      Math.hypot(rect.width - cx, rect.height - cy),
    );
    const size = maxR * 2;
    const initialScale = Math.max(0.03, Math.min(0.1, 10 / size));
    const duration = Math.min(900, Math.max(420, Math.sqrt(rect.width * rect.height) * 3));
    rippleRef.current.style.width = `${size}px`;
    rippleRef.current.style.height = `${size}px`;
    const left = cx - maxR;
    const top = cy - maxR;
    const cLeft = (rect.width - size) / 2;
    const cTop = (rect.height - size) / 2;
    animRef.current = rippleRef.current.animate(
      [
        { transform: `translate(${left}px, ${top}px) scale(${initialScale})` },
        { transform: `translate(${cLeft}px, ${cTop}px) scale(1)` },
      ],
      { duration, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
    );
  };

  const end = async () => {
    const a = animRef.current;
    if (a && typeof a.currentTime === "number" && (a.currentTime as number) < MINIMUM_PRESS_MS) {
      await new Promise((r) => setTimeout(r, MINIMUM_PRESS_MS - (a.currentTime as number)));
    }
    if (mounted.current) setPressed(false);
  };

  return {
    surfaceRef,
    rippleRef,
    pressed,
    events: {
      onPointerDown: (e: React.PointerEvent) => { if (e.button === 0) start(e); },
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          start(e);
          setTimeout(end, MINIMUM_PRESS_MS);
        }
      },
    },
  };
}

function RippleLayer({
  pressed,
  rippleRef,
}: {
  pressed: boolean;
  rippleRef: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        "transition-colors duration-300",
        pressed ? "bg-white/[0.06]" : "bg-transparent",
      )}
    >
      <span
        ref={rippleRef}
        className={cn(
          "absolute left-0 top-0 rounded-full",
          "bg-white/[0.10]",
          pressed ? "opacity-100" : "opacity-0",
          "transition-opacity duration-500",
        )}
        style={{ willChange: "transform, opacity" }}
      />
    </span>
  );
}

// ---------- Animation styles (SSR-safe) ----------
function M3Styles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
@media (prefers-reduced-motion: no-preference) {
  @keyframes m3-sweep-down { from { clip-path: inset(0 0 100% 0 round 14px); } to { clip-path: inset(0 0 0 0 round 14px); } }
  @keyframes m3-sweep-up   { from { clip-path: inset(100% 0 0 0 round 14px); } to { clip-path: inset(0 0 0 0 round 14px); } }
  @keyframes m3-sweep-out-up   { from { clip-path: inset(0 0 0 0 round 14px); opacity: 1; } to { clip-path: inset(0 0 100% 0 round 14px); opacity: 0; } }
  @keyframes m3-sweep-out-down { from { clip-path: inset(0 0 0 0 round 14px); opacity: 1; } to { clip-path: inset(100% 0 0 0 round 14px); opacity: 0; } }
  @keyframes m3-item-in  { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes m3-item-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(3px) scale(.97); } }

  .m3-content[data-state="open"] { opacity: 1; }
  .m3-content[data-state="closed"] { opacity: 0; transition: opacity 180ms linear; }
  .m3-content[data-state="open"][data-side="bottom"] { animation: m3-sweep-down 360ms cubic-bezier(.1,.8,.2,1) forwards; }
  .m3-content[data-state="open"][data-side="top"]    { animation: m3-sweep-up   360ms cubic-bezier(.1,.8,.2,1) forwards; }
  .m3-content[data-state="closed"][data-side="bottom"] { animation: m3-sweep-out-up   240ms cubic-bezier(.4,0,1,1) forwards; }
  .m3-content[data-state="closed"][data-side="top"]    { animation: m3-sweep-out-down 240ms cubic-bezier(.4,0,1,1) forwards; }

  .m3-content[data-state="open"] .m3-item-enter {
    opacity: 0; animation: m3-item-in 320ms cubic-bezier(.1,.8,.2,1) forwards;
    animation-delay: calc(var(--m3-stagger, 0) * 28ms + 40ms);
  }
  .m3-content[data-state="closed"] .m3-item-enter { animation: m3-item-out 160ms cubic-bezier(.4,0,1,1) forwards; }
}
      `,
      }}
    />
  );
}

// ---------- Root ----------
function DropdownMenu({
  onOpenChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>) {
  const [history, setHistory] = React.useState<string[]>(["main"]);
  const activePage = history[history.length - 1] || "main";
  const [menuHeight, setMenuHeight] = React.useState<number | null>(null);

  const navigate = React.useCallback((page: string) => {
    setHistory((prev) => (prev[prev.length - 1] === page ? prev : [...prev, page].slice(-10)));
  }, []);
  const goBack = React.useCallback(() => {
    setHistory((prev) => (prev.length <= 1 ? prev : prev.slice(0, -1)));
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setHistory(["main"]);
      setMenuHeight(null);
    }
    onOpenChange?.(open);
  };

  return (
    <DrilldownContext.Provider value={{ activePage, history, navigate, goBack, menuHeight, setMenuHeight }}>
      <DropdownMenuPrimitive.Root onOpenChange={handleOpenChange} {...props}>
        {children}
      </DropdownMenuPrimitive.Root>
    </DrilldownContext.Provider>
  );
}

// ---------- Trigger ----------
const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.Trigger
      ref={ref}
      className={cn("relative inline-flex items-center outline-none focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

// ---------- Content ----------
const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 10, children, style, ...props }, ref) => {
  const ctx = React.useContext(DrilldownContext);
  const staggered = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) return child;
    const existing = (child.props as { style?: React.CSSProperties }).style;
    return React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
      style: { ...(existing ?? {}), ["--m3-stagger" as string]: index } as React.CSSProperties,
    });
  });

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          "m3-content z-[80] min-w-[220px] overflow-hidden rounded-[14px]",
          "border border-white/10 bg-[hsl(220_22%_8%/0.86)] backdrop-blur-xl",
          "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] text-foreground",
          className,
        )}
        style={{
          ...style,
          height: ctx?.menuHeight ? ctx.menuHeight : undefined,
          transition: "height 320ms cubic-bezier(.2,0,0,1)",
        }}
        {...props}
      >
        <M3Styles />
        <div className="relative w-full">{staggered}</div>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

// ---------- Item ----------
type ItemExtras = { inset?: boolean; enterAnimation?: boolean; delayDuration?: number };

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & ItemExtras
>(({ className, inset, enterAnimation = true, delayDuration = 220, children, onSelect, ...props }, ref) => {
  const { surfaceRef, rippleRef, pressed, events } = useRipple(!!props.disabled);
  const handleSelect = (e: Event) => {
    if (delayDuration > 0) {
      e.preventDefault();
      setTimeout(() => onSelect?.(e), delayDuration);
    } else {
      onSelect?.(e);
    }
  };
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      onSelect={handleSelect}
      className={cn(
        "group relative flex select-none items-stretch outline-none cursor-pointer",
        "min-h-[44px] text-[13px] font-medium tracking-[0.01em] text-foreground/85",
        "data-[highlighted]:text-foreground data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
        "overflow-hidden",
        enterAnimation && "m3-item-enter",
        className,
      )}
      {...props}
    >
      <div
        ref={(node) => { surfaceRef.current = node; }}
        {...events}
        className={cn("relative flex flex-1 items-center px-4 gap-2.5", inset && "pl-12")}
      >
        <RippleLayer pressed={pressed} rippleRef={rippleRef} />
        <span className="relative z-10 flex flex-1 items-center gap-2.5">{children}</span>
      </div>
    </DropdownMenuPrimitive.Item>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

// ---------- Checkbox + Radio ----------
const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & ItemExtras
>(({ className, children, checked, enterAnimation = true, delayDuration = 0, onSelect, ...props }, ref) => {
  const { surfaceRef, rippleRef, pressed, events } = useRipple(!!props.disabled);
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      onSelect={(e) => {
        if (delayDuration > 0) { e.preventDefault(); setTimeout(() => onSelect?.(e), delayDuration); }
        else onSelect?.(e);
      }}
      className={cn(
        "relative flex select-none items-stretch min-h-[44px] text-[13px] font-medium outline-none cursor-pointer overflow-hidden",
        "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
        enterAnimation && "m3-item-enter",
        className,
      )}
      {...props}
    >
      <div
        ref={(node) => { surfaceRef.current = node; }}
        {...events}
        className="relative flex flex-1 items-center px-4 gap-2.5"
      >
        <RippleLayer pressed={pressed} rippleRef={rippleRef} />
        <span className="relative z-10 flex h-4 w-4 items-center justify-center rounded-sm border border-white/25">
          <DropdownMenuPrimitive.ItemIndicator>
            <span className="block h-2 w-2 rounded-[2px] bg-foreground" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        <span className="relative z-10 flex flex-1 items-center gap-2.5">{children}</span>
      </div>
    </DropdownMenuPrimitive.CheckboxItem>
  );
});
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & ItemExtras
>(({ className, children, enterAnimation = true, delayDuration = 0, onSelect, ...props }, ref) => {
  const { surfaceRef, rippleRef, pressed, events } = useRipple(!!props.disabled);
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      onSelect={(e) => {
        if (delayDuration > 0) { e.preventDefault(); setTimeout(() => onSelect?.(e), delayDuration); }
        else onSelect?.(e);
      }}
      className={cn(
        "relative flex select-none items-stretch min-h-[44px] text-[13px] font-medium outline-none cursor-pointer overflow-hidden",
        "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
        enterAnimation && "m3-item-enter",
        className,
      )}
      {...props}
    >
      <div
        ref={(node) => { surfaceRef.current = node; }}
        {...events}
        className="relative flex flex-1 items-center px-4 gap-2.5"
      >
        <RippleLayer pressed={pressed} rippleRef={rippleRef} />
        <span className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full border border-white/25">
          <DropdownMenuPrimitive.ItemIndicator>
            <span className="block h-2 w-2 rounded-full bg-foreground" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        <span className="relative z-10 flex flex-1 items-center gap-2.5">{children}</span>
      </div>
    </DropdownMenuPrimitive.RadioItem>
  );
});
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

// ---------- Label + Separator ----------
const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-foreground/40",
      inset && "pl-12",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-white/[0.08]", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

// ---------- Drill-down: Page + PageTrigger ----------
function DropdownMenuInternalBack() {
  const ctx = useDrilldown();
  return (
    <DropdownMenuItem
      onSelect={(e) => { e.preventDefault(); ctx.goBack(); }}
      enterAnimation={false}
      delayDuration={0}
      style={{ ["--m3-stagger" as string]: 0 } as React.CSSProperties}
      className="text-foreground/55"
    >
      <ChevronLeft className="h-4 w-4" />
      Back
    </DropdownMenuItem>
  );
}

type PageProps = React.HTMLAttributes<HTMLDivElement> & { id: string };

const DropdownMenuPage = React.forwardRef<HTMLDivElement, PageProps>(
  ({ id, children, className, ...props }, ref) => {
    const ctx = useDrilldown();
    const { activePage, history, setMenuHeight } = ctx;
    const isActive = activePage === id;
    const isLeft = history.includes(id) && !isActive;
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!isActive || !node) return;
      // Initial measurement
      setMenuHeight(node.getBoundingClientRect().height);
      const ro = new ResizeObserver((entries) => {
        const box = entries[0];
        const h = box.borderBoxSize?.[0]?.blockSize ?? box.contentRect.height;
        setMenuHeight(h);
      });
      ro.observe(node);
      return () => ro.disconnect();
    }, [isActive, node, setMenuHeight]);

    const staggered = React.Children.map(children, (child, index) => {
      if (!React.isValidElement(child)) return child;
      const existing = (child.props as { style?: React.CSSProperties }).style;
      return React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
        style: {
          ...(existing ?? {}),
          ["--m3-stagger" as string]: id === "main" ? index : index + 1,
        } as React.CSSProperties,
      });
    });

    return (
      <div
        ref={(n) => {
          setNode(n);
          if (typeof ref === "function") ref(n);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = n;
        }}
        className={cn(
          "absolute left-0 top-0 w-full py-1 transition-all duration-[320ms] ease-[cubic-bezier(.2,0,0,1)]",
          isActive
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : isLeft
            ? "-translate-x-[18%] opacity-0 pointer-events-none"
            : "translate-x-[18%] opacity-0 pointer-events-none",
          className,
        )}
        {...props}
      >
        {id !== "main" && <DropdownMenuInternalBack />}
        {staggered}
      </div>
    );
  },
);
DropdownMenuPage.displayName = "DropdownMenuPage";

const DropdownMenuPageTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & ItemExtras & { targetId: string }
>(({ targetId, children, onSelect, ...props }, ref) => {
  const ctx = useDrilldown();
  return (
    <DropdownMenuItem
      ref={ref}
      onSelect={(e) => {
        e.preventDefault();
        ctx.navigate(targetId);
        onSelect?.(e);
      }}
      delayDuration={0}
      {...props}
    >
      <span className="flex flex-1 items-center gap-2.5">{children}</span>
      <ChevronRight className="h-4 w-4 opacity-50" />
    </DropdownMenuItem>
  );
});
DropdownMenuPageTrigger.displayName = "DropdownMenuPageTrigger";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuPage,
  DropdownMenuPageTrigger,
};