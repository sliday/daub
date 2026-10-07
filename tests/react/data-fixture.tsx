import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Alert } from "../../react/src/components/Alert";
import { Avatar } from "../../react/src/components/Avatar";
import { AvatarGroup } from "../../react/src/components/AvatarGroup";
import { BottomNav } from "../../react/src/components/BottomNav";
import { Breadcrumbs } from "../../react/src/components/Breadcrumbs";
import { Card } from "../../react/src/components/Card";
import { Carousel } from "../../react/src/components/Carousel";
import { Chart } from "../../react/src/components/Chart";
import { ChartCard } from "../../react/src/components/ChartCard";
import { Chip } from "../../react/src/components/Chip";
import { DataTable } from "../../react/src/components/DataTable";
import { List } from "../../react/src/components/List";
import { Meter } from "../../react/src/components/Meter";
import { NavMenu } from "../../react/src/components/NavMenu";
import { Progress } from "../../react/src/components/Progress";
import { ScrollArea } from "../../react/src/components/ScrollArea";
import { Separator } from "../../react/src/components/Separator";
import { Skeleton } from "../../react/src/components/Skeleton";
import { StatCard } from "../../react/src/components/StatCard";
import { Stepper } from "../../react/src/components/Stepper";
import { Table } from "../../react/src/components/Table";
import { Toast } from "../../react/src/components/Toast";

const components = { Alert, Avatar, AvatarGroup, BottomNav, Breadcrumbs, Card, Carousel, Chart, ChartCard, Chip, DataTable, List, Meter, NavMenu, Progress, ScrollArea, Separator, Skeleton, StatCard, Stepper, Table, Toast };
const root = createRoot(document.getElementById("root")!);
const state = window as typeof window & { mountData: (kind: string, props: Record<string, unknown>) => void; dataEvents: unknown[]; dataPointerEvents: string[]; dataRef: unknown };
state.dataEvents = [];
state.dataPointerEvents = [];
state.mountData = (kind, props) => {
  const Component = components[kind as keyof typeof components] as React.ElementType;
  const input = { ...props };
  const record = (event: unknown) => state.dataEvents.push(event);
  const extra: Record<string, unknown> = { ref: (node: unknown) => { state.dataRef = node; } };
  if (kind === "Carousel") {
    const count = Number(input.slides ?? 3);
    delete input.slides;
    extra.children = Array.from({ length: count }, (_, i) => <a key={i} href={`#slide-${i}`}>Content {i + 1}</a>);
    if (input.gesture) {
      extra.children = Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ minHeight: input.editors ? 320 : 140 }}>
          <a href={`#slide-${i}`} style={{ display: "block", height: input.editors ? 40 : 140 }} onClick={() => record(`link:${i}`)}>Content {i + 1}</a>
          {input.editors && <>
            <button type="button">Edit</button>
            <input aria-label="Title" />
            <select aria-label="Category"><option>Work</option></select>
            <textarea aria-label="Notes" />
            <div contentEditable suppressContentEditableWarning>Editable text</div>
          </>}
        </div>
      ));
    }
    const cancelPointer = input.cancelPointer;
    if (input.pointerHandlers || cancelPointer) {
      for (const name of ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel", "onLostPointerCapture", "onClickCapture", "onKeyDownCapture"]) {
        extra[name] = (event: React.SyntheticEvent) => {
          state.dataPointerEvents.push(event.type);
          if (event.type === cancelPointer) event.preventDefault();
        };
      }
    }
    delete input.gesture;
    delete input.editors;
    delete input.cancelPointer;
    delete input.pointerHandlers;
    extra.onChange = record;
  }
  if (kind === "AvatarGroup") {
    extra.children = ["AB", "CD", "EF", "GH"].map((initials) => <Avatar key={initials} initials={initials} alt={initials} />);
  }
  if (kind === "Chip") extra.onClose = () => record("close");
  if (kind === "Toast") {
    delete extra.ref;
    extra.onDismiss = record;
  }
  if (kind === "Card") {
    const cancel = input.cancel;
    extra.onClick = () => record("activate");
    extra.onKeyDown = (event: React.KeyboardEvent) => { if (cancel) event.preventDefault(); };
    delete input.cancel;
    if (input.nested) extra.children = <button type="button" onClick={(event) => event.stopPropagation()}>Nested</button>;
    delete input.nested;
  }
  if (kind === "DataTable") {
    extra.onSelectionChange = record;
    extra.onSortChange = record;
  }
  if (kind === "BottomNav" || kind === "NavMenu") {
    if (input.actions) {
      extra.items = [{ label: "Run", onClick: () => record("run") }, { label: "Static", active: true }, { label: "Home", href: "#home" }];
      delete input.actions;
    }
  }
  flushSync(() => root.render(<form onSubmit={(event) => { event.preventDefault(); record("submit"); }}><Component {...input} {...extra} /></form>));
};
