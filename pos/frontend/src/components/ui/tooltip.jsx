// Simple mock tooltip components for testing. Accept and forward any extra props
// to avoid type errors when used with Radix-style APIs (e.g., `asChild`).
/** @type {(props: { children?: import('react').ReactNode, asChild?: boolean, [key: string]: any } & import('react').HTMLAttributes<HTMLDivElement>) => JSX.Element} */
export const Tooltip = (
  /**
   * @param {{ children?: import('react').ReactNode } & import('react').HTMLAttributes<HTMLDivElement>} props
   */
  props
) => {
  const { children, ...rest } = props;
  return (
    <div data-testid="tooltip" {...rest}>
      {children}
    </div>
  );
};

/** @type {(props: { children?: import('react').ReactNode, asChild?: boolean, [key: string]: any } & import('react').HTMLAttributes<HTMLDivElement>) => JSX.Element} */
export const TooltipTrigger = (
  /**
   * @param {{ children?: import('react').ReactNode } & import('react').HTMLAttributes<HTMLDivElement>} props
   */
  props
) => {
  const { children, ...rest } = props;
  return (
    <div data-testid="tooltip-trigger" {...rest}>
      {children}
    </div>
  );
};

/** @type {(props: { children?: import('react').ReactNode, asChild?: boolean, [key: string]: any } & import('react').HTMLAttributes<HTMLDivElement>) => JSX.Element} */
export const TooltipContent = (
  /**
   * @param {{ children?: import('react').ReactNode } & import('react').HTMLAttributes<HTMLDivElement>} props
   */
  props
) => {
  const { children, ...rest } = props;
  return (
    <div data-testid="tooltip-content" {...rest}>
      {children}
    </div>
  );
};

/** @type {(props: { children?: import('react').ReactNode, asChild?: boolean, [key: string]: any } & import('react').HTMLAttributes<HTMLDivElement>) => JSX.Element} */
export const TooltipProvider = (
  /**
   * @param {{ children?: import('react').ReactNode } & import('react').HTMLAttributes<HTMLDivElement>} props
   */
  props
) => {
  const { children, ...rest } = props;
  return (
    <div data-testid="tooltip-provider" {...rest}>
      {children}
    </div>
  );
};

export default Tooltip;
