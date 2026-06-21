import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Dialog as Sheet,
  DialogClose as SheetClose,
  DialogDescription as SheetDescription,
  DialogFooter as SheetFooter,
  DialogHeader as SheetHeader,
  DialogTitle as SheetTitle,
  DialogTrigger as SheetTrigger,
} from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const sheetVariants = cva(
  "fixed z-50 gap-4 border bg-card p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 rounded-b-3xl border-b",
        bottom: "inset-x-0 bottom-0 rounded-t-3xl border-t",
        left: "inset-y-0 left-0 h-full w-3/4 rounded-r-3xl border-r sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 rounded-l-3xl border-l sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent> & VariantProps<typeof sheetVariants>
>(({ side = "right", className, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={cn(
      "translate-x-0 translate-y-0",
      side === "left" && "left-0 top-0",
      side === "right" && "left-auto right-0 top-0",
      side === "top" && "left-1/2 top-0",
      side === "bottom" && "left-1/2 bottom-0 top-auto",
      sheetVariants({ side }),
      className,
    )}
    {...props}
  />
));
SheetContent.displayName = "SheetContent";

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
