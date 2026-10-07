import * as react from 'react';
import { ComponentProps, ReactNode } from 'react';
import * as react_jsx_runtime from 'react/jsx-runtime';
import { MessageScroller as MessageScroller$1 } from '@shadcn/react/message-scroller';
export { MessageScrollerDefaultScrollPosition, MessageScrollerScrollAlign, MessageScrollerScrollOptions, MessageScrollerScrollable, MessageScrollerVisibilityState, useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility } from '@shadcn/react/message-scroller';

type Size = "sm" | "lg";
type ButtonVariant = "primary" | "secondary" | "ghost";
type AlertVariant = "info" | "warning" | "error" | "success";
type BadgeVariant = "new" | "updated" | "success" | "warning" | "error" | "danger" | "info";
type SurfaceVariant = "base" | "raised" | "inset" | "pressed" | "bordered";
type ChipColor = "red" | "green" | "blue" | "purple" | "amber" | "pink";
type AspectRatio$1 = "16-9" | "4-3" | "1-1" | "21-9";
type ContainerSize = "default" | "wide" | "narrow";
type SkeletonVariant = "text" | "heading" | "avatar" | "btn";
type GapToken = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type Justify = "start" | "end" | "center" | "between" | "around";
type Align = "start" | "end" | "center" | "stretch";
interface StackProps extends ComponentProps<"div"> {
    direction?: "vertical" | "horizontal";
    gap?: GapToken;
    justify?: Justify;
    align?: Align;
    wrap?: boolean;
    container?: boolean | "wide" | "narrow";
}
declare const Stack: react.ForwardRefExoticComponent<Omit<StackProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface GridProps extends ComponentProps<"div"> {
    columns?: 2 | 3 | 4 | 5 | 6;
    gap?: GapToken;
    align?: "center" | "end";
    container?: boolean | "wide" | "narrow";
}
declare const Grid: react.ForwardRefExoticComponent<Omit<GridProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SurfaceProps extends ComponentProps<"div"> {
    variant?: SurfaceVariant;
}
declare const Surface: react.ForwardRefExoticComponent<Omit<SurfaceProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ContainerProps extends ComponentProps<"div"> {
    size?: ContainerSize;
}
declare const Container: react.ForwardRefExoticComponent<Omit<ContainerProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

type SeparatorDivProps = ComponentProps<"div"> & {
    label: string;
    vertical?: boolean;
    dashed?: boolean;
};
type SeparatorHrProps = ComponentProps<"hr"> & {
    label?: undefined;
    vertical?: boolean;
    dashed?: boolean;
};
declare const Separator: react.ForwardRefExoticComponent<(Omit<SeparatorDivProps, "ref"> | Omit<SeparatorHrProps, "ref">) & react.RefAttributes<HTMLDivElement | HTMLHRElement>>;

interface ScrollAreaProps extends ComponentProps<"div"> {
    horizontal?: boolean;
}
declare const ScrollArea: react.ForwardRefExoticComponent<Omit<ScrollAreaProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

type MessageScrollerProviderProps = ComponentProps<typeof MessageScroller$1.Provider>;
type MessageScrollerProps = ComponentProps<"div">;
type MessageScrollerViewportProps = ComponentProps<typeof MessageScroller$1.Viewport>;
type MessageScrollerContentProps = ComponentProps<typeof MessageScroller$1.Content>;
interface MessageScrollerItemProps extends ComponentProps<typeof MessageScroller$1.Item> {
    messageId: string;
}
type MessageScrollerButtonProps = ComponentProps<typeof MessageScroller$1.Button>;
declare function MessageScrollerProvider({ autoScroll, defaultScrollPosition, scrollPreviousItemPeek, children, ...props }: MessageScrollerProviderProps): react_jsx_runtime.JSX.Element;
declare const MessageScroller: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageScrollerViewport: react.ForwardRefExoticComponent<Omit<react.ClassAttributes<HTMLDivElement> & react.HTMLAttributes<HTMLDivElement> & {
    preserveScrollOnPrepend?: boolean;
}, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageScrollerContent: react.ForwardRefExoticComponent<Omit<react.ClassAttributes<HTMLDivElement> & react.HTMLAttributes<HTMLDivElement> & {
    spacerClassName?: string;
}, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageScrollerItem: react.ForwardRefExoticComponent<Omit<MessageScrollerItemProps, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageScrollerButton: react.ForwardRefExoticComponent<Omit<react.ClassAttributes<HTMLButtonElement> & react.ButtonHTMLAttributes<HTMLButtonElement> & {
    render?: (react.ReactElement<unknown, string | react.JSXElementConstructor<any>> | ((props: Record<string, unknown>, state: {
        active: boolean;
        direction: "start" | "end";
    }) => React.ReactElement | null)) | undefined;
} & {
    behavior?: ScrollBehavior;
    direction?: "start" | "end";
}, "ref"> & react.RefAttributes<HTMLButtonElement>>;

