import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";

export interface MessageProps extends ComponentProps<"div"> {
  align?: "start" | "end";
}

export const Message = forwardRef<HTMLDivElement, MessageProps>(
  ({ align = "start", className, ...props }, ref) => (
    <div {...props} ref={ref} data-db-react="" className={cn("db-message", align === "end" && "db-message--end", className)} />
  ),
);
Message.displayName = "Message";

export const MessageAvatar = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-message__avatar", className)} />,
);
MessageAvatar.displayName = "MessageAvatar";

export const MessageContent = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-message__content", className)} />,
);
MessageContent.displayName = "MessageContent";

export const MessageHeader = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-message__header", className)} />,
);
MessageHeader.displayName = "MessageHeader";

export const MessageFooter = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-message__footer", className)} />,
);
MessageFooter.displayName = "MessageFooter";

export const MessageGroup = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-message-group", className)} />,
);
MessageGroup.displayName = "MessageGroup";
