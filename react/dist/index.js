'use strict';

var react = require('react');
var jsxRuntime = require('react/jsx-runtime');
var reactDom = require('react-dom');

// src/components/Stack.tsx

// src/utils/cn.ts
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
var Stack = react.forwardRef(
  ({ direction, gap, justify, align, wrap, container, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn(
        "db-stack",
        direction === "horizontal" && "db-stack--h",
        gap != null && `db-gap-${gap}`,
        justify && `db-justify-${justify}`,
        align && `db-align-${align}`,
        wrap && "db-stack--wrap",
        container === true && "db-container",
        container === "wide" && "db-container db-container--wide",
        container === "narrow" && "db-container db-container--narrow",
        className
      ),
      ...props
    }
  )
);
Stack.displayName = "Stack";
var Grid = react.forwardRef(
  ({ columns, gap, align, container, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn(
        "db-grid",
        columns && `db-grid--${columns}`,
        gap != null && `db-gap-${gap}`,
        align && `db-align-${align}`,
        container === true && "db-container",
        container === "wide" && "db-container db-container--wide",
        container === "narrow" && "db-container db-container--narrow",
        className
      ),
      ...props
    }
  )
);
Grid.displayName = "Grid";
var Surface = react.forwardRef(
  ({ variant, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn(
        "db-surface",
        variant && `db-surface--${variant}`,
        className
      ),
      ...props
    }
  )
);
Surface.displayName = "Surface";
var Container = react.forwardRef(
  ({ size, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn(
        "db-container",
        size === "wide" && "db-container--wide",
        size === "narrow" && "db-container--narrow",
        className
      ),
      ...props
    }
  )
);
Container.displayName = "Container";
var Separator = react.forwardRef(
  ({ vertical, dashed, label, className, ...props }, ref) => {
    const classes = cn(
      "db-separator",
      vertical && "db-separator--vertical",
      dashed && "db-separator--dashed",
      className
    );
    if (label) {
      return /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          ref,
          role: "separator",
          className: classes,
          ...props,
          children: /* @__PURE__ */ jsxRuntime.jsx("span", { children: label })
        }
      );
    }
    return /* @__PURE__ */ jsxRuntime.jsx(
      "hr",
      {
        ref,
        className: classes,
        ...props
      }
    );
  }
);
Separator.displayName = "Separator";
var ScrollArea = react.forwardRef(
  ({ horizontal, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn(
        "db-scroll-area",
        horizontal && "db-scroll-area--horizontal",
        className
      ),
      ...props
    }
  )
);
ScrollArea.displayName = "ScrollArea";
var AspectRatio = react.forwardRef(
  ({ ratio = "16-9", className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn("db-aspect", `db-aspect--${ratio}`, className),
      ...props
    }
  )
);
AspectRatio.displayName = "AspectRatio";
var Card = react.forwardRef(
  ({ title, description, media, footer, clip, interactive, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref,
      className: cn(
        "db-card",
        clip && "db-card--clip",
        interactive && "db-card--interactive",
        className
      ),
      ...props,
      children: [
        media,
        (title || description) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-card__header", children: [
          title && /* @__PURE__ */ jsxRuntime.jsx("h3", { children: title }),
          description && /* @__PURE__ */ jsxRuntime.jsx("p", { children: description })
        ] }),
        children && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-card__body", children }),
        footer && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-card__footer", children: footer })
      ]
    }
  )
);
Card.displayName = "Card";
var Badge = react.forwardRef(
  ({ variant, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "span",
    {
      ref,
      className: cn("db-badge", variant && `db-badge--${variant}`, className),
      ...props
    }
  )
);
Badge.displayName = "Badge";
var Avatar = react.forwardRef(
  ({ src, alt, initials, size, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn("db-avatar", size && `db-avatar--${size}`, className),
      ...props,
      children: src ? /* @__PURE__ */ jsxRuntime.jsx("img", { src, alt: alt ?? "" }) : initials ? /* @__PURE__ */ jsxRuntime.jsx("span", { children: initials }) : null
    }
  )
);
Avatar.displayName = "Avatar";
var AvatarGroup = react.forwardRef(
  ({ max: _max, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn("db-avatar-group", className),
      ...props
    }
  )
);
AvatarGroup.displayName = "AvatarGroup";
var Alert = react.forwardRef(
  ({ variant, title, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn("db-alert", variant && `db-alert--${variant}`, className),
      ...props,
      children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-alert__content", children: [
        title && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-alert__title", children: title }),
        children
      ] })
    }
  )
);
Alert.displayName = "Alert";
var Progress = react.forwardRef(
  ({ value = 0, indeterminate, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn(
        "db-progress",
        indeterminate && "db-progress--indeterminate",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          className: "db-progress__bar",
          style: indeterminate ? void 0 : { width: `${value}%` }
        }
      )
    }
  )
);
Progress.displayName = "Progress";
var Skeleton = react.forwardRef(
  ({ variant, lines = 1, className, ...props }, ref) => {
    const classes = cn(
      "db-skeleton",
      variant && `db-skeleton--${variant}`,
      className
    );
    if (lines > 1) {
      return /* @__PURE__ */ jsxRuntime.jsx("div", { ref, ...props, children: Array.from({ length: lines }, (_, i) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: classes }, i)) });
    }
    return /* @__PURE__ */ jsxRuntime.jsx("div", { ref, className: classes, ...props });
  }
);
Skeleton.displayName = "Skeleton";
var EmptyState = react.forwardRef(
  ({ title, message, icon, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref,
      className: cn("db-empty", className),
      ...props,
      children: [
        icon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-empty__icon", children: icon }),
        title && /* @__PURE__ */ jsxRuntime.jsx("h3", { children: title }),
        message && /* @__PURE__ */ jsxRuntime.jsx("p", { children: message }),
        children
      ]
    }
  )
);
EmptyState.displayName = "EmptyState";
var Spinner = react.forwardRef(
  ({ size, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "span",
    {
      ref,
      role: "status",
      "aria-label": "Loading",
      className: cn("db-spinner", size && `db-spinner--${size}`, className),
      ...props
    }
  )
);
Spinner.displayName = "Spinner";
var StatCard = react.forwardRef(
  ({ label, value, trend, trendValue, icon, horizontal, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref,
      className: cn(
        "db-stat",
        horizontal && "db-stat--horizontal",
        className
      ),
      ...props,
      children: [
        icon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-stat__icon", children: icon }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-stat__label", children: label }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-stat__value", children: value }),
        trend && /* @__PURE__ */ jsxRuntime.jsx("div", { className: cn("db-stat__trend", `db-stat__trend--${trend}`), children: trendValue })
      ]
    }
  )
);
StatCard.displayName = "StatCard";
var ChartCard = react.forwardRef(
  ({ title, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref,
      className: cn("db-chart-card", className),
      ...props,
      children: [
        title && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-chart-card__header", children: /* @__PURE__ */ jsxRuntime.jsx("h3", { children: title }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-chart-card__body", children })
      ]
    }
  )
);
ChartCard.displayName = "ChartCard";
var Image = react.forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "img",
    {
      ref,
      className: cn("db-img", className),
      ...props
    }
  )
);
Image.displayName = "Image";
var Chart = react.forwardRef(
  ({ bars, secondary, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      ...props,
      className: cn(
        "db-chart",
        secondary && "db-chart--secondary",
        className
      ),
      children: bars.map((bar, i) => /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          className: "db-chart__bar",
          style: { height: `${bar.value}%` },
          children: bar.label && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-chart__label", children: bar.label })
        },
        i
      ))
    }
  )
);
Chart.displayName = "Chart";
var Button = react.forwardRef(
  ({ variant, size, loading, icon, className, disabled, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "button",
    {
      ref,
      className: cn(
        "db-btn",
        variant && `db-btn--${variant}`,
        size && `db-btn--${size}`,
        loading && "db-btn--loading",
        className
      ),
      disabled: disabled || loading,
      ...props,
      children
    }
  )
);
Button.displayName = "Button";
var ButtonGroup = react.forwardRef(
  ({ className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx("div", { ref, className: cn("db-btn-group", className), ...props, children })
);
ButtonGroup.displayName = "ButtonGroup";
var Input = react.forwardRef(
  ({ error, inputSize, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "input",
    {
      ref,
      className: cn(
        "db-input",
        inputSize && `db-input--${inputSize}`,
        error && "db-input--error",
        className
      ),
      ...props
    }
  )
);
Input.displayName = "Input";
var Textarea = react.forwardRef(
  ({ error, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "textarea",
    {
      ref,
      className: cn("db-textarea", error && "db-textarea--error", className),
      ...props
    }
  )
);
Textarea.displayName = "Textarea";
var Field = react.forwardRef(
  ({ label, helper, error, className, children, ...props }, ref) => {
    const helperText = typeof error === "string" ? error : helper;
    return /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        ref,
        className: cn("db-field", error && "db-field--error", className),
        ...props,
        children: [
          label && /* @__PURE__ */ jsxRuntime.jsx("label", { className: "db-label", children: label }),
          children,
          helperText && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-field__helper", children: helperText })
        ]
      }
    );
  }
);
Field.displayName = "Field";
var InputGroup = react.forwardRef(
  ({ addonBefore, addonAfter, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, className: cn("db-input-group", className), ...props, children: [
    addonBefore && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-input-group__addon", children: addonBefore }),
    children,
    addonAfter && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-input-group__addon", children: addonAfter })
  ] })
);
InputGroup.displayName = "InputGroup";
var InputIcon = react.forwardRef(
  ({ icon, right, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref,
      className: cn("db-input-icon", right && "db-input-icon--right", className),
      ...props,
      children: [
        icon && /* @__PURE__ */ jsxRuntime.jsx("span", { children: icon }),
        children
      ]
    }
  )
);
InputIcon.displayName = "InputIcon";
var Search = react.forwardRef(
  ({ className, placeholder = "Search\u2026", ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: cn("db-search", className), children: [
    /* @__PURE__ */ jsxRuntime.jsxs(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "11", cy: "11", r: "8" }),
          /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      "input",
      {
        ref,
        type: "search",
        className: "db-input",
        placeholder,
        ...props
      }
    )
  ] })
);
Search.displayName = "Search";
var Select = react.forwardRef(
  ({ label, options, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: cn("db-select", className), children: [
    label && /* @__PURE__ */ jsxRuntime.jsx("label", { className: "db-label", children: label }),
    /* @__PURE__ */ jsxRuntime.jsx("select", { ref, className: "db-select__native", ...props, children: options?.map((opt) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: opt.value, children: opt.label }, opt.value)) })
  ] })
);
Select.displayName = "Select";
var Label = react.forwardRef(
  ({ required, optional, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs("label", { ref, className: cn("db-label", className), ...props, children: [
    children,
    required && " *",
    optional && " (optional)"
  ] })
);
Label.displayName = "Label";
var Kbd = react.forwardRef(
  ({ keys, className, children, ...props }, ref) => {
    if (keys && keys.length > 0) {
      return /* @__PURE__ */ jsxRuntime.jsx("span", { ref, className, children: keys.map((key, i) => /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
        i > 0 && " + ",
        /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "db-kbd", children: key })
      ] }, i)) });
    }
    return /* @__PURE__ */ jsxRuntime.jsx("kbd", { ref, className: cn("db-kbd", className), ...props, children });
  }
);
Kbd.displayName = "Kbd";
var Prose = react.forwardRef(
  ({ size, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "article",
    {
      ref,
      className: cn("db-prose", size && `db-prose--${size}`, className),
      ...props,
      children
    }
  )
);
Prose.displayName = "Prose";
var List = react.forwardRef(
  ({ items, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, className: cn("db-list", className), ...props, children: [
    items?.map((item, i) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-list__item", children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-list__title", children: item.title }),
      item.secondary && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-list__secondary", children: item.secondary })
    ] }, i)),
    children
  ] })
);
List.displayName = "List";
var Table = react.forwardRef(
  ({ columns, rows, sortable, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: cn("db-table", sortable && "db-table--sortable", className), ...props, children: /* @__PURE__ */ jsxRuntime.jsxs("table", { ref, children: [
    /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsx("tr", { children: columns.map((col, i) => /* @__PURE__ */ jsxRuntime.jsx("th", { children: col }, i)) }) }),
    /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: rows.map((row, i) => /* @__PURE__ */ jsxRuntime.jsx("tr", { children: row.map((cell, j) => /* @__PURE__ */ jsxRuntime.jsx("td", { children: cell }, j)) }, i)) })
  ] }) })
);
Table.displayName = "Table";
var DataTable = react.forwardRef(
  ({ columns, rows, selectable, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: cn("db-data-table", className), ...props, children: /* @__PURE__ */ jsxRuntime.jsxs("table", { ref, children: [
    /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
      selectable && /* @__PURE__ */ jsxRuntime.jsx("th", { children: /* @__PURE__ */ jsxRuntime.jsx("input", { type: "checkbox" }) }),
      columns.map((col, i) => /* @__PURE__ */ jsxRuntime.jsx("th", { "data-sortable": col.sortable || void 0, children: col.label }, i))
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: rows.map((row, i) => /* @__PURE__ */ jsxRuntime.jsxs("tr", { children: [
      selectable && /* @__PURE__ */ jsxRuntime.jsx("td", { children: /* @__PURE__ */ jsxRuntime.jsx("input", { type: "checkbox" }) }),
      row.map((cell, j) => /* @__PURE__ */ jsxRuntime.jsx("td", { children: cell }, j))
    ] }, i)) })
  ] }) })
);
DataTable.displayName = "DataTable";
var Chip = react.forwardRef(
  ({ color, active, closable, onClose, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs(
    "span",
    {
      ref,
      className: cn(
        "db-chip",
        color && `db-chip--${color}`,
        active && "db-chip--active",
        className
      ),
      ...props,
      children: [
        children,
        closable && /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-chip__close", onClick: onClose, type: "button", children: "\xD7" })
      ]
    }
  )
);
Chip.displayName = "Chip";
var Breadcrumbs = react.forwardRef(
  ({ items, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "nav",
    {
      ref,
      "aria-label": "Breadcrumb",
      ...props,
      className: cn("db-breadcrumbs", className),
      children: /* @__PURE__ */ jsxRuntime.jsx("ol", { children: items.map((item, i) => {
        const isLast = i === items.length - 1;
        return /* @__PURE__ */ jsxRuntime.jsx("li", { children: isLast ? /* @__PURE__ */ jsxRuntime.jsx("span", { "aria-current": "page", children: item.label }) : /* @__PURE__ */ jsxRuntime.jsx("a", { href: item.href, children: item.label }) }, i);
      }) })
    }
  )
);
Breadcrumbs.displayName = "Breadcrumbs";
function getPages(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}
var Pagination = react.forwardRef(
  ({ current, total, perPage = 10, onChange, className, ...props }, ref) => {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pages = getPages(current, totalPages);
    return /* @__PURE__ */ jsxRuntime.jsxs(
      "nav",
      {
        ref,
        "aria-label": "Pagination",
        ...props,
        className: cn("db-pagination", className),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: "db-pagination__prev",
              disabled: current <= 1,
              onClick: () => onChange?.(current - 1),
              "aria-label": "Previous page",
              children: "Prev"
            }
          ),
          pages.map(
            (page, i) => page === "ellipsis" ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-pagination__ellipsis", children: "\u2026" }, `e${i}`) : /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                className: cn(
                  "db-pagination__page",
                  page === current && "db-pagination__page--active"
                ),
                "aria-current": page === current ? "page" : void 0,
                onClick: () => onChange?.(page),
                children: page
              },
              page
            )
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: "db-pagination__next",
              disabled: current >= totalPages,
              onClick: () => onChange?.(current + 1),
              "aria-label": "Next page",
              children: "Next"
            }
          )
        ]
      }
    );
  }
);
Pagination.displayName = "Pagination";
var NavMenu = react.forwardRef(
  ({ items, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx("nav", { ref, ...props, className: cn("db-nav-menu", className), children: items.map((item, i) => /* @__PURE__ */ jsxRuntime.jsx(
    "a",
    {
      href: item.href,
      className: cn(
        "db-nav-menu__item",
        item.active && "db-nav-menu__item--active"
      ),
      "aria-current": item.active ? "page" : void 0,
      children: item.label
    },
    i
  )) })
);
NavMenu.displayName = "NavMenu";
var BottomNav = react.forwardRef(
  ({ items, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx("nav", { ref, ...props, className: cn("db-bottom-nav", className), children: items.map((item, i) => /* @__PURE__ */ jsxRuntime.jsxs(
    "a",
    {
      href: item.href,
      className: cn(
        "db-bottom-nav__item",
        item.active && "db-bottom-nav__item--active"
      ),
      "aria-current": item.active ? "page" : void 0,
      children: [
        item.icon && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-bottom-nav__icon", "aria-hidden": "true", children: item.icon }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-bottom-nav__label", children: item.label }),
        item.badge && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-bottom-nav__badge", children: item.badge })
      ]
    },
    i
  )) })
);
BottomNav.displayName = "BottomNav";
var Stepper = react.forwardRef(
  ({ steps, vertical, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      ...props,
      className: cn(
        "db-stepper",
        vertical && "db-stepper--vertical",
        className
      ),
      children: steps.map((step, i) => /* @__PURE__ */ jsxRuntime.jsxs(
        "div",
        {
          className: cn(
            "db-stepper__step",
            step.completed && "db-stepper__step--completed",
            step.active && "db-stepper__step--active"
          ),
          children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-stepper__circle", children: step.completed ? "\u2713" : i + 1 }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-stepper__label", children: step.label })
          ]
        },
        i
      ))
    }
  )
);
Stepper.displayName = "Stepper";
var Navbar = react.forwardRef(
  ({ brand, brandHref, children, className, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs("nav", { ref, ...props, className: cn("db-navbar", className), children: [
    brand && /* @__PURE__ */ jsxRuntime.jsx("a", { className: "db-navbar__brand", href: brandHref, children: brand }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-navbar__nav", children })
  ] })
);
Navbar.displayName = "Navbar";
var HoverCard = react.forwardRef(
  ({ trigger, content, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, ...props, className: cn("db-hover-card", className), children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-hover-card__trigger", children: trigger }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-hover-card__content", children: content })
  ] })
);
HoverCard.displayName = "HoverCard";
function ThemeProvider({ theme, children }) {
  return /* @__PURE__ */ jsxRuntime.jsx("div", { "data-theme": theme, children });
}
ThemeProvider.displayName = "ThemeProvider";
function useControllable(controlled, defaultValue, onChange) {
  const isControlled = controlled !== void 0;
  const [internal, setInternal] = react.useState(defaultValue);
  const value = isControlled ? controlled : internal;
  const onChangeRef = react.useRef(onChange);
  onChangeRef.current = onChange;
  const setValue = react.useCallback(
    (next) => {
      if (!isControlled) setInternal(next);
      onChangeRef.current?.(next);
    },
    [isControlled]
  );
  return [value, setValue];
}
var Tabs = react.forwardRef(
  ({ tabs, activeTab, defaultActiveTab = 0, onChange, className, ...props }, ref) => {
    const [current, setCurrent] = useControllable(activeTab, defaultActiveTab, onChange);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, className: cn("db-tabs", className), ...props, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-tabs__list", role: "tablist", children: tabs.map((t, i) => /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          className: cn("db-tabs__tab", i === current && "db-tabs__tab--active"),
          role: "tab",
          "aria-selected": i === current,
          onClick: () => setCurrent(i),
          type: "button",
          children: t.label
        },
        i
      )) }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-tabs__panel", role: "tabpanel", children: tabs[current]?.content })
    ] });
  }
);
Tabs.displayName = "Tabs";
var Accordion = react.forwardRef(
  ({ items, multi = false, openItems, defaultOpenItems = [], onChange, className, ...props }, ref) => {
    const [open, setOpen] = useControllable(openItems, defaultOpenItems, onChange);
    const toggle = (index) => {
      if (open.includes(index)) {
        setOpen(open.filter((i) => i !== index));
      } else {
        setOpen(multi ? [...open, index] : [index]);
      }
    };
    return /* @__PURE__ */ jsxRuntime.jsx("div", { ref, className: cn("db-accordion", className), ...props, children: items.map((item, i) => {
      const isOpen = open.includes(i);
      return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: cn("db-accordion__item", isOpen && "db-accordion__item--open"), children: [
        /* @__PURE__ */ jsxRuntime.jsxs(
          "button",
          {
            className: "db-accordion__trigger",
            "aria-expanded": isOpen,
            onClick: () => toggle(i),
            type: "button",
            children: [
              item.trigger,
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-accordion__icon", children: "\u25B8" })
            ]
          }
        ),
        isOpen && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-accordion__content", children: item.content })
      ] }, i);
    }) });
  }
);
Accordion.displayName = "Accordion";
var Collapsible = react.forwardRef(
  ({ open, defaultOpen = false, onChange, trigger, className, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = useControllable(open, defaultOpen, onChange);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, className: cn("db-collapsible", isOpen && "db-collapsible--open", className), ...props, children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          className: "db-collapsible__trigger",
          "aria-expanded": isOpen,
          onClick: () => setIsOpen(!isOpen),
          type: "button",
          children: trigger
        }
      ),
      isOpen && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-collapsible__content", children })
    ] });
  }
);
Collapsible.displayName = "Collapsible";
var CustomSelect = react.forwardRef(
  ({ value, defaultValue = "", onChange, options, placeholder = "Select...", searchable = false, className, ...props }, ref) => {
    const [selected, setSelected] = useControllable(value, defaultValue, onChange);
    const [isOpen, setIsOpen] = react.useState(false);
    const [search, setSearch] = react.useState("");
    const containerRef = react.useRef(null);
    const setRefs = react.useCallback(
      (node) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );
    react.useEffect(() => {
      if (!isOpen) return;
      const handleClick = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setIsOpen(false);
          setSearch("");
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);
    const filtered = search ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : options;
    const selectedLabel = options.find((o) => o.value === selected)?.label;
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref: setRefs, className: cn("db-custom-select", isOpen && "db-custom-select--open", className), ...props, children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          className: "db-custom-select__trigger",
          onClick: () => setIsOpen(!isOpen),
          type: "button",
          children: selectedLabel || placeholder
        }
      ),
      isOpen && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-custom-select__dropdown", children: [
        searchable && /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            className: "db-input db-input--sm",
            placeholder: "Search...",
            value: search,
            onChange: (e) => setSearch(e.target.value)
          }
        ),
        filtered.map((opt) => /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: cn("db-custom-select__option", opt.value === selected && "db-custom-select__option--active"),
            onClick: () => {
              setSelected(opt.value);
              setIsOpen(false);
              setSearch("");
            },
            children: opt.label
          },
          opt.value
        ))
      ] })
    ] });
  }
);
CustomSelect.displayName = "CustomSelect";
var DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getDays(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const days = [];
  for (let i = -startDay; i < 42 - startDay; i++) {
    const d = new Date(year, month, 1 + i);
    days.push(d);
    if (i >= 0 && d.getMonth() !== month && d.getDay() === 6) break;
  }
  return days;
}
var Calendar = react.forwardRef(
  ({ selected, defaultSelected = "", onChange, month: initialMonth, className, ...props }, ref) => {
    const [value, setValue] = useControllable(selected, defaultSelected, onChange);
    const [displayed, setDisplayed] = react.useState(() => initialMonth ?? (value ? /* @__PURE__ */ new Date(value + "T00:00") : /* @__PURE__ */ new Date()));
    const year = displayed.getFullYear();
    const mo = displayed.getMonth();
    const days = getDays(year, mo);
    const todayStr = toDateString(/* @__PURE__ */ new Date());
    const monthName = displayed.toLocaleString("default", { month: "long" });
    const prevMonth = () => setDisplayed(new Date(year, mo - 1, 1));
    const nextMonth = () => setDisplayed(new Date(year, mo + 1, 1));
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, className: cn("db-calendar", className), ...props, children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-calendar__header", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-calendar__nav", onClick: prevMonth, type: "button", children: "\u2039" }),
        /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "db-calendar__title", children: [
          monthName,
          " ",
          year
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-calendar__nav", onClick: nextMonth, type: "button", children: "\u203A" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-calendar__grid", children: [
        DAY_NAMES.map((d) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-calendar__day-name", children: d }, d)),
        days.map((d, i) => {
          const ds = toDateString(d);
          const inMonth = d.getMonth() === mo;
          return /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: cn(
                "db-calendar__day",
                ds === value && "db-calendar__day--selected",
                ds === todayStr && "db-calendar__day--today",
                !inMonth && "db-calendar__day--outside"
              ),
              onClick: () => setValue(ds),
              type: "button",
              children: d.getDate()
            },
            i
          );
        })
      ] })
    ] });
  }
);
Calendar.displayName = "Calendar";
var DatePicker = react.forwardRef(
  ({ value, defaultValue = "", onChange, label, placeholder = "Select date", className, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue, onChange);
    const [isOpen, setIsOpen] = react.useState(false);
    const containerRef = react.useRef(null);
    const setRefs = react.useCallback(
      (node) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );
    react.useEffect(() => {
      if (!isOpen) return;
      const handleClick = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref: setRefs, className: cn("db-date-picker", className), ...props, children: [
      label && /* @__PURE__ */ jsxRuntime.jsx("label", { className: "db-label", children: label }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          className: "db-input",
          value: val,
          placeholder,
          readOnly: true,
          onClick: () => setIsOpen(!isOpen)
        }
      ),
      isOpen && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-date-picker__dropdown", children: /* @__PURE__ */ jsxRuntime.jsx(
        Calendar,
        {
          selected: val,
          onChange: (date) => {
            setVal(date);
            setIsOpen(false);
          }
        }
      ) })
    ] });
  }
);
DatePicker.displayName = "DatePicker";
var Carousel = react.forwardRef(
  ({ current, defaultCurrent = 0, onChange, autoplay = false, duration = 5e3, className, children, ...props }, ref) => {
    const slides = react.Children.toArray(children);
    const count = slides.length;
    const [idx, setIdx] = useControllable(current, defaultCurrent, onChange);
    const prev = () => setIdx((idx - 1 + count) % count);
    const next = () => setIdx((idx + 1) % count);
    react.useEffect(() => {
      if (!autoplay || count <= 1) return;
      const id = setInterval(() => setIdx((idx + 1) % count), duration);
      return () => clearInterval(id);
    }, [autoplay, duration, count, idx, setIdx]);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, className: cn("db-carousel", className), ...props, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-carousel__track", style: { transform: `translateX(-${idx * 100}%)` }, children: slides.map((child, i) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-carousel__slide", children: child }, i)) }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-carousel__prev", onClick: prev, type: "button", children: "\u2039" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-carousel__next", onClick: next, type: "button", children: "\u203A" }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-carousel__dots", children: slides.map((_, i) => /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          className: cn("db-carousel__dot", i === idx && "db-carousel__dot--active"),
          onClick: () => setIdx(i),
          type: "button",
          "aria-label": `Slide ${i + 1}`
        },
        i
      )) })
    ] });
  }
);
Carousel.displayName = "Carousel";
var Checkbox = react.forwardRef(
  ({ checked, defaultChecked, onChange, label, className, ...props }, ref) => {
    const [on, setOn] = useControllable(checked, defaultChecked ?? false, onChange);
    return /* @__PURE__ */ jsxRuntime.jsxs("label", { className: cn("db-checkbox", className), children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          ref,
          type: "checkbox",
          checked: on,
          onChange: () => setOn(!on),
          ...props
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-checkbox__box" }),
      label && /* @__PURE__ */ jsxRuntime.jsx("span", { children: label })
    ] });
  }
);
Checkbox.displayName = "Checkbox";
var Radio = react.forwardRef(
  ({ checked, defaultChecked, onChange, label, name, value, className, ...props }, ref) => {
    const [on, setOn] = useControllable(checked, defaultChecked ?? false, onChange);
    return /* @__PURE__ */ jsxRuntime.jsxs("label", { className: cn("db-radio", className), children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          ref,
          type: "radio",
          name,
          value,
          checked: on,
          onChange: () => setOn(true),
          ...props
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-radio__circle" }),
      label && /* @__PURE__ */ jsxRuntime.jsx("span", { children: label })
    ] });
  }
);
Radio.displayName = "Radio";
var RadioGroup = react.forwardRef(
  ({ value, defaultValue, onChange, name, options = [], className, ...props }, ref) => {
    const [selected, setSelected] = useControllable(value, defaultValue ?? "", onChange);
    return /* @__PURE__ */ jsxRuntime.jsx("div", { ref, className: cn("db-radio-group", className), role: "radiogroup", ...props, children: options.map((opt) => /* @__PURE__ */ jsxRuntime.jsx(
      Radio,
      {
        name,
        value: opt.value,
        label: opt.label,
        checked: selected === opt.value,
        onChange: () => setSelected(opt.value)
      },
      opt.value
    )) });
  }
);
RadioGroup.displayName = "RadioGroup";
var Switch = react.forwardRef(
  ({ checked, defaultChecked, onChange, label, className, ...props }, ref) => {
    const [on, setOn] = useControllable(checked, defaultChecked ?? false, onChange);
    const toggle = () => setOn(!on);
    const handleKeyDown = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    };
    return /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        ref,
        className: cn("db-switch", on && "db-switch--on", className),
        role: "switch",
        "aria-checked": on,
        tabIndex: 0,
        onClick: toggle,
        onKeyDown: handleKeyDown,
        ...props,
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-switch__track", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-switch__thumb" }) }),
          label && /* @__PURE__ */ jsxRuntime.jsx("span", { children: label })
        ]
      }
    );
  }
);
Switch.displayName = "Switch";
var Slider = react.forwardRef(
  ({ value, defaultValue, onChange, min = 0, max = 100, step = 1, label, className, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? min, onChange);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: cn("db-slider", className), ...props, children: [
      label && /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "db-slider__label", children: [
        label,
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-slider__value", children: val })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          ref,
          type: "range",
          className: "db-slider__input",
          min,
          max,
          step,
          value: val,
          onChange: (e) => setVal(+e.target.value)
        }
      )
    ] });
  }
);
Slider.displayName = "Slider";
var Toggle = react.forwardRef(
  ({ pressed, defaultPressed, onChange, size, className, children, ...props }, ref) => {
    const [on, setOn] = useControllable(pressed, defaultPressed ?? false, onChange);
    return /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        ref,
        type: "button",
        className: cn(
          "db-toggle",
          on && "db-toggle--active",
          size && `db-toggle--${size}`,
          className
        ),
        "aria-pressed": on,
        onClick: () => setOn(!on),
        ...props,
        children
      }
    );
  }
);
Toggle.displayName = "Toggle";
var ToggleGroup = react.forwardRef(
  ({ value, defaultValue, onChange, multiple, className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      ref,
      className: cn("db-toggle-group", className),
      role: "group",
      ...props,
      children
    }
  )
);
ToggleGroup.displayName = "ToggleGroup";
var InputOTP = react.forwardRef(
  ({ length = 6, value, defaultValue, onChange, separator, className, ...props }, ref) => {
    const [val, setVal] = useControllable(value, defaultValue ?? "", onChange);
    const slotsRef = react.useRef([]);
    const focusSlot = react.useCallback((i) => {
      slotsRef.current[i]?.focus();
    }, []);
    const handleInput = react.useCallback(
      (i, char) => {
        const chars = val.split("");
        while (chars.length < length) chars.push("");
        chars[i] = char;
        const next = chars.join("");
        setVal(next);
        if (char && i < length - 1) focusSlot(i + 1);
      },
      [val, length, setVal, focusSlot]
    );
    const handleKeyDown = react.useCallback(
      (i, e) => {
        if (e.key === "Backspace") {
          e.preventDefault();
          const chars = val.split("");
          while (chars.length < length) chars.push("");
          if (chars[i]) {
            chars[i] = "";
            setVal(chars.join(""));
          } else if (i > 0) {
            chars[i - 1] = "";
            setVal(chars.join(""));
            focusSlot(i - 1);
          }
        } else if (e.key === "ArrowLeft" && i > 0) {
          focusSlot(i - 1);
        } else if (e.key === "ArrowRight" && i < length - 1) {
          focusSlot(i + 1);
        }
      },
      [val, length, setVal, focusSlot]
    );
    const slots = Array.from({ length }, (_, i) => {
      const slot = /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          ref: (el) => {
            slotsRef.current[i] = el;
          },
          className: "db-otp__slot",
          type: "text",
          inputMode: "numeric",
          maxLength: 1,
          value: val[i] ?? "",
          onChange: (e) => handleInput(i, e.target.value.slice(-1)),
          onKeyDown: (e) => handleKeyDown(i, e)
        },
        i
      );
      if (separator !== void 0 && i === separator - 1 && i < length - 1) {
        return /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "db-otp__group", children: [
          slot,
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-otp__separator", "aria-hidden": "true", children: "-" })
        ] }, `s${i}`);
      }
      return slot;
    });
    return /* @__PURE__ */ jsxRuntime.jsx("div", { ref, className: cn("db-otp", className), ...props, children: slots });
  }
);
InputOTP.displayName = "InputOTP";
function useEscapeKey(onClose, active) {
  react.useEffect(() => {
    if (!active || !onClose) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, onClose]);
}
function useOutsideClick(ref, onClose, active) {
  react.useEffect(() => {
    if (!active || !onClose) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, onClose, ref]);
}
function useFocusTrap(ref, active) {
  react.useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const handler = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [active, ref]);
}
function Modal({ open, onClose, title, footer, className, children }) {
  const ref = react.useRef(null);
  useEscapeKey(onClose, open);
  useFocusTrap(ref, open);
  if (!open) return null;
  return reactDom.createPortal(
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-modal-overlay db-modal-overlay--active", onClick: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        ref,
        className: cn("db-modal db-modal--active", className),
        onClick: (e) => e.stopPropagation(),
        children: [
          title && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-modal__header", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h3", { children: title }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-btn db-btn--ghost db-btn--icon", onClick: onClose, children: "\xD7" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-modal__body", children }),
          footer && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-modal__footer", children: footer })
        ]
      }
    ) }),
    document.body
  );
}
function AlertDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "info"
}) {
  const ref = react.useRef(null);
  useEscapeKey(onClose, open);
  useFocusTrap(ref, open);
  if (!open) return null;
  return reactDom.createPortal(
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-modal-overlay db-modal-overlay--active", onClick: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        ref,
        className: "db-alert-dialog",
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("h3", { children: title }),
          description && /* @__PURE__ */ jsxRuntime.jsx("p", { children: description }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-modal__footer", children: [
            /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-btn db-btn--ghost", onClick: onClose, children: cancelLabel }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                className: cn(
                  "db-btn",
                  variant === "danger" ? "db-btn--danger" : "db-btn--primary"
                ),
                onClick: () => {
                  onConfirm?.();
                  onClose();
                },
                children: confirmLabel
              }
            )
          ] })
        ]
      }
    ) }),
    document.body
  );
}
function Sheet({ open, onClose, side = "right", title, children }) {
  useEscapeKey(onClose, open);
  if (!open) return null;
  return reactDom.createPortal(
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-sheet-overlay", onClick: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        className: cn("db-sheet", `db-sheet--${side}`, "db-sheet--active"),
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-sheet__header", children: [
            title && /* @__PURE__ */ jsxRuntime.jsx("h3", { children: title }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-btn db-btn--ghost db-btn--icon", onClick: onClose, children: "\xD7" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-sheet__body", children })
        ]
      }
    ) }),
    document.body
  );
}
function Drawer({ open, onClose, children }) {
  useEscapeKey(onClose, open);
  if (!open) return null;
  return reactDom.createPortal(
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-drawer-overlay", onClick: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        className: "db-drawer db-drawer--active",
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-drawer__handle" }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-drawer__body", children })
        ]
      }
    ) }),
    document.body
  );
}
function Toast({ id, type = "info", title, message, onDismiss }) {
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: cn("db-toast", `db-toast--${type}`), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-toast__content", children: [
      title && /* @__PURE__ */ jsxRuntime.jsx("strong", { children: title }),
      /* @__PURE__ */ jsxRuntime.jsx("span", { children: message })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("button", { className: "db-btn db-btn--ghost db-btn--icon", onClick: () => onDismiss(id), children: "\xD7" })
  ] });
}
var ToastContext = react.createContext(null);
var uid = 0;
function ToastProvider({ children }) {
  const [toasts, setToasts] = react.useState([]);
  const timers = react.useRef(/* @__PURE__ */ new Map());
  const dismiss = react.useCallback((id) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t2) => t2.id !== id));
  }, []);
  const toast = react.useCallback((opts) => {
    const id = `toast-${++uid}`;
    const duration = opts.duration ?? 4e3;
    const item = { id, type: opts.type, title: opts.title, message: opts.message, duration };
    setToasts((prev) => [...prev, item]);
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    }
  }, [dismiss]);
  react.useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);
  return /* @__PURE__ */ jsxRuntime.jsxs(ToastContext.Provider, { value: { toast }, children: [
    children,
    toasts.length > 0 && reactDom.createPortal(
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-toast-stack", children: toasts.map((t) => /* @__PURE__ */ jsxRuntime.jsx(Toast, { id: t.id, type: t.type, title: t.title, message: t.message, onDismiss: dismiss }, t.id)) }),
      document.body
    )
  ] });
}
function useToast() {
  const ctx = react.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
function Tooltip({
  content,
  position = "top",
  children,
  className
}) {
  const [visible, setVisible] = react.useState(false);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: cn("db-tooltip", className), children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        className: "db-tooltip__trigger",
        onMouseEnter: () => setVisible(true),
        onMouseLeave: () => setVisible(false),
        onFocus: () => setVisible(true),
        onBlur: () => setVisible(false),
        children
      }
    ),
    visible && /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        className: cn("db-tooltip__content", `db-tooltip__content--${position}`),
        role: "tooltip",
        children: content
      }
    )
  ] });
}
Tooltip.displayName = "Tooltip";
var Popover = react.forwardRef(
  ({
    trigger,
    content,
    position = "bottom",
    open,
    defaultOpen = false,
    onChange,
    className
  }, forwardedRef) => {
    const internalRef = react.useRef(null);
    const ref = forwardedRef || internalRef;
    const [isOpen, setIsOpen] = useControllable(open, defaultOpen, onChange);
    const close = react.useCallback(() => setIsOpen(false), [setIsOpen]);
    const toggle = react.useCallback(() => setIsOpen(!isOpen), [setIsOpen, isOpen]);
    useOutsideClick(ref, close, isOpen);
    useEscapeKey(close, isOpen);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, className: cn("db-popover", className), children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-popover__trigger", onClick: toggle, children: trigger }),
      isOpen && /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          className: cn(
            "db-popover__content",
            `db-popover__content--${position}`
          ),
          children: content
        }
      )
    ] });
  }
);
Popover.displayName = "Popover";
function DropdownMenu({
  trigger,
  items,
  align = "left",
  className
}) {
  const [open, setOpen] = react.useState(false);
  const ref = react.useRef(null);
  const close = react.useCallback(() => setOpen(false), []);
  const toggle = react.useCallback(() => setOpen((prev) => !prev), []);
  useOutsideClick(ref, close, open);
  useEscapeKey(close, open);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { ref, className: cn("db-dropdown", className), children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-dropdown__trigger", onClick: toggle, children: trigger }),
    open && /* @__PURE__ */ jsxRuntime.jsx("div", { className: cn("db-dropdown__menu", `db-dropdown__menu--${align}`), children: items.map(
      (item, i) => item.divider ? /* @__PURE__ */ jsxRuntime.jsx("hr", { className: "db-dropdown__divider" }, i) : /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          className: cn(
            "db-dropdown__item",
            item.disabled && "db-dropdown__item--disabled"
          ),
          onClick: () => {
            item.onClick?.();
            setOpen(false);
          },
          disabled: item.disabled,
          children: [
            item.icon && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "db-dropdown__icon", children: item.icon }),
            item.label
          ]
        },
        i
      )
    ) })
  ] });
}
DropdownMenu.displayName = "DropdownMenu";
function ContextMenu({ items, children, className }) {
  const [open, setOpen] = react.useState(false);
  const [pos, setPos] = react.useState({ x: 0, y: 0 });
  const menuRef = react.useRef(null);
  const close = react.useCallback(() => setOpen(false), []);
  const handleRightClick = react.useCallback(
    (e) => {
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    []
  );
  useOutsideClick(menuRef, close, open);
  useEscapeKey(close, open);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: cn("db-context-menu", className), onContextMenu: handleRightClick, children: [
    children,
    open && /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        ref: menuRef,
        className: "db-context-menu__menu",
        style: { position: "fixed", top: pos.y, left: pos.x },
        children: items.map(
          (item, i) => item.divider ? /* @__PURE__ */ jsxRuntime.jsx("hr", { className: "db-context-menu__divider" }, i) : /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: cn(
                "db-context-menu__item",
                item.disabled && "db-context-menu__item--disabled"
              ),
              onClick: () => {
                item.onClick?.();
                setOpen(false);
              },
              disabled: item.disabled,
              children: item.label
            },
            i
          )
        )
      }
    )
  ] });
}
ContextMenu.displayName = "ContextMenu";
function CommandPalette({
  open,
  onClose,
  groups,
  placeholder = "Type a command...",
  className
}) {
  const [search, setSearch] = react.useState("");
  const ref = react.useRef(null);
  useEscapeKey(onClose, open);
  useFocusTrap(ref, open);
  const filteredGroups = react.useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.map((g) => ({
      ...g,
      items: g.items.filter((item) => item.label.toLowerCase().includes(q))
    })).filter((g) => g.items.length > 0);
  }, [groups, search]);
  if (!open) return null;
  return reactDom.createPortal(
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-modal-overlay db-modal-overlay--active", onClick: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        ref,
        className: cn("db-command", "db-command--active", className),
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              className: "db-command__input",
              placeholder,
              value: search,
              onChange: (e) => setSearch(e.target.value),
              autoFocus: true
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-command__list", children: filteredGroups.map((g) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "db-command__group", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "db-command__group-label", children: g.label }),
            g.items.map((item) => /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                className: "db-command__item",
                onClick: () => {
                  item.onClick?.();
                  onClose();
                },
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx("span", { children: item.label }),
                  item.shortcut && /* @__PURE__ */ jsxRuntime.jsx("kbd", { className: "db-kbd", children: item.shortcut })
                ]
              },
              item.label
            ))
          ] }, g.label)) })
        ]
      }
    ) }),
    document.body
  );
}
CommandPalette.displayName = "CommandPalette";

