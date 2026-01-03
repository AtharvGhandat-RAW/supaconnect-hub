import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 shadow-sm",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/90 text-primary-foreground hover:bg-primary shadow-primary/20",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive/90 text-destructive-foreground hover:bg-destructive shadow-destructive/20",
        outline: "text-foreground border-border/60 bg-muted/30 hover:bg-muted/50",
        success: "border-transparent bg-green-600/90 text-white hover:bg-green-600 shadow-green-600/20",
        warning: "border-transparent bg-yellow-600/90 text-white hover:bg-yellow-600 shadow-yellow-600/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
