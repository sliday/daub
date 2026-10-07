import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

export function mapControlChildren<Props>(children: ReactNode, control: ReactElement["type"], map: (child: ReactElement<Props>) => ReactNode, boundary?: ReactElement["type"]): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return child;
    if (child.type === control) return map(child as ReactElement<Props>);
    if (child.type === boundary || child.props.children === undefined) return child;
    return cloneElement(child, { children: mapControlChildren(child.props.children, control, map, boundary) });
  });
}