interface MessageProps extends ComponentProps<"div"> {
    align?: "start" | "end";
}
declare const Message: react.ForwardRefExoticComponent<Omit<MessageProps, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageAvatar: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageContent: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageHeader: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageFooter: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MessageGroup: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CollapsibleProps extends Omit<ComponentProps<"div">, "onChange"> {
    open?: boolean;
    defaultOpen?: boolean;
    onChange?: (open: boolean) => void;
    trigger: ReactNode;
}
declare const Collapsible: react.ForwardRefExoticComponent<Omit<CollapsibleProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

type BubbleVariant = "default" | "primary" | "secondary" | "muted" | "tinted" | "outline" | "ghost" | "destructive";
interface BubbleProps extends ComponentProps<"div"> {
    variant?: BubbleVariant;
    align?: "start" | "end";
}
declare const Bubble: react.ForwardRefExoticComponent<Omit<BubbleProps, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const BubbleContent: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const BubbleReactions: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const BubbleGroup: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
type BubbleCollapsibleProps = CollapsibleProps;
declare const BubbleCollapsible: react.ForwardRefExoticComponent<Omit<CollapsibleProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ProgressProps extends ComponentProps<"div"> {
    value?: number;
    indeterminate?: boolean;
}
declare const Progress: react.ForwardRefExoticComponent<Omit<ProgressProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";
interface AttachmentProps extends ComponentProps<"div"> {
    state?: AttachmentState;
    orientation?: "horizontal" | "vertical";
    size?: "default" | "sm" | "xs";
}
declare const Attachment: react.ForwardRefExoticComponent<Omit<AttachmentProps, "ref"> & react.RefAttributes<HTMLDivElement>>;
interface AttachmentMediaProps extends ComponentProps<"div"> {
    variant?: "default" | "image";
}
declare const AttachmentMedia: react.ForwardRefExoticComponent<Omit<AttachmentMediaProps, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const AttachmentContent: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const AttachmentTitle: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const AttachmentDescription: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const AttachmentActions: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const AttachmentAction: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref"> & react.RefAttributes<HTMLButtonElement>>;
declare const AttachmentTrigger: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref"> & react.RefAttributes<HTMLButtonElement>>;
declare const AttachmentGroup: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;
type AttachmentProgressProps = ProgressProps;
declare const AttachmentProgress: react.ForwardRefExoticComponent<Omit<ProgressProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface MarkerProps extends ComponentProps<"div"> {
    variant?: "default" | "border" | "separator";
    busy?: boolean;
}
declare const Marker: react.ForwardRefExoticComponent<Omit<MarkerProps, "ref"> & react.RefAttributes<HTMLDivElement>>;
declare const MarkerIcon: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>, "ref"> & react.RefAttributes<HTMLSpanElement>>;
declare const MarkerContent: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ChatComposerModel {
    id: string;
    label: string;
    efforts?: string[];
}
interface ChatComposerAction {
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
}
interface ChatComposerCapabilities {
    queue?: boolean;
    steer?: boolean;
    attachments?: boolean;
    folders?: boolean;
    dictation?: boolean;
    approval?: boolean;
}
interface ChatComposerOptions {
    models?: ChatComposerModel[];
    model?: string;
    effort?: string;
    approval?: "ask" | "auto";
    mode?: "chat" | "plan";
    actions?: ChatComposerAction[];
    capabilities?: ChatComposerCapabilities;
    busy?: boolean;
    placeholder?: string;
}
interface ChatComposerRequest {
    id: string;
    text: string;
    files: File[];
    model: string;
    effort: string;
    approval: "ask" | "auto";
    mode: "chat" | "plan";
    goal?: string | null;
}
type ChatComposerDictationState = "unsupported" | "listening" | "stopped" | "error";
interface ChatComposerState extends Omit<ChatComposerRequest, "id" | "goal"> {
    queue: ChatComposerRequest[];
    busy: boolean;
    goal: string | null;
    dictation: ChatComposerDictationState;
}
interface ChatComposerController {
    getState(): ChatComposerState;
    setBusy(busy: boolean): void;
    setStatus(status: string): void;
    setDraft(text: string): boolean;
    clearDraft(): boolean;
    updateOptions(options: ChatComposerOptions): boolean;
    attachFiles(files: File[]): boolean;
    getQueue(): ChatComposerRequest[];
    takeNext(): ChatComposerRequest | null;
    removeQueued(id: string): boolean;
    editQueued(id: string, text: string): boolean;
    steerQueued(id: string): boolean;
    setModel(id: string): boolean;
    setEffort(value: string): boolean;
    setMode(value: "chat" | "plan"): boolean;
    setApproval(value: "ask" | "auto"): boolean;
    setGoal(goal: string | null): boolean;
    startDictation(): boolean;
    stopDictation(): boolean;
    destroy(): void;
}
interface ChatComposerConfig extends Pick<ChatComposerState, "model" | "effort" | "approval" | "mode" | "goal"> {
}
interface ChatComposerQueueDetail {
    request: ChatComposerRequest | null;
    queue: ChatComposerRequest[];
}
interface ChatComposerDictationDetail {
    state: ChatComposerDictationState;
    error?: string;
}
interface ChatComposerChangeDetail {
    state: ChatComposerState;
}
interface ChatComposerActionDetail {
    action: string | ChatComposerAction;
    request?: ChatComposerRequest;
}
interface ChatComposerProps extends Omit<ComponentProps<"form">, "children" | "dangerouslySetInnerHTML" | "onChange">, ChatComposerOptions {
    onSend?: (event: CustomEvent<{
        request: ChatComposerRequest;
    }>) => void;
    onSteer?: (event: CustomEvent<{
        request: ChatComposerRequest;
    }>) => void;
    onStop?: (event: CustomEvent) => void;
    onAction?: (event: CustomEvent<ChatComposerActionDetail>) => void;
    onQueue?: (event: CustomEvent<ChatComposerQueueDetail>) => void;
    onConfig?: (event: CustomEvent<ChatComposerConfig>) => void;
    onDictation?: (event: CustomEvent<ChatComposerDictationDetail>) => void;
    onChange?: (event: CustomEvent<ChatComposerChangeDetail>) => void;
    onReady?: (controller: ChatComposerController) => void;
}
/** Requires daub.js alongside daub.css; the native controller owns the form contents. */
declare const ChatComposer: react.ForwardRefExoticComponent<Omit<ChatComposerProps, "ref"> & react.RefAttributes<HTMLFormElement>>;

