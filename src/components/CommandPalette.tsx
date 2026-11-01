import { useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from './Modal';
export interface PaletteCommand {
  label: string;
  hint: string;
  run: () => void;
}
export function CommandPalette({
  commands,
  close,
}: {
  commands: PaletteCommand[];
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(0);
  const results = commands.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()));
  function run(index: number) {
    const command = results[index];
    if (command) {
      close();
      command.run();
    }
  }
  return (
    <Modal title="Command palette" close={close}>
      <div className="palette-search">
        <Search size={17} />
        <input
          autoFocus
          role="combobox"
          aria-label="Search commands"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={results[selected] ? `command-${selected}` : undefined}
          placeholder="What would you like to do?"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const next = Math.max(
                0,
                Math.min(results.length - 1, selected + (e.key === 'ArrowDown' ? 1 : -1)),
              );
              setSelected(next);
              document.getElementById(`command-${next}`)?.scrollIntoView({ block: 'nearest' });
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              run(selected);
            }
          }}
        />
      </div>
      <div id="command-results" role="listbox" aria-label="Commands" className="palette-results">
        {results.map((command, index) => (
          <button
            id={`command-${index}`}
            role="option"
            aria-selected={index === selected}
            tabIndex={-1}
            key={command.label}
            onClick={() => run(index)}
          >
            <span>{command.label}</span>
            <kbd>{command.hint}</kbd>
          </button>
        ))}
        {!results.length && <p className="group-empty">No matching commands</p>}
      </div>
    </Modal>
  );
}
