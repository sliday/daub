import { createContext, forwardRef, useContext, useRef, useImperativeHandle, type ComponentProps } from "react";
import {
  MessageScroller as HeadlessMessageScroller,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";
import { cn } from "../utils/cn";
import { Button } from "./Button";

export { useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility };
export type {
  MessageScrollerDefaultScrollPosition, MessageScrollerScrollAlign,
  MessageScrollerScrollOptions, MessageScrollerScrollable, MessageScrollerVisibilityState,
} from "@shadcn/react/message-scroller";

export type MessageScrollerProviderProps = ComponentProps<typeof HeadlessMessageScroller.Provider>;
export type MessageScrollerProps = ComponentProps<"div">;
export type MessageScrollerViewportProps = ComponentProps<typeof HeadlessMessageScroller.Viewport>;
export type MessageScrollerContentProps = ComponentProps<typeof HeadlessMessageScroller.Content>;
export interface MessageScrollerItemProps extends ComponentProps<typeof HeadlessMessageScroller.Item> {
  messageId: string;
}
export type MessageScrollerButtonProps = ComponentProps<typeof HeadlessMessageScroller.Button>;

const OptionsContext = createContext({ autoScroll: true, defaultScrollPosition: "end", scrollPreviousItemPeek: 64 });

export function MessageScrollerProvider({ autoScroll = true, defaultScrollPosition = "end", scrollPreviousItemPeek = 64, children, ...props }: MessageScrollerProviderProps) {
  return (
    <OptionsContext.Provider value={{ autoScroll, defaultScrollPosition, scrollPreviousItemPeek }}>
      <HeadlessMessageScroller.Provider {...props} autoScroll={autoScroll} defaultScrollPosition={defaultScrollPosition} scrollPreviousItemPeek={scrollPreviousItemPeek}>
        {children}
      </HeadlessMessageScroller.Provider>
    </OptionsContext.Provider>
  );
}

export const MessageScroller = forwardRef<HTMLDivElement, MessageScrollerProps>(
  ({ className, children, ...props }, ref) => {
    const locatorRef = useRef<HTMLSpanElement>(null);
    const options = useContext(OptionsContext);
    // The engine owns its root callback ref; keep it intact when exposing the DOM node.
    useImperativeHandle(ref, () => locatorRef.current!.parentElement as HTMLDivElement, []);
    return <HeadlessMessageScroller.Root {...props} data-db-react=""
      data-db-auto-scroll={String(options.autoScroll)} data-db-scroll-position={options.defaultScrollPosition}
      data-db-scroll-peek={options.scrollPreviousItemPeek} className={cn("db-message-scroller", className)}>
      <span ref={locatorRef} hidden aria-hidden="true" style={{ display: "none" }} />
      {children}
    </HeadlessMessageScroller.Root>;
  },
);
MessageScroller.displayName = "MessageScroller";

export const MessageScrollerViewport = forwardRef<HTMLDivElement, MessageScrollerViewportProps>(
  ({ className, ...props }, ref) => <HeadlessMessageScroller.Viewport {...props} ref={ref} data-db-react="" className={cn("db-message-scroller__viewport", className)} />,
);
MessageScrollerViewport.displayName = "MessageScrollerViewport";

export const MessageScrollerContent = forwardRef<HTMLDivElement, MessageScrollerContentProps>(
  ({ className, ...props }, ref) => <HeadlessMessageScroller.Content {...props} ref={ref} data-db-react="" className={cn("db-message-scroller__content", className)} />,
);
MessageScrollerContent.displayName = "MessageScrollerContent";

export const MessageScrollerItem = forwardRef<HTMLDivElement, MessageScrollerItemProps>(
  ({ messageId, scrollAnchor = false, className, ...props }, ref) => <HeadlessMessageScroller.Item {...props} ref={ref}
    messageId={messageId} scrollAnchor={scrollAnchor} data-db-react="" data-db-message-id={messageId}
    data-db-scroll-anchor={scrollAnchor ? "true" : undefined} className={cn("db-message-scroller__item", className)} />,
);
MessageScrollerItem.displayName = "MessageScrollerItem";

export const MessageScrollerButton = forwardRef<HTMLButtonElement, MessageScrollerButtonProps>(
  ({ className, direction = "end", children, hidden, disabled, render, "aria-label": label, ...props }, ref) => {
    const scrollable = useMessageScrollerScrollable();
    return <HeadlessMessageScroller.Button {...props} ref={ref} direction={direction} disabled={disabled}
      hidden={hidden || disabled || !scrollable[direction]} aria-label={label ?? `Scroll to ${direction}`}
      data-db-react="" data-db-scroll-to={direction} className={cn("db-message-scroller__button", className)}
      render={render ?? <Button size="icon" variant="secondary" />}>
      {children ?? <span aria-hidden="true">{direction === "end" ? "\u2193" : "\u2191"}</span>}
    </HeadlessMessageScroller.Button>;
  },
);
MessageScrollerButton.displayName = "MessageScrollerButton";
