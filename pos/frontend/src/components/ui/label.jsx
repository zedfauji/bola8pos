import { cn } from "../../lib/utils";

/**
 * Simple label component
 * @param {Object} props - Component props
 * @param {string} [props.className] - CSS class name
 * @param {React.ReactNode} [props.children] - Child elements
 * @returns {JSX.Element} Label component
 */
/**
 * @param {(
 *   import('react').LabelHTMLAttributes<HTMLLabelElement>
 *   & { className?: string, children?: import('react').ReactNode }
 * )} props
 */
function Label({
  className,
  children,
  ...props
}) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className || ""
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export { Label };