interface AspectRatioProps extends ComponentProps<"div"> {
    ratio?: AspectRatio$1;
}
declare const AspectRatio: react.ForwardRefExoticComponent<Omit<AspectRatioProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface FrameProps extends ComponentProps<"div"> {
    header?: ReactNode;
    footer?: ReactNode;
    flush?: boolean;
}
declare const Frame: react.ForwardRefExoticComponent<Omit<FrameProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface GroupProps extends ComponentProps<"div"> {
    attached?: boolean;
    vertical?: boolean;
}
declare const Group: react.ForwardRefExoticComponent<Omit<GroupProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ToolbarProps extends ComponentProps<"div"> {
    vertical?: boolean;
}
declare const Toolbar: react.ForwardRefExoticComponent<Omit<ToolbarProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CardProps extends ComponentProps<"div"> {
    title?: string;
    description?: string;
    media?: ReactNode;
    footer?: ReactNode;
    clip?: boolean;
    interactive?: boolean;
}
declare const Card: react.ForwardRefExoticComponent<Omit<CardProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface BadgeProps extends ComponentProps<"span"> {
    variant?: BadgeVariant;
}
declare const Badge: react.ForwardRefExoticComponent<Omit<BadgeProps, "ref"> & react.RefAttributes<HTMLSpanElement>>;

