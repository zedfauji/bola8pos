// Simple mock slider component for testing
/** @type {(props: { value: number | number[], min?: number, max?: number, step?: number, onValueChange?: (val: number[] | number) => void, className?: string, [key: string]: any }) => JSX.Element} */
export const Slider = (
  /**
   * @param {{
   *  value: number | number[]
   *  min?: number
   *  max?: number
   *  step?: number
   *  onValueChange?: (val: number[] | number) => void
   *  className?: string
   *  [key: string]: any
   * }} props
   */
  props
) => {
  const { value, min = 0, max = 100, step = 1, onValueChange, className = '', ...rest } = props;
  const numericValue = Array.isArray(value) ? (value[0] ?? 0) : (/** @type {number} */(value ?? 0));
  return (
    <div
      className={`slider ${className}`}
      data-testid={rest['data-testid'] || 'slider'}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        onChange={(e) => {
          const next = Number(e.target.value);
          // Emit array to match Radix Slider API expectations in codebase
          onValueChange?.([next]);
        }}
        className="slider-input"
      />
    </div>
  );
};

export default Slider;
