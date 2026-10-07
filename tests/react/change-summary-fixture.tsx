import { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ChangeSummary } from '../../react/src/index';

declare global {
  interface Window {
    summaryEvents: string[];
    summaryRef: ReturnType<typeof createRef<HTMLDivElement>>;
    disableUndo: () => void;
    unmountSummary: () => void;
  }
}

const root = createRoot(document.getElementById('root')!);
window.summaryEvents = [];
window.summaryRef = createRef<HTMLDivElement>();
const render = (undoDisabled = false) => root.render(
  <ChangeSummary ref={window.summaryRef} files={[{ path: 'app.ts', additions: 48, deletions: 4 }]} undoDisabled={undoDisabled}
    onUndo={() => window.summaryEvents.push('undo')} onViewChanges={() => window.summaryEvents.push('view')}>
    <button type="button" onClick={() => window.summaryEvents.push('child')}>Apply patch</button>
  </ChangeSummary>,
);
window.disableUndo = () => render(true);
window.unmountSummary = () => root.unmount();
render();