interface AvatarProps extends ComponentProps<"div"> {
    src?: string;
    alt?: string;
    initials?: string;
    size?: "sm" | "md" | "lg";
    fallback?: ReactNode;
}
declare const Avatar: react.ForwardRefExoticComponent<Omit<AvatarProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface AvatarGroupProps extends ComponentProps<"div"> {
    max?: number;
}
declare const AvatarGroup: react.ForwardRefExoticComponent<Omit<AvatarGroupProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface AlertProps extends ComponentProps<"div"> {
    variant?: AlertVariant;
    title?: string;
}
declare const Alert: react.ForwardRefExoticComponent<Omit<AlertProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface MeterProps extends Omit<ComponentProps<"div">, "children"> {
    value?: number;
    min?: number;
    max?: number;
    status?: "success" | "warning" | "error";
}
declare const Meter: react.ForwardRefExoticComponent<Omit<MeterProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SkeletonProps extends ComponentProps<"div"> {
    variant?: SkeletonVariant;
    lines?: number;
}
declare const Skeleton: react.ForwardRefExoticComponent<Omit<SkeletonProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface EmptyStateProps extends ComponentProps<"div"> {
    title?: string;
    message?: string;
    icon?: ReactNode;
}
declare const EmptyState: react.ForwardRefExoticComponent<Omit<EmptyStateProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SpinnerProps extends ComponentProps<"span"> {
    size?: "sm" | "lg" | "xl";
}
declare const Spinner: react.ForwardRefExoticComponent<Omit<SpinnerProps, "ref"> & react.RefAttributes<HTMLSpanElement>>;

interface StatCardProps extends ComponentProps<"div"> {
    label: string;
    value: string | number;
    trend?: "up" | "down";
    trendValue?: string;
    icon?: ReactNode;
    horizontal?: boolean;
}
declare const StatCard: react.ForwardRefExoticComponent<Omit<StatCardProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ChartCardProps extends ComponentProps<"div"> {
    title?: string;
    emptyState?: ReactNode;
}
declare const ChartCard: react.ForwardRefExoticComponent<Omit<ChartCardProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface PreviewCardProps extends Omit<ComponentProps<"div">, "title"> {
    trigger: ReactNode;
    title?: ReactNode;
    description?: ReactNode;
    media?: ReactNode;
}
declare const PreviewCard: react.ForwardRefExoticComponent<Omit<PreviewCardProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

declare const Image: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>, "ref"> & react.RefAttributes<HTMLImageElement>>;

interface ChartBar {
    value: number;
    label?: string;
}
interface ChartProps extends Omit<ComponentProps<"div">, "children"> {
    bars: ChartBar[];
    secondary?: boolean;
}
declare const Chart: react.ForwardRefExoticComponent<Omit<ChartProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ButtonProps extends ComponentProps<"button"> {
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "lg" | "icon";
    loading?: boolean;
    icon?: ReactNode;
}
declare const Button: react.ForwardRefExoticComponent<Omit<ButtonProps, "ref"> & react.RefAttributes<HTMLButtonElement>>;

declare const ButtonGroup: react.ForwardRefExoticComponent<Omit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface InputProps extends ComponentProps<"input"> {
    error?: boolean;
    inputSize?: "sm" | "lg";
}
declare const Input: react.ForwardRefExoticComponent<Omit<InputProps, "ref"> & react.RefAttributes<HTMLInputElement>>;

interface TextareaProps extends ComponentProps<"textarea"> {
    error?: boolean;
}
declare const Textarea: react.ForwardRefExoticComponent<Omit<TextareaProps, "ref"> & react.RefAttributes<HTMLTextAreaElement>>;

interface FieldProps extends ComponentProps<"div"> {
    label?: string;
    helper?: string;
    error?: boolean | string;
    htmlFor?: string;
}
declare const Field: react.ForwardRefExoticComponent<Omit<FieldProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface FieldsetProps extends ComponentProps<"fieldset"> {
    legend?: ReactNode;
    helper?: ReactNode;
}
declare const Fieldset: react.ForwardRefExoticComponent<Omit<FieldsetProps, "ref"> & react.RefAttributes<HTMLFieldSetElement>>;

interface InputGroupProps extends ComponentProps<"div"> {
    addonBefore?: ReactNode;
    addonAfter?: ReactNode;
}
declare const InputGroup: react.ForwardRefExoticComponent<Omit<InputGroupProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface InputIconProps extends ComponentProps<"div"> {
    icon?: ReactNode;
    right?: boolean;
}
declare const InputIcon: react.ForwardRefExoticComponent<Omit<InputIconProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SearchProps extends Omit<ComponentProps<"input">, "type"> {
    placeholder?: string;
    value?: string;
    onChange?: ComponentProps<"input">["onChange"];
}
declare const Search: react.ForwardRefExoticComponent<Omit<SearchProps, "ref"> & react.RefAttributes<HTMLInputElement>>;

