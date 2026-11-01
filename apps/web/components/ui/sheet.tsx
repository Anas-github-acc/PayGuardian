"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, type TargetAndTransition } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SheetContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextType | null>(null);

function useSheet(): SheetContextType {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within a <Sheet />");
  }
  return context;
}

export interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({
  open: controlledOpen,
  onOpenChange,
  children,
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  const contextValue = React.useMemo(() => ({ open, setOpen }), [open, setOpen]);

  return (
    <SheetContext.Provider value={contextValue}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </DialogPrimitive.Root>
    </SheetContext.Provider>
  );
}

export const SheetTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Trigger
    ref={ref}
    className={cn("outline-none", className)}
    {...props}
  />
));
SheetTrigger.displayName = "SheetTrigger";

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right";
  hideCloseButton?: boolean;
}

const sheetSides = {
  top: "inset-x-0 top-0 max-h-[85vh] border-b border-border",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] border-t border-border",
  left: "inset-y-0 left-0 h-full border-r border-border",
  right: "inset-y-0 right-0 h-full border-l border-border",
};

const slideFrom: Record<
  NonNullable<SheetContentProps["side"]>,
  { initial: TargetAndTransition; exit: TargetAndTransition }
> = {
  top: { initial: { y: "-100%" }, exit: { y: "-100%" } },
  bottom: { initial: { y: "100%" }, exit: { y: "100%" } },
  left: { initial: { x: "-100%" }, exit: { x: "-100%" } },
  right: { initial: { x: "100%" }, exit: { x: "100%" } },
};

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "right", hideCloseButton = false, className, children, ...props }, ref) => {
    const { open, setOpen } = useSheet();
    const slide = slideFrom[side];

    return (
      <DialogPrimitive.Portal forceMount>
        <AnimatePresence>
          {open && (
            <DialogPrimitive.Overlay asChild forceMount key="sheet-overlay">
              <motion.div
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>
          )}
          {open && (
            <DialogPrimitive.Content asChild forceMount key="sheet-content" {...props}>
              <motion.div
                ref={ref}
                role="dialog"
                aria-modal="true"
                initial={slide.initial}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={slide.exit}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  "fixed z-50 flex flex-col overflow-y-auto bg-card p-6 text-foreground shadow-2xl",
                  sheetSides[side],
                  "w-full max-w-md sm:max-w-md",
                  className
                )}
              >
                {!hideCloseButton && (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          )}
        </AnimatePresence>
      </DialogPrimitive.Portal>
    );
  }
);
SheetContent.displayName = "SheetContent";

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-left mb-4", className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-base font-semibold leading-none tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs text-muted-foreground leading-relaxed pt-1", className)}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-border mt-auto",
        className
      )}
      {...props}
    />
  );
}

export const SheetClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { setOpen } = useSheet();

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    />
  );
});
SheetClose.displayName = "SheetClose";
