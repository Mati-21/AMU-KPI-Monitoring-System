import React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

const Switch = React.forwardRef(({ className = "", ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    {...props}
    className={`
      peer inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent
      cursor-pointer transition-colors
      data-[state=checked]:bg-primary
      data-[state=unchecked]:bg-input
      focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
      disabled:cursor-not-allowed disabled:opacity-50
      ${className}
    `}
  >
    <SwitchPrimitives.Thumb
      className="
        block h-5 w-5 rounded-full bg-background shadow-lg
        transition-transform
        data-[state=checked]:translate-x-5
        data-[state=unchecked]:translate-x-0
      "
    />
  </SwitchPrimitives.Root>
));

Switch.displayName = "Switch";

export { Switch };