interface SelectOption$1 {
    value: string;
    label: string;
}
interface SelectProps extends Omit<ComponentProps<"select">, "children"> {
    label?: string;
    options?: SelectOption$1[];
}
declare const Select: react.ForwardRefExoticComponent<Omit<SelectProps, "ref"> & react.RefAttributes<HTMLSelectElement>>;

interface LabelProps extends ComponentProps<"label"> {
    required?: boolean;
    optional?: boolean;
}
declare const Label: react.ForwardRefExoticComponent<Omit<LabelProps, "ref"> & react.RefAttributes<HTMLLabelElement>>;

interface KbdProps extends ComponentProps<"kbd"> {
    keys?: string[];
}
declare const Kbd: react.ForwardRefExoticComponent<Omit<KbdProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface ProseProps extends ComponentProps<"article"> {
    size?: "sm" | "lg" | "xl" | "2xl";
}
declare const Prose: react.ForwardRefExoticComponent<Omit<ProseProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface ListItem {
    title: string;
    secondary?: string;
    icon?: ReactNode;
}
interface ListProps extends ComponentProps<"div"> {
    items?: ListItem[];
}
declare const List: react.ForwardRefExoticComponent<Omit<ListProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface TableProps extends Omit<ComponentProps<"div">, "children"> {
    columns: string[];
    rows: (string | number)[][];
    sortable?: boolean;
}
declare const Table: react.ForwardRefExoticComponent<Omit<TableProps, "ref"> & react.RefAttributes<HTMLTableElement>>;

interface DataTableColumn {
    label: string;
    sortable?: boolean;
}
interface DataTableProps extends Omit<ComponentProps<"div">, "children"> {
    columns: DataTableColumn[];
    rows: (string | number)[][];
    selectable?: boolean;
    sort?: {
        column: number;
        direction: "ascending" | "descending";
    } | null;
    defaultSort?: {
        column: number;
        direction: "ascending" | "descending";
    } | null;
    onSortChange?: (sort: {
        column: number;
        direction: "ascending" | "descending";
    } | null) => void;
    selectedRows?: number[];
    defaultSelectedRows?: number[];
    onSelectionChange?: (rows: number[]) => void;
    selectAllLabel?: string;
    getRowLabel?: (row: (string | number)[], index: number) => string;
}
declare const DataTable: react.ForwardRefExoticComponent<Omit<DataTableProps, "ref"> & react.RefAttributes<HTMLTableElement>>;

interface ChipProps extends ComponentProps<"span"> {
    color?: "red" | "green" | "blue" | "purple" | "amber" | "pink";
    active?: boolean;
    closable?: boolean;
    onClose?: () => void;
    closeLabel?: string;
}
declare const Chip: react.ForwardRefExoticComponent<Omit<ChipProps, "ref"> & react.RefAttributes<HTMLSpanElement>>;

interface BreadcrumbItem {
    label: string;
    href?: string;
}
interface BreadcrumbsProps extends Omit<ComponentProps<"nav">, "children"> {
    items: BreadcrumbItem[];
}
declare const Breadcrumbs: react.ForwardRefExoticComponent<Omit<BreadcrumbsProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface PaginationProps extends Omit<ComponentProps<"nav">, "children" | "onChange"> {
    current: number;
    total: number;
    perPage?: number;
    onChange?: (page: number) => void;
    disabled?: boolean;
}
declare const Pagination: react.ForwardRefExoticComponent<Omit<PaginationProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface NavMenuItem {
    label: string;
    href?: string;
    active?: boolean;
    onClick?: () => void;
}
interface NavMenuProps extends Omit<ComponentProps<"nav">, "children"> {
    items: NavMenuItem[];
}
declare const NavMenu: react.ForwardRefExoticComponent<Omit<NavMenuProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface BottomNavItem {
    icon?: ReactNode;
    label: string;
    href?: string;
    active?: boolean;
    badge?: string;
    onClick?: () => void;
}
interface BottomNavProps extends Omit<ComponentProps<"nav">, "children"> {
    items: BottomNavItem[];
}
declare const BottomNav: react.ForwardRefExoticComponent<Omit<BottomNavProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface StepperStep {
    label: string;
    completed?: boolean;
    active?: boolean;
}
interface StepperProps extends Omit<ComponentProps<"div">, "children"> {
    steps: StepperStep[];
    vertical?: boolean;
}
declare const Stepper: react.ForwardRefExoticComponent<Omit<StepperProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface NavbarProps extends ComponentProps<"nav"> {
    brand?: ReactNode;
    brandHref?: string;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    disabled?: boolean;
}
declare const Navbar: react.ForwardRefExoticComponent<Omit<NavbarProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface HoverCardProps extends Omit<ComponentProps<"div">, "content"> {
    trigger: ReactNode;
    content: ReactNode;
}
declare const HoverCard: react.ForwardRefExoticComponent<Omit<HoverCardProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ThemeProviderProps {
    theme?: string;
    children: ReactNode;
}
declare function ThemeProvider({ theme, children }: ThemeProviderProps): react_jsx_runtime.JSX.Element;
declare namespace ThemeProvider {
    var displayName: string;
}

