import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BallColor } from '../../styles/tokens';
import {
  Ball, Button, Card, SegmentedControl, Stepper,
  GroupedList, ListRow, Avatar, StatTile, EmptyState,
  Sheet, useToast, Screen, BackButton,
} from '../ui';

const BALLS: BallColor[] = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];

/**
 * Phase 1 demo route (`/ui`). Renders every component in the library so the
 * design system can be reviewed in isolation. Not linked from the app.
 */
export default function UIDemo() {
  const navigate = useNavigate();
  const toast = useToast();
  const [seg, setSeg] = useState<'reds' | 'colours'>('reds');
  const [reds, setReds] = useState(9);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detentLarge, setDetentLarge] = useState(false);

  return (
    <div className="ui-app">
      <Screen title="UI kit" navLeading={<BackButton onClick={() => navigate('/')} />}>
        <Section title="Typography">
          <Card>
            <p className="type-large-title">Large title</p>
            <p className="type-title-1">Title 1</p>
            <p className="type-title-2">Title 2</p>
            <p className="type-headline">Headline</p>
            <p className="type-body">Body — the quick brown fox jumps over the lazy dog.</p>
            <p className="type-subhead">Subhead</p>
            <p className="type-footnote">Footnote</p>
            <p className="numeric type-title-1">0123456789 · 147</p>
          </Card>
        </Section>

        <Section title="Balls (signature)">
          <Card>
            <div style={row}>
              {BALLS.map((c) => (
                <Ball key={c} color={c} size="lg" onClick={() => toast.show(`Potted ${c}`)} />
              ))}
            </div>
            <div style={{ ...row, marginTop: 'var(--space-4)' }}>
              <Ball color="red" size="sm" />
              <Ball color="red" size="md" />
              <Ball color="red" size="lg" count={2} />
            </div>
          </Card>
        </Section>

        <Section title="Buttons">
          <Card>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <Button variant="filled" fullWidth>Start match</Button>
              <Button variant="tinted" fullWidth>Add player</Button>
              <div style={row}>
                <Button variant="plain">Plain</Button>
                <Button variant="destructive">End match</Button>
                <Button size="sm" variant="tinted">Small</Button>
              </div>
            </div>
          </Card>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl
            options={[{ value: 'reds', label: 'Reds' }, { value: 'colours', label: 'Colours' }]}
            value={seg}
            onChange={setSeg}
            ariaLabel="Phase"
          />
        </Section>

        <Section title="Stepper">
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="type-body">Reds remaining</span>
              <Stepper value={reds} onChange={setReds} min={0} max={15} ariaLabel="Reds remaining" />
            </div>
          </Card>
        </Section>

        <Section title="Stat tiles">
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              <StatTile value="24" label="Matches" />
              <StatTile value="147" label="Highest break" />
              <StatTile value="68%" label="Win rate" />
            </div>
          </Card>
        </Section>

        <Section title="Grouped list">
          <GroupedList header="Players">
            <ListRow
              leading={<Avatar seed="arshad" name="Arshad Khan" />}
              title="Arshad Khan" subtitle="You" value="12–4" chevron
              onClick={() => toast.show('Opened Arshad')}
            />
            <ListRow
              leading={<Avatar seed="rahul" name="Rahul" />}
              title="Rahul" value="8–8" chevron onClick={() => toast.show('Opened Rahul')}
            />
            <ListRow leading={<Avatar seed="sam" name="Sam Patel" />} title="Sam Patel" value="3–9" chevron />
          </GroupedList>
        </Section>

        <Section title="Sheet & toast">
          <Card>
            <div style={row}>
              <Button variant="tinted" onClick={() => { setDetentLarge(false); setSheetOpen(true); }}>
                Open sheet
              </Button>
              <Button variant="tinted" onClick={() => { setDetentLarge(true); setSheetOpen(true); }}>
                Large sheet
              </Button>
              <Button
                variant="plain"
                onClick={() => toast.show('Undid black — 7 points', {
                  action: { label: 'Redo', onPress: () => toast.show('Redone') },
                })}
              >
                Toast with undo
              </Button>
            </div>
          </Card>
        </Section>

        <Section title="Empty state">
          <Card style={{ padding: 0 }}>
            <EmptyState
              icon="🎱"
              title="No matches yet"
              message="Start your first frame and it'll show up here."
              actionLabel="New match"
              onAction={() => toast.show('New match')}
            />
          </Card>
        </Section>
      </Screen>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        detent={detentLarge ? 'large' : 'medium'}
        title="Record foul"
      >
        <h2 className="type-title-2" style={{ marginTop: 0 }}>Record foul</h2>
        <p className="type-body" style={{ color: 'var(--label-secondary)' }}>
          Drag the grabber down to dismiss, or tap outside.
        </p>
        <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
          <Button variant="filled" fullWidth onClick={() => setSheetOpen(false)}>Confirm foul</Button>
          <Button variant="plain" fullWidth onClick={() => setSheetOpen(false)}>Cancel</Button>
        </div>
      </Sheet>
    </div>
  );
}

const row: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  alignItems: 'center',
  flexWrap: 'wrap',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 'var(--space-6)' }}>
      <h2 className="type-footnote" style={{
        textTransform: 'uppercase', letterSpacing: '0.03em',
        color: 'var(--label-secondary)', margin: '0 0 var(--space-3)',
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
