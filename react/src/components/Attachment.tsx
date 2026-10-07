import { forwardRef, type ComponentProps } from "react";
import { cn } from "../utils/cn";
import { Progress, type ProgressProps } from "./Progress";

export type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";

export interface AttachmentProps extends ComponentProps<"div"> {
  state?: AttachmentState;
  orientation?: "horizontal" | "vertical";
  size?: "default" | "sm" | "xs";
}

export const Attachment = forwardRef<HTMLDivElement, AttachmentProps>(
  ({ state = "idle", orientation = "horizontal", size = "default", className, ...props }, ref) => (
    <div aria-busy={state === "uploading" || state === "processing" || undefined} {...props}
      ref={ref} data-db-react="" data-state={state} className={cn(
        "db-attachment", orientation === "vertical" && "db-attachment--vertical",
        size !== "default" && `db-attachment--${size}`, className,
      )} />
  ),
);
Attachment.displayName = "Attachment";

export interface AttachmentMediaProps extends ComponentProps<"div"> {
  variant?: "default" | "image";
}
export const AttachmentMedia = forwardRef<HTMLDivElement, AttachmentMediaProps>(
  ({ variant = "default", className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-attachment__media", variant === "image" && "db-attachment__media--image", className)} />,
);
AttachmentMedia.displayName = "AttachmentMedia";

export const AttachmentContent = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-attachment__content", className)} />,
);
AttachmentContent.displayName = "AttachmentContent";

export const AttachmentTitle = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-attachment__title", className)} />,
);
AttachmentTitle.displayName = "AttachmentTitle";

export const AttachmentDescription = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-attachment__description", className)} />,
);
AttachmentDescription.displayName = "AttachmentDescription";

export const AttachmentActions = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-attachment__actions", className)} />,
);
AttachmentActions.displayName = "AttachmentActions";

export const AttachmentAction = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  ({ className, type = "button", ...props }, ref) => <button {...props} ref={ref} type={type} data-db-react="" className={cn("db-attachment__action", className)} />,
);
AttachmentAction.displayName = "AttachmentAction";

export const AttachmentTrigger = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  ({ className, type = "button", ...props }, ref) => <button {...props} ref={ref} type={type} data-db-react="" className={cn("db-attachment__trigger", className)} />,
);
AttachmentTrigger.displayName = "AttachmentTrigger";

export const AttachmentGroup = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  ({ className, ...props }, ref) => <div {...props} ref={ref} data-db-react="" className={cn("db-attachment-group", className)} />,
);
AttachmentGroup.displayName = "AttachmentGroup";

export type AttachmentProgressProps = ProgressProps;
export const AttachmentProgress = forwardRef<HTMLDivElement, AttachmentProgressProps>(
  ({ className, ...props }, ref) => <Progress {...props} ref={ref} className={cn("db-attachment__progress", className)} />,
);
AttachmentProgress.displayName = "AttachmentProgress";
