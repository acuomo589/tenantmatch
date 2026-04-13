import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn("ui-input", className)} {...props} />;
});
Input.displayName = "Input";

export { Input };