exports.Accordion = Accordion;
exports.Alert = Alert;
exports.AlertDialog = AlertDialog;
exports.AspectRatio = AspectRatio;
exports.Avatar = Avatar;
exports.AvatarGroup = AvatarGroup;
exports.Badge = Badge;
exports.BottomNav = BottomNav;
exports.Breadcrumbs = Breadcrumbs;
exports.Button = Button;
exports.ButtonGroup = ButtonGroup;
exports.Calendar = Calendar;
exports.Card = Card;
exports.Carousel = Carousel;
exports.Chart = Chart;
exports.ChartCard = ChartCard;
exports.Checkbox = Checkbox;
exports.Chip = Chip;
exports.Collapsible = Collapsible;
exports.CommandPalette = CommandPalette;
exports.Container = Container;
exports.ContextMenu = ContextMenu;
exports.CustomSelect = CustomSelect;
exports.DataTable = DataTable;
exports.DatePicker = DatePicker;
exports.Drawer = Drawer;
exports.DropdownMenu = DropdownMenu;
exports.EmptyState = EmptyState;
exports.Field = Field;
exports.Grid = Grid;
exports.HoverCard = HoverCard;
exports.Image = Image;
exports.Input = Input;
exports.InputGroup = InputGroup;
exports.InputIcon = InputIcon;
exports.InputOTP = InputOTP;
exports.Kbd = Kbd;
exports.Label = Label;
exports.List = List;
exports.Modal = Modal;
exports.NavMenu = NavMenu;
exports.Navbar = Navbar;
exports.Pagination = Pagination;
exports.Popover = Popover;
exports.Progress = Progress;
exports.Prose = Prose;
exports.Radio = Radio;
exports.RadioGroup = RadioGroup;
exports.ScrollArea = ScrollArea;
exports.Search = Search;
exports.Select = Select;
exports.Separator = Separator;
exports.Sheet = Sheet;
exports.Skeleton = Skeleton;
exports.Slider = Slider;
exports.Spinner = Spinner;
exports.Stack = Stack;
exports.StatCard = StatCard;
exports.Stepper = Stepper;
exports.Surface = Surface;
exports.Switch = Switch;
exports.Table = Table;
exports.Tabs = Tabs;
exports.Textarea = Textarea;
exports.ThemeProvider = ThemeProvider;
exports.Toast = Toast;
exports.ToastProvider = ToastProvider;
exports.Toggle = Toggle;
exports.ToggleGroup = ToggleGroup;
exports.Tooltip = Tooltip;
exports.useControllable = useControllable;
exports.useEscapeKey = useEscapeKey;
exports.useFocusTrap = useFocusTrap;
exports.useOutsideClick = useOutsideClick;
exports.useToast = useToast;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map