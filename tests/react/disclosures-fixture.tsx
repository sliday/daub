import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Accordion } from '../../react/src/components/Accordion';
import { Collapsible } from '../../react/src/components/Collapsible';
import { Fieldset } from '../../react/src/components/Fieldset';
import { Radio } from '../../react/src/components/Radio';
import { Stack } from '../../react/src/components/Stack';
import { Grid } from '../../react/src/components/Grid';
import { Image } from '../../react/src/components/Image';

const root = createRoot(document.getElementById('root')!);
const events: unknown[] = [];
Object.assign(window, {
  events,
  mountDisclosure(kind: string, props: Record<string, unknown> = {}) {
    if (kind === 'Stack') root.render(createElement(Stack, { ...props, style: { width: 400, height: 100 }, children: [createElement('span', { key: 1 }, 'First'), createElement('span', { key: 2 }, 'Second')] }));
    if (kind === 'Grid') root.render(createElement(Grid, { columns: 2, ...props, style: { width: 400 }, children: [createElement('span', { key: 1 }, 'First'), createElement('span', { key: 2 }, 'Second')] }));
    if (kind === 'Image') root.render(createElement('div', { style: { width: 260 } }, createElement(Image, { src: 'http://daub.test/og-image.png', alt: 'DAUB component library' })));
    if (kind === 'Accordion') root.render(createElement(Accordion, {
      items: [
        { trigger: 'Profile', content: createElement('input', { 'aria-label': 'Profile name', defaultValue: 'Ada' }) },
        { trigger: 'Details', content: createElement('div', null, Array.from({ length: 30 }, (_, index) => createElement('p', { key: index }, 'Activity entry ' + index))) },
      ], ...props, onChange: value => events.push(value),
    }));
    if (kind === 'Collapsible') root.render(createElement(Collapsible, {
      trigger: 'Show details', ...props, onChange: value => events.push(value),
      children: createElement('input', { 'aria-label': 'Notes', defaultValue: 'Review ready' }),
    }));
    if (kind === 'Fieldset') root.render(createElement(Fieldset, {
      legend: 'Account', helper: 'Visible to your team', 'aria-describedby': 'external',
      children: [createElement('p', { key: 'help', id: 'external' }, 'Work details'), createElement('input', { key: 'input', 'aria-label': 'Account name' })],
    }));
    if (kind === 'Radio') root.render(createElement('form', { onSubmit: event => event.preventDefault() },
      createElement(Radio, { label: 'Free', name: 'plan', value: 'free', defaultChecked: true, onChange: value => events.push(['free', value]) }),
      createElement(Radio, { label: 'Team', name: 'plan', value: 'team', onChange: value => events.push(['team', value]) }),
      createElement('button', { type: 'reset' }, 'Reset'),
    ));
  },
});
