import React, { useEffect, useRef, useCallback } from 'react';
import { useHarbor } from './harbor';

interface HelmProps {
  mode: 'sail' | 'voyage';
  onModeChange: (m: 'sail' | 'voyage') => void;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void | Promise<void>;
  pendingApprovals: number;
  textareaRef?: (el: HTMLTextAreaElement | null) => void;
}

export const Helm: React.FC<HelmProps> = ({
  mode,
  onModeChange,
  value,
  onChange,
  onSubmit,
  pendingApprovals,
  textareaRef,
}) => {
  const { state, actions } = useHarbor();
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const setTa = useCallback(
    (el: HTMLTextAreaElement | null) => {
      taRef.current = el;
      if (textareaRef) textareaRef(el);
    },
    [textareaRef],
  );

  const streaming = state.session.messages.some((m) => m.streaming);

  // Auto-resize textarea to content (capped)
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  // Global shortcuts
  useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        taRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (value.trim() && !streaming) onSubmit(value);
      }
    };
    window.addEventListener('keydown', onSlash);
    return () => window.removeEventListener('keydown', onSlash);
  }, [value, onSubmit, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (streaming) return;
      if (value.trim()) onSubmit(value);
    }
  };

  const placeholder = streaming
    ? 'Working…'
    : pendingApprovals > 0
      ? `${pendingApprovals} approval${pendingApprovals === 1 ? '' : 's'} waiting at the gate — switch to Harbor`
      : 'What shall we sail for?  (/ focuses · ⌘↵ submits)';

  return (
    <div className={`helm-wrap ${streaming ? 'live-signal' : ''}`}>
      <div className="helm">
        <div className="helm-modes" role="tablist" aria-label="Run mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sail'}
            className={`helm-mode ${mode === 'sail' ? 'active' : ''}`}
            onClick={() => onModeChange('sail')}
            title="Sail — quick path (fast recall, safe tools direct)"
          >
            <span className="helm-mode-dot" aria-hidden="true" />
            Sail
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'voyage'}
            className={`helm-mode ${mode === 'voyage' ? 'active' : ''}`}
            onClick={() => onModeChange('voyage')}
            title="Voyage — deep path (council deliberates, full plan, simulations)"
          >
            <span className="helm-mode-dot" aria-hidden="true" />
            Voyage
          </button>
        </div>

        <textarea
          ref={setTa}
          className="helm-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={streaming}
          aria-label="Mission command"
          spellCheck={false}
        />

        <div className="helm-submit">
          {streaming ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => actions.stop()}
              title="Stop the current run"
            >
              Hold
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary helm-go"
              onClick={() => value.trim() && onSubmit(value)}
              disabled={!value.trim()}
            >
              Make it so
            </button>
          )}
        </div>
      </div>

      <div className="helm-foot" aria-live="polite">
        <span className="helm-brain">
          brain · <strong>{state.totals.brain}</strong>
        </span>
        <span className="helm-crew">
          crew · <strong>{state.totals.activeCrew?.name ?? 'shore watch'}</strong>
        </span>
        <span className="helm-ver">
          v{state.totals.version} <em>"{state.totals.codename}"</em>
        </span>
      </div>
    </div>
  );
};