interface TabItem {
    label: string;
    content: ReactNode;
    disabled?: boolean;
}
interface TabsProps extends Omit<ComponentProps<"div">, "onChange"> {
    tabs: TabItem[];
    activeTab?: number;
    defaultActiveTab?: number;
    onChange?: (index: number) => void;
    orientation?: "horizontal" | "vertical";
    tabListProps?: Omit<ComponentProps<"div">, "children">;
}
declare const Tabs: react.ForwardRefExoticComponent<Omit<TabsProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface AccordionItem {
    trigger: string;
    content: ReactNode;
    disabled?: boolean;
}
interface AccordionProps extends Omit<ComponentProps<"div">, "onChange"> {
    items: AccordionItem[];
    multi?: boolean;
    openItems?: number[];
    defaultOpenItems?: number[];
    onChange?: (indices: number[]) => void;
}
declare const Accordion: react.ForwardRefExoticComponent<Omit<AccordionProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SelectOption {
    label: string;
    value: string;
    disabled?: boolean;
}
interface CustomSelectProps extends Omit<ComponentProps<"div">, "onChange"> {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    searchable?: boolean;
    disabled?: boolean;
}
declare const CustomSelect: react.ForwardRefExoticComponent<Omit<CustomSelectProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CalendarProps extends Omit<ComponentProps<"div">, "onChange"> {
    selected?: string;
    defaultSelected?: string;
    onChange?: (date: string) => void;
    month?: Date;
    onMonthChange?: (month: Date) => void;
    disabled?: boolean;
    min?: string;
    max?: string;
}
declare const Calendar: react.ForwardRefExoticComponent<Omit<CalendarProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface DatePickerProps extends Omit<ComponentProps<"div">, "onChange"> {
    value?: string;
    defaultValue?: string;
    onChange?: (date: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    name?: string;
    min?: string;
    max?: string;
    inputProps?: Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange">;
}
declare const DatePicker: react.ForwardRefExoticComponent<Omit<DatePickerProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CarouselProps extends Omit<ComponentProps<"div">, "onChange"> {
    current?: number;
    defaultCurrent?: number;
    onChange?: (index: number) => void;
    autoplay?: boolean;
    duration?: number;
    previousLabel?: string;
    nextLabel?: string;
    disabled?: boolean;
}
declare const Carousel: react.ForwardRefExoticComponent<Omit<CarouselProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CheckboxProps extends Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked" | "onChange"> {
    checked?: boolean;
    defaultChecked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
    indeterminate?: boolean;
}
declare const Checkbox: react.ForwardRefExoticComponent<Omit<CheckboxProps, "ref"> & react.RefAttributes<HTMLInputElement>>;

interface CheckboxGroupProps extends Omit<ComponentProps<"div">, "defaultValue"> {
    label?: ReactNode;
    helper?: ReactNode;
    inline?: boolean;
    value?: string[];
    defaultValue?: string[];
    onValueChange?: (values: string[]) => void;
    disabled?: boolean;
}
declare const CheckboxGroup: react.ForwardRefExoticComponent<Omit<CheckboxGroupProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface RadioProps extends Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked" | "onChange"> {
    checked?: boolean;
    defaultChecked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
}
declare const Radio: react.ForwardRefExoticComponent<Omit<RadioProps, "ref"> & react.RefAttributes<HTMLInputElement>>;

