import * as react from 'react';
import { ComponentProps, ReactNode } from 'react';
import * as react_jsx_runtime from 'react/jsx-runtime';

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

interface AspectRatioProps extends ComponentProps<"div"> {
    ratio?: AspectRatio$1;
}
declare const AspectRatio: react.ForwardRefExoticComponent<Omit<AspectRatioProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

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

interface ProgressProps extends ComponentProps<"div"> {
    value?: number;
    indeterminate?: boolean;
}
declare const Progress: react.ForwardRefExoticComponent<Omit<ProgressProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

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
}
declare const ChartCard: react.ForwardRefExoticComponent<Omit<ChartCardProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

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
    icon?: string;
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
}
declare const Field: react.ForwardRefExoticComponent<Omit<FieldProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

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
    icon?: string;
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
}
declare const DataTable: react.ForwardRefExoticComponent<Omit<DataTableProps, "ref"> & react.RefAttributes<HTMLTableElement>>;

interface ChipProps extends ComponentProps<"span"> {
    color?: "red" | "green" | "blue" | "purple" | "amber" | "pink";
    active?: boolean;
    closable?: boolean;
    onClose?: () => void;
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
}
declare const Pagination: react.ForwardRefExoticComponent<Omit<PaginationProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface NavMenuItem {
    label: string;
    href?: string;
    active?: boolean;
}
interface NavMenuProps extends Omit<ComponentProps<"nav">, "children"> {
    items: NavMenuItem[];
}
declare const NavMenu: react.ForwardRefExoticComponent<Omit<NavMenuProps, "ref"> & react.RefAttributes<HTMLElement>>;

interface BottomNavItem {
    icon?: string;
    label: string;
    href?: string;
    active?: boolean;
    badge?: string;
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
}
interface TabsProps extends Omit<ComponentProps<"div">, "onChange"> {
    tabs: TabItem[];
    activeTab?: number;
    defaultActiveTab?: number;
    onChange?: (index: number) => void;
}
declare const Tabs: react.ForwardRefExoticComponent<Omit<TabsProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface AccordionItem {
    trigger: string;
    content: ReactNode;
}
interface AccordionProps extends Omit<ComponentProps<"div">, "onChange"> {
    items: AccordionItem[];
    multi?: boolean;
    openItems?: number[];
    defaultOpenItems?: number[];
    onChange?: (indices: number[]) => void;
}
declare const Accordion: react.ForwardRefExoticComponent<Omit<AccordionProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CollapsibleProps extends Omit<ComponentProps<"div">, "onChange"> {
    open?: boolean;
    defaultOpen?: boolean;
    onChange?: (open: boolean) => void;
    trigger: ReactNode;
}
declare const Collapsible: react.ForwardRefExoticComponent<Omit<CollapsibleProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SelectOption {
    label: string;
    value: string;
}
interface CustomSelectProps extends Omit<ComponentProps<"div">, "onChange"> {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    searchable?: boolean;
}
declare const CustomSelect: react.ForwardRefExoticComponent<Omit<CustomSelectProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CalendarProps extends Omit<ComponentProps<"div">, "onChange"> {
    selected?: string;
    defaultSelected?: string;
    onChange?: (date: string) => void;
    month?: Date;
}
declare const Calendar: react.ForwardRefExoticComponent<Omit<CalendarProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface DatePickerProps extends Omit<ComponentProps<"div">, "onChange"> {
    value?: string;
    defaultValue?: string;
    onChange?: (date: string) => void;
    label?: string;
    placeholder?: string;
}
declare const DatePicker: react.ForwardRefExoticComponent<Omit<DatePickerProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CarouselProps extends Omit<ComponentProps<"div">, "onChange"> {
    current?: number;
    defaultCurrent?: number;
    onChange?: (index: number) => void;
    autoplay?: boolean;
    duration?: number;
}
declare const Carousel: react.ForwardRefExoticComponent<Omit<CarouselProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface CheckboxProps extends Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked" | "onChange"> {
    checked?: boolean;
    defaultChecked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
}
declare const Checkbox: react.ForwardRefExoticComponent<Omit<CheckboxProps, "ref"> & react.RefAttributes<HTMLInputElement>>;

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
    }[];
}
declare const RadioGroup: react.ForwardRefExoticComponent<Omit<RadioGroupProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface SwitchProps extends Omit<ComponentProps<"div">, "onChange" | "role"> {
    checked?: boolean;
    defaultChecked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: string;
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
}
declare const Slider: react.ForwardRefExoticComponent<Omit<SliderProps, "ref"> & react.RefAttributes<HTMLInputElement>>;

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
}
declare const ToggleGroup: react.ForwardRefExoticComponent<Omit<ToggleGroupProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

interface InputOTPProps extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
    length?: number;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    separator?: number;
}
declare const InputOTP: react.ForwardRefExoticComponent<Omit<InputOTPProps, "ref"> & react.RefAttributes<HTMLDivElement>>;

declare function useControllable<T>(controlled: T | undefined, defaultValue: T, onChange?: (value: T) => void): [T, (next: T) => void];

export { Accordion, Alert, type AlertVariant, AspectRatio, type AspectRatio$1 as AspectRatioType, Avatar, AvatarGroup, Badge, type BadgeVariant, BottomNav, Breadcrumbs, Button, ButtonGroup, type ButtonVariant, Calendar, Card, Carousel, Chart, ChartCard, Checkbox, Chip, type ChipColor, Collapsible, Container, type ContainerSize, CustomSelect, DataTable, DatePicker, EmptyState, Field, type GapToken, Grid, HoverCard, Image, Input, InputGroup, InputIcon, InputOTP, Kbd, Label, List, NavMenu, Navbar, Pagination, Progress, Prose, Radio, RadioGroup, ScrollArea, Search, Select, Separator, type Size, Skeleton, type SkeletonVariant, Slider, Spinner, Stack, StatCard, Stepper, Surface, type SurfaceVariant, Switch, Table, Tabs, Textarea, ThemeProvider, Toggle, ToggleGroup, useControllable };
