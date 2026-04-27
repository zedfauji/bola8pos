export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span
        className="size-2 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="size-2 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="size-2 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}