interface RadioGroupProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    name?: string;
    options?: {
        label: string;
        value: string;
        disabled?: boolean;
    }[];
    disabled?: boolean;
    required?: boolean;
}
declare const RadioGroup: react.ForwardRefExoticComponent<Omit<RadioGroupProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SwitchProps extends Omit<ComponentProps<"div">, "onChange" | "role"> {
    checked?: boolean;
    defaultChecked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
}
declare const Switch: react.ForwardRefExoticComponent<Omit<SwitchProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SliderProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
    value?: number;
    defaultValue?: number;
    onChange?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    disabled?: boolean;
    name?: string;
    form?: string;
    inputProps?: Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step">;
}
declare const Slider: react.ForwardRefExoticComponent<Omit<SliderProps, "ref"> & react.RefAttributes<HTMLInputElement>>;

interface NumberFieldProps extends Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> {
    value?: number;
    defaultValue?: number;
    onChange?: (value: number) => void;
    step?: number;
    min?: number;
    max?: number;
}
declare const NumberField: react.ForwardRefExoticComponent<Omit<NumberFieldProps, "ref"> & react.RefAttributes<HTMLInputElement>>;

interface ToggleProps extends Omit<ComponentProps<"button">, "onChange"> {
    pressed?: boolean;
    defaultPressed?: boolean;
    onChange?: (pressed: boolean) => void;
    size?: "sm";
}
declare const Toggle: react.ForwardRefExoticComponent<Omit<ToggleProps, "ref"> & react.RefAttributes<HTMLButtonElement>>;

interface ToggleGroupProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    multiple?: boolean;
    values?: string[];
    defaultValues?: string[];
    onValuesChange?: (values: string[]) => void;
    disabled?: boolean;
}
declare const ToggleGroup: react.ForwardRefExoticComponent<Omit<ToggleGroupProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface InputOTPProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
    length?: number;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    separator?: number;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    name?: string;
}
declare const InputOTP: react.ForwardRefExoticComponent<Omit<InputOTPProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ModalProps extends Omit<ComponentProps<"div">, "onClose"> {
    open: boolean;
    onClose: () => void;
    title?: string;
    footer?: ReactNode;
    className?: string;
    children?: ReactNode;
}
declare const Modal: react.ForwardRefExoticComponent<Omit<ModalProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface AlertDialogProps extends Omit<ComponentProps<"div">, "onClose"> {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    variant?: "danger" | "warning" | "info";
}
declare const AlertDialog: react.ForwardRefExoticComponent<Omit<AlertDialogProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SheetProps extends Omit<ComponentProps<"div">, "onClose"> {
    open: boolean;
    onClose: () => void;
    side?: "right" | "left" | "top" | "bottom";
    title?: string;
    children?: ReactNode;
}
declare const Sheet: react.ForwardRefExoticComponent<Omit<SheetProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface DrawerProps extends Omit<ComponentProps<"div">, "onClose"> {
    open: boolean;
    onClose: () => void;
    children?: ReactNode;
}
declare const Drawer: react.ForwardRefExoticComponent<Omit<DrawerProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface ToastProps {
    id: string;
    type?: "info" | "success" | "warning" | "error";
    title?: string;
    message: string;
    onDismiss: (id: string) => void;
    dismissLabel?: string;
    role?: "status" | "alert";
}
declare function Toast({ id, type, title, message, onDismiss, dismissLabel, role }: ToastProps): react_jsx_runtime.JSX.Element;

interface ToastOpts {
    type?: "info" | "success" | "warning" | "error";
    title?: string;
    message: string;
    duration?: number;
}
interface ToastContextValue {
    toast: (opts: ToastOpts) => void;
}
declare function ToastProvider({ children }: {
    children: ReactNode;
}): react_jsx_runtime.JSX.Element;
declare function useToast(): ToastContextValue;

type TooltipPosition = "top" | "bottom" | "left" | "right";
interface TooltipProps {
    content: ReactNode;
    position?: TooltipPosition;
    children: ReactNode;
    className?: string;
}
declare const Tooltip: react.ForwardRefExoticComponent<TooltipProps & react.RefAttributes<HTMLDivElement>>;

type PopoverPosition = "top" | "bottom" | "left" | "right";
interface PopoverProps {
    trigger: ReactNode;
    content: ReactNode;
    position?: PopoverPosition;
    open?: boolean;
    defaultOpen?: boolean;
    onChange?: (open: boolean) => void;
    className?: string;
}
declare const Popover: react.ForwardRefExoticComponent<PopoverProps & react.RefAttributes<HTMLDivElement>>;

interface DropdownMenuItem {
    label: string;
    onClick?: () => void;
    icon?: ReactNode;
    divider?: boolean;
    disabled?: boolean;
}
interface DropdownMenuProps {
    trigger: ReactNode;
    items: DropdownMenuItem[];
    align?: "left" | "right";
    className?: string;
}
declare const DropdownMenu: react.ForwardRefExoticComponent<DropdownMenuProps & react.RefAttributes<HTMLDivElement>>;

interface ContextMenuItem {
    label: string;
    onClick?: () => void;
    divider?: boolean;
    disabled?: boolean;
}
interface ContextMenuProps {
    items: ContextMenuItem[];
    children: ReactNode;
    className?: string;
}
declare const ContextMenu: react.ForwardRefExoticComponent<ContextMenuProps & react.RefAttributes<HTMLDivElement>>;

interface CommandItem {
    label: string;
    shortcut?: string;
    onClick?: () => void;
    disabled?: boolean;
}
interface CommandGroup {
    label: string;
    items: CommandItem[];
}
interface CommandPaletteProps extends Omit<ComponentProps<"div">, "onClose"> {
    open: boolean;
    onClose: () => void;
    groups: CommandGroup[];
    placeholder?: string;
    className?: string;
}
declare const CommandPalette: react.ForwardRefExoticComponent<Omit<CommandPaletteProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

declare function useControllable<T>(controlled: T | undefined, defaultValue: T, onChange?: (value: T) => void): [T, (next: T) => void];

declare function useEscapeKey(onClose: (() => void) | undefined, active: boolean, ref?: React.RefObject<HTMLElement | null>): void;
declare function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onClose: (() => void) | undefined, active: boolean): void;
declare function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean): void;

export { Accordion, Alert, AlertDialog, type AlertVariant, AspectRatio, type AspectRatio$1 as AspectRatioType, Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentGroup, AttachmentMedia, type AttachmentMediaProps, AttachmentProgress, type AttachmentProgressProps, type AttachmentProps, type AttachmentState, AttachmentTitle, AttachmentTrigger, Avatar, AvatarGroup, Badge, type BadgeVariant, BottomNav, Breadcrumbs, Bubble, BubbleCollapsible, type BubbleCollapsibleProps, BubbleContent, BubbleGroup, type BubbleProps, BubbleReactions, type BubbleVariant, Button, ButtonGroup, type ButtonVariant, Calendar, Card, Carousel, Chart, ChartCard, ChatComposer, type ChatComposerAction, type ChatComposerActionDetail, type ChatComposerCapabilities, type ChatComposerChangeDetail, type ChatComposerConfig, type ChatComposerController, type ChatComposerDictationDetail, type ChatComposerDictationState, type ChatComposerModel, type ChatComposerOptions, type ChatComposerProps, type ChatComposerQueueDetail, type ChatComposerRequest, type ChatComposerState, Checkbox, CheckboxGroup, Chip, type ChipColor, Collapsible, CommandPalette, Container, type ContainerSize, ContextMenu, CustomSelect, DataTable, DatePicker, Drawer, DropdownMenu, EmptyState, Field, Fieldset, Frame, type GapToken, Grid, Group, HoverCard, Image, Input, InputGroup, InputIcon, InputOTP, Kbd, Label, List, Marker, MarkerContent, MarkerIcon, type MarkerProps, Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader, type MessageProps, MessageScroller, MessageScrollerButton, type MessageScrollerButtonProps, MessageScrollerContent, type MessageScrollerContentProps, MessageScrollerItem, type MessageScrollerItemProps, type MessageScrollerProps, MessageScrollerProvider, type MessageScrollerProviderProps, MessageScrollerViewport, type MessageScrollerViewportProps, Meter, Modal, NavMenu, Navbar, NumberField, Pagination, Popover, PreviewCard, Progress, Prose, Radio, RadioGroup, ScrollArea, Search, Select, Separator, Sheet, type Size, Skeleton, type SkeletonVariant, Slider, Spinner, Stack, StatCard, Stepper, Surface, type SurfaceVariant, Switch, Table, Tabs, Textarea, ThemeProvider, Toast, ToastProvider, Toggle, ToggleGroup, Toolbar, Tooltip, useControllable, useEscapeKey, useFocusTrap, useOutsideClick, useToast };
